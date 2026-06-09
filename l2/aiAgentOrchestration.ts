/// <mls fileReference="_102027_/l2/aiAgentOrchestration.ts" enhancement="_blank"/>

import {
    getNextPendentStep,
    getNextClarificationStep,
    getStepById,
    getInteractionStepId,
    findPreviousAgentStep,
    notifyTaskChange,
    notifyThreadChange,
    getRootAgent
} from "/_102027_/l2/aiAgentHelper.js";

import { IAgent, IAgentAsync } from '/_102027_/l2/aiAgentBase.js';
import * as storage from '/_102036_/l2/collabMessagesIndexedDB.js';

const agentName = 'aiAgentOrchestration';

// ── Event types ──────────────────────────────────────────────────

export type OrchestrationEvent =
    | { type: 'task-created'; taskId: string; task: mls.msg.TaskData; message?: mls.msg.Message }
    | { type: 'intents-applied'; task: mls.msg.TaskData; message: mls.msg.Message }
    | { type: 'hook-start'; hookType: string; stepId: number }
    | { type: 'hook-done'; hookType: string; intents: mls.msg.AgentIntent[] }
    | { type: 'pooling-start'; taskId: string }
    | { type: 'pooling-end'; taskId: string }
    | { type: 'cycle-done'; remaining: number }
    | { type: 'error'; error: string; stepId?: number }
    | { type: 'done' };

// ── executeBeforePrompt (streaming version) ──────────────────────

export async function* executeBeforePromptStream(
    agent: IAgent | IAgentAsync,
    context: mls.msg.ExecutionContext
): AsyncGenerator<OrchestrationEvent, void, unknown> {

    if ((agent as IAgent).beforePrompt) {
        await (agent as IAgent).beforePrompt(context);
        yield { type: 'done' };
        return;
    }

    const asyncAgent = agent as IAgentAsync;
    let content = context.message.content;
    if (content.startsWith("@@")) content = content.split(" ").slice(1).join(" ").trim();
    if (mls.isTraceAgent) console.log(`[executeBeforePromptStream] content:"${content}"`);

    let intents: mls.msg.AgentIntent[] | undefined;

    if (asyncAgent.beforePromptAtomic) {
        const { jsonText, rest } = splitJsonAndText(content);
        const file = mls.stor.getFileStorFromJson(jsonText, {});
        if (mls.isTraceAgent) console.log(`[executeBeforePromptStream] isAtomic=${file ? "yes:" + JSON.stringify(file) : "no"}, userPromptAfterJson:${rest}`);
        if (file) {
            intents = await asyncAgent.beforePromptAtomic(asyncAgent, context, file, rest);
        }
    }

    if (!intents && asyncAgent.beforePromptImplicit) {
        if (mls.isTraceAgent) console.log(`[executeBeforePromptStream] implicit`);
        intents = await asyncAgent.beforePromptImplicit(asyncAgent, context, content);
    }

    if (!intents) throw new Error(`Invalid agent ${asyncAgent.agentName}, no beforePrompt`);

    yield* processIntentsStream(asyncAgent, context, intents);
}

/**
 * Backward-compatible wrapper: consome o generator inteiro e retorna void.
 * Quem não precisa de streaming continua usando essa.
 */
export async function executeBeforePrompt(
    agent: IAgent | IAgentAsync,
    context: mls.msg.ExecutionContext
): Promise<void> {
    for await (const _event of executeBeforePromptStream(agent, context)) {
        // consume all events silently
    }
}

// ── splitJsonAndText ─────────────────────────────────────────────

function splitJsonAndText(input: string): { jsonText: string; rest: string } {
    const start = input.indexOf("{");
    const end = input.indexOf("}");
    if (start === -1 || end === -1 || end < start) return { jsonText: input, rest: "" };
    const jsonText = input.slice(start, end + 1).trim();
    const rest = input.slice(end + 1).trim();
    return { jsonText, rest };
}

// ── State ────────────────────────────────────────────────────────

const taskControllers = new Map<string, AbortController>();
const MAX_HOOKS_PER_TURN = 5;
const runningTasks = new Set<string>();

// ── processIntents (streaming) ───────────────────────────────────

async function* processIntentsStream(
    agent: IAgentAsync,
    context: mls.msg.ExecutionContext,
    intents: mls.msg.AgentIntent[]
): AsyncGenerator<OrchestrationEvent, void, unknown> {

    if (mls.isTraceAgent) console.log(`[processIntentsStream] intents length: ${intents.length}`);
    const messageId = context.message.createAt;
    if (!messageId) return;

    taskControllers.get(messageId)?.abort();
    const controller = new AbortController();
    taskControllers.set(messageId, controller);
    const signal = controller.signal;

    try {
        yield* _processIntentsStream(agent, context, intents, signal);
    } finally {
        if (taskControllers.get(messageId) === controller) {
            taskControllers.delete(messageId);
        }
    }
}

async function* _processIntentsStream(
    agent: IAgentAsync,
    context: mls.msg.ExecutionContext,
    intents: mls.msg.AgentIntent[],
    signal: AbortSignal
): AsyncGenerator<OrchestrationEvent, void, unknown> {

    if (signal.aborted) return;

    const oldContextCreateAt = context.message.createAt;
    const isAddMessageAI = intents.some(i => i.type === 'add-message-ai');

    const value = await mls.api.msgApplyIntents({
        userId: context.message.senderId,
        intents
    });

    if (!value) throw new Error(`[${agentName}] Error on msgApplyIntents`);
    if (value.statusCode !== 200) throw new Error(`[${agentName}] Error: ${value.msg || ''}`);
    if (signal.aborted) return;

    const ret = value as mls.msg.ResponseApplyIntents;
    context.task = ret.task;
    if (ret.message) context.message = ret.message;
    notifyTaskChange(context, isAddMessageAI ? oldContextCreateAt : undefined);

    // ★ Yield: task criada / intents aplicados
    yield {
        type: 'task-created',
        taskId: ret.task.PK,
        task: ret.task,
        message: ret.message
    };
    yield {
        type: 'intents-applied',
        task: ret.task,
        message: context.message
    };

    if (!context.task?.iaCompressed) {
        yield { type: 'done' };
        return;
    }

    runningTasks.add(ret.task.PK);

    await storage.addPooling({
        taskId: ret.task.PK,
        userId: context.task?.owner ?? '',
        startAt: Date.now().toString()
    });

    yield { type: 'pooling-start', taskId: ret.task.PK };

    if (signal.aborted) return;

    let _hooks = context.task.iaCompressed.queueFrontEnd || [];
    const hooksToProcess = selectHooksToProcess(_hooks.filter(h => h.type !== 'pooling'));

    let newIntents: mls.msg.AgentIntent[] = [];

    for (const hook of hooksToProcess) {
        // ★ Yield: hook iniciando
        yield { type: 'hook-start', hookType: hook.type, stepId: hook.stepId };

        const resolved = await resolveHookAgent(agent, context, hook);
        if (!resolved.agent) {
            const error = `[${agentName}](startNewAiTask) ${resolved.error || 'Invalid agent in hook step'}`;
            const combined = getHookFailureIntents(context, hook, error);
            yield { type: 'error', error, stepId: hook.stepId };
            yield { type: 'hook-done', hookType: hook.type, intents: combined };
            newIntents.push(...combined);
            continue;
        }

        agent = resolved.agent;

        const hookIntents = await processIntents2(resolved.agent, context, hook);
        const removeIntents = getRemoveIntent(context, hook);
        const combined = [...hookIntents, ...removeIntents];

        // ★ Yield: hook finalizado
        yield { type: 'hook-done', hookType: hook.type, intents: combined };

        newIntents.push(...combined);
    }

    await storage.addOrUpdateTask(context.task);
    if (signal.aborted) return;

    if (newIntents.length < 1) {
        newIntents = await processHookPooling(context);
        if (newIntents.length < 1) {
            runningTasks.delete(ret.task.PK);
            await storage.deletePooling(ret.task.PK);
            yield { type: 'pooling-end', taskId: ret.task.PK };
            yield { type: 'done' };
            return;
        }
    }

    // ★ Yield: ciclo concluído, informando quantos intents restam
    yield { type: 'cycle-done', remaining: newIntents.length };

    // Reentrada recursiva — continua emitindo eventos
    yield* _processIntentsStream(agent, context, newIntents, signal);
}

function selectHooksToProcess(hooks: mls.msg.AgentHooks[]): mls.msg.AgentHooks[] {
    const selected: mls.msg.AgentHooks[] = [];
    for (const hook of hooks) {
        selected.push(hook);
        // beforePromptStep commonly returns prompt_ready with a full LLM prompt.
        // Sending several large prompts in one applyIntents request can exceed
        // the backend request limit; later recursive cycles will process the rest.
        if (hook.type === 'beforePromptStep') break;
        if (selected.length >= MAX_HOOKS_PER_TURN) break;
    }
    return selected;
}

// ── processIntents (fire-and-forget, para uso interno) ───────────

async function processIntents(
    agent: IAgentAsync,
    context: mls.msg.ExecutionContext,
    intents: mls.msg.AgentIntent[]
): Promise<void> {
    for await (const _event of processIntentsStream(agent, context, intents)) {
        // consume silently — fire and forget behavior
    }
}

// ── _processIntents (legacy, para chamadas internas que não precisam stream) ─

async function _processIntents(
    agent: IAgentAsync,
    context: mls.msg.ExecutionContext,
    intents: mls.msg.AgentIntent[],
    signal: AbortSignal
): Promise<void> {
    for await (const _event of _processIntentsStream(agent, context, intents, signal)) {
        // consume silently
    }
}

async function resolveHookAgent(
    currentAgent: IAgentAsync,
    context: mls.msg.ExecutionContext,
    hook: mls.msg.AgentHooks
): Promise<{ agent?: IAgentAsync; error?: string }> {

    if (!context.task) return { error: 'Task not found while resolving hook agent' };

    const hookStep = getStepById(context.task, hook.stepId);
    if (!hookStep) return { error: `Step not found for hook stepId:${hook.stepId}` };

    if (hookStep.type !== 'agent') return { agent: currentAgent };

    const hookAgentName = (hookStep as mls.msg.AIAgentStep).agentName;
    if (!hookAgentName) return { error: `Agent name not found for hook stepId:${hook.stepId}` };
    if (currentAgent.agentName === hookAgentName) return { agent: currentAgent };

    const hookAgent = await loadAgent(hookAgentName);
    if (!hookAgent) return { error: `Agent not found:${hookAgentName}` };

    return { agent: hookAgent as IAgentAsync };
}

function getHookFailureIntents(
    context: mls.msg.ExecutionContext,
    hook: mls.msg.AgentHooks,
    error: string,
    removeHook = true
): mls.msg.AgentIntent[] {

    console.error(error);
    if (!context.task) return [];

    const parentStepId = (hook as { parentStepId?: number }).parentStepId;
    const step = getStepById(context.task, hook.stepId);
    const parentStep = typeof parentStepId === 'number'
        ? getStepById(context.task, parentStepId)
        : null;

    const removeIntents = removeHook ? getRemoveIntent(context, hook) : [];
    if (!step || !parentStep) return removeIntents;

    const updateStatusFailed: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential: hook.hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status: 'failed',
        traceMsg: error,
    };

    return [updateStatusFailed, ...removeIntents];
}

// ── processIntents2 ─────────────────────────────────────────────

async function processIntents2(agent: IAgentAsync, context: mls.msg.ExecutionContext, hook: mls.msg.AgentHooks): Promise<mls.msg.AgentIntent[]> {

    try {
        if (mls.isTraceAgent) console.log(`[aiAgentOrchestration processIntents2] hook type:"${hook.type}"`, hook);

        if (hook.type === "beforePromptStep") return await processHookBeforePromptStep(agent, context, hook);
        if (hook.type === "afterPromptStep") return await processHookAfterPromptStep(agent, context, hook);
        if (hook.type === "beforeTool") return await processHookBeforeTool(agent, context, hook);

        throw new Error(`not implemented processIntents process hooks, type:${hook.type}`);
    } catch (e: any) {

        const error = `error processing taskid:${context.task?.PK}, hook:${hook.type}, message:${e.message || e}`;
        console.error(error);
        return getHookFailureIntents(context, hook, error, false);
    }
}

function getRemoveIntent(context: mls.msg.ExecutionContext, hook: mls.msg.AgentHooks): mls.msg.AgentIntentRemoveHook[] {
    return [{
        type: 'remove-hook',
        hookSequential: hook.hookSequential,
        threadId: context.message.threadId,
        messageId: context.message.orderAt,
        taskId: context.task?.PK || ''
    }];
}

// ── Hook processors (sem mudanças) ──────────────────────────────

async function processHookBeforePromptStep(agent: IAgentAsync, context: mls.msg.ExecutionContext, hook: mls.msg.AgentHookBeforePromptStep): Promise<mls.msg.AgentIntent[]> {

    if (!agent.beforePromptStep) throw new Error(`Agent ${agent.agentName} do not have beforePromptStep`);
    if (!context.task) throw new Error('[processHookBeforePromptStep] invalid task');
    const step = getStepById(context.task, hook.stepId) as mls.msg.AIAgentStep;
    const parentStep = getStepById(context.task, hook.parentStepId) as mls.msg.AIAgentStep;
    if (!step || !parentStep) throw new Error('[processHookBeforePromptStep] invalid stepId or parentStepId');
    const rc = await agent.beforePromptStep(agent, context, parentStep, step, hook.hookSequential, hook.args);
    return rc;
}

async function processHookAfterPromptStep(agent: IAgentAsync, context: mls.msg.ExecutionContext, hook: mls.msg.AgentHookAfterPromptStep): Promise<mls.msg.AgentIntent[]> {
    if (!agent.afterPromptStep) throw new Error(`Agent ${agent.agentName} do not have afterPromptStep`);
    if (!context.task) throw new Error('[processHookAfterPromptStep] invalid task');
    const step = getStepById(context.task, hook.stepId) as mls.msg.AIAgentStep;
    const parentStep = getStepById(context.task, hook.parentStepId) as mls.msg.AIAgentStep;
    return await agent.afterPromptStep(agent, context, parentStep, step, hook.hookSequential);
}

async function processHookBeforeTool(agent: IAgentAsync, context: mls.msg.ExecutionContext, hook: mls.msg.AgentHookBeforeTool): Promise<mls.msg.AgentIntent[]> {

    let intents: mls.msg.AgentIntent[] = [];

    if (!context.task) throw new Error('[processHookBeforeTool] invalid task');
    const step = getStepById(context.task, hook.stepId) as mls.msg.AIToolStep;
    const parentStep = getStepById(context.task, hook.parentStepId) as mls.msg.AIAgentStep;
    if (!step || !parentStep) throw new Error('[processHookBeforeTool] invalid stepId or parentStepId');
    const rc = await executeTool(step.toolName, step.args);

    if (typeof rc.result !== "string") throw new Error(`Tool ${step.toolName} did not return a string`);
    const existResults = rc.result.length > 0;
    if (existResults) {

        const stepInteraction = getStepById(context.task, parentStep.stepId);
        if (!stepInteraction || stepInteraction.type !== 'agent') throw new Error('Interaction must be type: agent');
        const oldPrompt = stepInteraction.interaction?.input.find((item) => item.type === 'human');

        const newStep: mls.msg.AgentIntentAddStep = {
            type: "add-step",
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: parentStep.stepId,
            step:
            {
                type: 'agent',
                stepId: 0,
                interaction: null,
                status: 'waiting_human_input',
                nextSteps: [],
                agentName: stepInteraction.agentName,
                prompt: `${oldPrompt?.content} \n\n Response from tool ${step.toolName}: ${rc.result} `,
                rags: null,
            }
        };

        intents.push(newStep);
    }

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential: 0,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status: 'completed'
    };

    return [...intents, updateStatus]

}

async function processHookPooling(context: mls.msg.ExecutionContext): Promise<mls.msg.AgentIntentRemoveHook[]> {
    const hook: mls.msg.AgentHookPooling | undefined = (context.task?.iaCompressed?.queueFrontEnd.find(f => f.type === 'pooling')) as mls.msg.AgentHookPooling;
    let inClarification: boolean = false;
    if (context.task) {
        const step = getNextPendentStep(context.task);
        inClarification = (!!step && step.type === "clarification") || !!getNextClarificationStep(context.task);
        if (inClarification) {
            const threadId = context.message.threadId;
            const taskId = context.task.PK;
            const thread = await storage.updateThreadPendingTasks(threadId, taskId);
            notifyThreadChange(thread);
        }
    }

    if (!hook || !hook.afterMs || hook.afterMs < 1000 || context.task?.status === 'paused' || inClarification) return [];
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(getRemoveIntent(context, hook));
        }, hook.afterMs);
    });
}

// ── continuePoolingTask ─────────────────────────────────────────

export async function continuePoolingTask(context: mls.msg.ExecutionContext) {

    const { task } = context;
    if (!task) return;
    const taskId = task.PK;

    if (runningTasks.has(taskId)) {
        console.warn('Task already in pooling');
        return;
    }

    if (task.status !== 'in progress') {
        storage.deletePooling(taskId);
        return;
    }

    const ia = task.iaCompressed;
    if (!ia) throw new Error('Task has no AI interaction');
    if (!ia.queueFrontEnd) throw new Error('Task has no pending hooks');

    const firstStep = ia.nextSteps?.[0] as mls.msg.AIAgentStep | undefined;
    if (!firstStep) throw new Error('No next step available');
    const agentNameLocal = firstStep.agentName;
    const agent = await loadAgent(agentNameLocal);
    if (!agent) throw new Error(`[${agentNameLocal}] createAgent function not found`);

    runningTasks.add(taskId);
    await storage.addPooling({
        taskId,
        userId: context.task?.owner ?? '',
        startAt: Date.now().toString()
    });

    const hooksToProcess = ia.queueFrontEnd
        .filter(h => h.type !== 'pooling')
        .slice(0, MAX_HOOKS_PER_TURN);

    const intentsFromHooks = (
        await Promise.all(
            hooksToProcess.map(async hook => {
                const resolved = await resolveHookAgent(agent, context, hook);
                if (!resolved.agent) {
                    const error = `[${agentName}](continuePoolingTask) ${resolved.error || 'Invalid agent in hook step'}`;
                    return getHookFailureIntents(context, hook, error);
                }

                return [
                    ...(await processIntents2(resolved.agent, context, hook)),
                    ...getRemoveIntent(context, hook),
                ];
            })
        )
    ).flat();

    await storage.addOrUpdateTask(task);
    let intents = intentsFromHooks;

    if (intents.length === 0) {
        intents = await processHookPooling(context);
        if (intents.length === 0) {
            runningTasks.delete(taskId);
            await storage.deletePooling(taskId);
            return;
        }
    }

    void processIntents(agent, context, intents);
}

// ── pauseOrContinueTask ─────────────────────────────────────────

export async function pauseOrContinueTask(
    reason: string,
    context: mls.msg.ExecutionContext,
    action: "paused" | "continue"
): Promise<void> {

    const task = context.task;
    if (!task) throw new Error(`(pauseOrContinueTask) task not found`);

    const ia = task.iaCompressed;
    if (!ia) throw new Error('(pauseOrContinueTask) Task has no AI interaction');

    if (['todo', 'done'].includes(task.status)) throw new Error(`(pauseOrContinueTask) cannot change task with status "${task.status}". Only tasks in "paused" or "continued" state can be modified.`);

    if (task.status === 'paused' && action === 'paused') throw new Error(`(pauseOrContinueTask) task already paused`);

    const intentPauseOrContinue: mls.msg.AgentIntentPauseOrContinue = {
        type: 'pause-or-continue',
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        reason,
    };

    const intents: mls.msg.AgentIntent[] = [intentPauseOrContinue];
    const agentRoot = getRootAgent(task)
    if (!agentRoot) throw new Error('(pauseOrContinueTask) Task has no AI agentRoot');
    const agent = await loadAgent(agentRoot.agentName);
    if (!agent) throw new Error(`(pauseOrContinueTask) Agent not found`);
    processIntents(agent, context, intents);

}

// ── restartStep ─────────────────────────────────────────────────

export async function restartStep(
    context: mls.msg.ExecutionContext,
    stepId: number,
    cleaner?: 'input' | 'input_output'
): Promise<void> {

    const task = context.task;
    if (!task) throw new Error('(restartStep) task not found');

    const step = getStepById(task, stepId) as mls.msg.AIAgentStep | null;
    if (!step) throw new Error(`(restartStep) step not found: ${stepId}`);
    if (step.status !== 'failed') throw new Error('(restartStep) only failed steps can be restarted');
    if (!step.planning) throw new Error('(restartStep) step has no planning');

    const parentStep = findPreviousAgentStep(task, stepId);
    if (!parentStep) throw new Error(`(restartStep) parent step not found for step ${stepId}`);
    const parentStepId = parentStep.stepId;

    const intent: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential: 0,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: task.PK,
        parentStepId,
        stepId,
        status: 'waiting_dependency',
        cleaner,
    };

    const agentRoot = getRootAgent(task);
    if (!agentRoot) throw new Error('(restartStep) Task has no AI agentRoot');
    const agent = await loadAgent(agentRoot.agentName);
    if (!agent) throw new Error('(restartStep) Agent not found');
    processIntents(agent, context, [intent]);

}


// ── Tools ────────────────────────────────────────────────────────

export async function executeTool(toolName: string, args: string): Promise<IExecuteToolReturn> {
    const rc: IExecuteToolReturn = {
        status: false,
        error: "",
        result: []
    };
    if (!toolName) {
        rc.error = "Tool name is missing";
        return rc;
    };
    try {

        const tool = await loadTool(toolName);
        if (!args) {
            mls.common.argsValidator({}, tool.argsSchema);
            rc.result = await tool.execute();
        } else {
            const parsedArgs = mls.common.safeParseArgs(args);
            mls.common.argsValidator(parsedArgs, tool.argsSchema);
            rc.result = await tool.execute(parsedArgs);
        }
        rc.status = true;
    } catch (error: any) {
        console.error(`[executeTool] ${error.message || error} `);
        rc.error = error.message || error;
    }
    return rc;
}


// ── Clarification ────────────────────────────────────────────────

export async function finishClarification(
    agent: IAgent | IAgentAsync,
    stepId: number,
    parentStepId: number,
    intents: mls.msg.AgentIntent[],
    context: mls.msg.ExecutionContext,
    value: string,
    action: "continue" | "cancel"): Promise<void> {

    if (context.task) {
        const thread = await storage.updateThreadPendingTasks(context.message.threadId, context.task.PK);
        notifyThreadChange(thread);
    }

    if (action === 'cancel') {
        const updateStatusFailed: mls.msg.AgentIntentUpdateStatus = {
            type: 'update-status',
            hookSequential: 0,
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId,
            stepId,
            status: 'failed'
        };
        const intentsFailed: mls.msg.AgentIntent[] = [updateStatusFailed];
        return processIntents(agent, context, intentsFailed);
    }

    if (action === 'continue') {

        const intentAddStep = intents.find((step) => step.type === 'add-step') as mls.msg.AgentIntentAddStep;
        if (!intentAddStep) return;

        const agentStep = (intentAddStep.step as mls.msg.AIAgentStep)
        if (agentStep.prompt) {
            const prompt = agentStep.prompt;
            agentStep.prompt = (prompt || '').replace('{{clarification}}', value)
        }

        const newAgent = await loadAgent(agentStep.agentName);
        if (!newAgent) throw new Error(`(pauseOrContinueTask) Agent not found`);
        await processIntents(newAgent, context, intents);

    }

}

// NOTE: clarification UI is rendered by the production frontend (mls-102025),
// not by the orchestration. The widget (widget-questions-for-clarification-102025)
// lives in mls-102025 so this shared library does not depend on Studio (mls-100554).
// Agents build the widget locally and wire it to `finishClarification`.

export async function getClarificationElement(context: mls.msg.ExecutionContext): Promise<HTMLElement> {

    const task = context.task;
    if (!task) throw new Error('Task not find');
    const taskId = task.PK;
    if (task.status !== 'in progress') throw new Error('Task not in progress');

    const ia = task.iaCompressed;
    if (!ia) throw new Error('Task has no AI interaction');
    if (!ia.queueFrontEnd) throw new Error('Task has no pending hooks');

    const ret = await getAgentContext(taskId)
    if (ret.step.type !== "clarification") throw new Error(`[${agentName}](getClarificationElement) Clarification step not not found`);

    const agent: IAgentAsync | undefined = await loadAgent(ret.interaction.agentName);
    if (!agent) throw new Error(`[${agentName}](getClarificationElement) function not found`);
    const fn = agent.beforeClarificationStep;

    if (typeof fn !== "function") throw new Error(`[${agentName}](getClarificationElement) 'beforeClarificationStep' function not found in ${agentName} `);

    const parentId = getInteractionStepId(task, ret.step.stepId);
    if (!parentId) throw new Error(`[${agentName}](getClarificationElement) parentId not found`);

    const parentStep = getStepById(task, parentId) as mls.msg.AIAgentStep;
    if (!parentStep) throw new Error(`[${agentName}](getClarificationElement) parentStep not found`);

    return fn(agent, context, parentStep, ret.step, 0, ret.step.json);

}

// ── Helpers ──────────────────────────────────────────────────────

export async function getAgentContext(taskId: string): Promise<{
    context: mls.msg.ExecutionContext,
    interaction: mls.msg.AIAgentStep,
    step: mls.msg.AIPayload
}> {
    const task: mls.msg.TaskData | undefined = await storage.getTask(taskId);
    if (!task || !task.messageid_created) throw new Error(`[${agentName}](getAgentContext) Invalid taskId ${taskId}`);
    let step: mls.msg.AIPayload | null = getNextPendentStep(task);
    if (!step || (step.type !== "clarification" && step.type !== "tool")) {
        const clarStep = getNextClarificationStep(task);
        if (clarStep) step = clarStep;
        else if (!step) throw new Error("[getAgentContext] No pending step");
        else throw new Error("[getAgentContext] No pending clarification or tool step");
    }
    const interactionId: number | null = getInteractionStepId(task, step.stepId);
    if (!interactionId) throw new Error("[getAgentContext] Not found interactionId in pending step")
    const interaction: mls.msg.AIPayload | null = getStepById(task, interactionId);
    if (!interaction || interaction.type !== "agent") throw new Error("[getAgentContext] Clarification or tool step not bellow a agent");

    const messageId: string = task.messageid_created;

    const message: mls.msg.Message | undefined = await storage.getMessage(messageId);
    if (!message) throw new Error(`[${agentName}](getAgentContext) Message not found: ${messageId}`)
    const context: mls.msg.ExecutionContext = {
        message,
        task,
        isTest: task.iaCompressed?.isTest || false
    }
    return { context, interaction, step };
}

export async function loadAgent(agentName: string): Promise<IAgent | IAgentAsync | undefined> {
    try {
        const agent = await getInstanceByName(agentName, 'agent');
        return agent;
    } catch (error: any) {
        console.error(`[loadAgent] ${error.message || error} `);
        return undefined;
    }
}

export async function loadTool(toolName: string): Promise<any | undefined> {
    try {
        const tool = await getInstanceByName(toolName, 'tool');
        return tool;
    } catch (error: any) {
        console.error(`[loadTool] ${error.message || error} `);
        return undefined;
    }
}

type InstanceMode = 'agent' | 'tool';

const FACTORY_MAP = {
    agent: 'createAgent',
    tool: 'createTool'
} as const;

/**
 * agentName, ex: 'agentXX1' or '_100554_/l2/agents/agentXX1'
 */
export async function getInstanceByName(
    nameOrPath: string,
    mode: InstanceMode
): Promise<IAgent | IAgentAsync | undefined> {

    const projectActual = mls.actualProject;
    if (!projectActual) throw new Error('Not found project actual!');

    const fileInfo = mls.stor.getPathToFile(nameOrPath);

    const projectsToSearch =
        fileInfo.project > 0
            ? [fileInfo.project]
            : mls.l5.getProjectDependencies(projectActual, true);

    function searchInProject(projectId: number) {
        let foundInFolder: mls.stor.IFileInfo | undefined;

        for (const file of Object.values(mls.stor.files)) {
            if (
                file.project !== projectId ||
                file.extension !== ".ts" ||
                file.shortName !== fileInfo.shortName
            ) continue;

            if (mode === 'agent' && !file.shortName.startsWith('agent')) continue;
            if (mode === 'tool' && !file.shortName.startsWith('tool')) continue;

            if (file.folder === '' || file.folder === fileInfo.folder) {
                return file;
            }

            foundInFolder = file;
        }

        return foundInFolder;
    }

    // Search only in the current project and its dependencies (no hardcoded
    // Studio base project). getProjectDependencies(projectActual, true) already
    // includes the current project plus all of its dependencies.
    for (const projId of projectsToSearch) {
        const file = searchInProject(projId);
        if (!file) continue;

        try {

            // Cache-bust only files under development (editing mode / project=0):
            // those must always fetch the latest. Published files use their stable
            // versionRef so the browser can cache them and only re-fetch when the
            // version actually changes.
            const cacheKey = file.inLocalStorage ? Date.now() : encodeURIComponent(file.versionRef);
            const module = await import(`/_${file.project}_/l2/${file.folder ? file.folder.trim() + '/' : ''}${file.shortName}?t=${cacheKey}`)
            const factoryName = FACTORY_MAP[mode];
            const factory = module[factoryName];

            if (typeof factory !== "function") {
                throw new Error(
                    `[getInstanceByName] ${factoryName} not found in ${file.shortName}`
                );
            }

            return factory();
        } catch (error: any) {
            console.error(`[load${mode}] ${error.message || error}`);
            return undefined;
        }
    }

    return undefined;
}

// ── Types ────────────────────────────────────────────────────────

export interface IExecuteToolReturn {
    status: boolean;
    error: string;
    result: any;
}

export interface ClarificationValue {
    taskId: string;
    stepId: number;
    title: string;
    userLanguage: string;
    questions: ClarificationQuestions;
    legends: string[];
}

export interface ClarificationQuestions {
    [key: string]: Question;
}

export interface Question {
    type: 'open' | 'select' | 'boolean' | 'MoSCoW' | 'range';
    question: string;
    answer?: string | boolean;
    options?: QuestionOption[];
}

export interface QuestionOption {
    id: string;
    label: string;
}
