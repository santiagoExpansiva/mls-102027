/// <mls fileReference="_102027_/l2/agents/materialize/agentMaterializePlanner.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';  


export function createAgent(): IAgentAsync { 
    return {
        agentName: "agentMaterializePlanner",
        agentProject: 102027,
        agentFolder: "",
        agentDescription: "First agent for general materialize",
        visibility: "public",
        beforePromptImplicit,
        afterPromptStep
    };
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    const system = await prepareSystemPrompt()

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system,
            }, {
                type: "human",
                content: context.message.content
            }],
            taskTitle: `New module`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
        }
    };
    return [addMessageAI];

}

async function afterPromptStep(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    parentStep: mls.msg.AIAgentStep,
    step: mls.msg.AIAgentStep,
    hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {

    if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

    const payload = (step.interaction?.payload?.[0]);
    if (!payload || !payload.type) throw new Error(`Payload invalid`);
    if (!['flexible', 'result'].includes(payload?.type)) throw new Error(`Payload type invalid: ${payload?.type}`);

    let status: mls.msg.AIStepStatus = 'completed';
    let intents: mls.msg.AgentIntent[] = [];

    if (context.isTest) {
        console.info(payload);
        return [{
            type: 'update-status',
            hookSequential,
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            stepId: parentStep.stepId,
            status: 'completed'
        }];
    }

    if (payload.type === 'flexible') {

        const ag = extractObjectFromString(payload.result.prompt) || '[]';
        const newStep: mls.msg.AgentIntentAddStep = {
            type: "add-step",
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            step:
            {
                type: 'agent',
                stepId: 0,
                interaction: null,
                status: 'waiting_human_input',
                nextSteps: [],
                agentName: 'agentMaterialize',
                prompt: '@@' + payload.result.prompt,
                rags: payload.result.rags,
            },
            executionMode: {type:'parallel', args:JSON.parse(ag)}
        };

        intents.push(newStep);
    }

    if (payload.type === 'result') {
        const updateStatusAgent: mls.msg.AgentIntentUpdateStatus = {
            type: 'update-status',
            hookSequential,
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            stepId: parentStep.stepId,
            status: 'completed'
        };
        intents.push(updateStatusAgent);
    }

    intents = [...intents];
    return intents;

}

async function prepareSystemPrompt(): Promise<string> {

    let system: string = system1;
    system = system1.replace('{{agentsAvaliables}}', JSON.stringify([{ agent: 'agentMaterialize', description: 'Inicializa o processo de materialize' },]));

    return system;

}

function extractObjectFromString(input: string): string | null {
  const match = input.match(/[\[\{][\s\S]*[\]\}]/);
  return match ? match[0] : null;
}

const system1 = `
<!-- modelType: codeflash -->
<!-- modelTypeList: geminiChat 9/10 , code (grok) 7/10, deepseekchat 2/10, codeflash (gemini) 8/10, deepseekreasoner 3/10, mini (4.1) or nano (openai) 4/10, codeinstruct (4.1) 4/10, codereasoning(gpt5) 3/10, code2 (kimi 2.5) -->

You are a coordinator of agents responsible for executing tasks based on the user's prompt.  
Your only goal at this moment is to classify the type of action required from the prompt.
If you are unable to classify, send the first agent.

## Available Agents
{{agentsAvaliables}}


## Output format
Return only valid JSON in the following structure:

[[OutputSection1]]

`
 
//#region OutputSection1
export type Output1 =
    {
        type: "flexible";
        result:  Agent
    } |
    {
        type: "result";
        result: string 
    };


export type Agent = {
    type: "agent",
    agentName: string,
    title: string,
    prompt: string,
    rags: string[] | null
}

//#endregion
