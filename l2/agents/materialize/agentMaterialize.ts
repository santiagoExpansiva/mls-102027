/// <mls fileReference="_102027_/l2/agents/materialize/agentMaterialize.ts" enhancement="_100554_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_100554_/l2/aiAgentBase.js';
import { getMaterializeOrchestrator } from '/_102027_/l2/agents/materialize/materializeOrchestrator.js'; 

export function createAgent(): IAgentAsync {  
  return {
    agentName: "agentMaterialize",
    agentProject: 102027,
    agentFolder: "agents/materialize",
    agentDescription: "new agent",
    visibility: "public",
    beforePromptImplicit,
    beforePromptStep,
    afterPromptStep
  };
}

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {


  const paths: string[] = [];

  const inputs: mls.msg.IAMessageInputType[] = [{ type: "system", content: system1 }];

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: "add-message-ai",
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: inputs,
      taskTitle: '',
      threadId: context.message.threadId,
      userMessage: context.message.content,
      longTermMemory: {},
    },
    executionMode: {
      type: 'parallel',
      args: paths
    }
  };
  return [addMessageAI];

}

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string
): Promise<mls.msg.AgentIntent[]> {
  if (!args) throw new Error(`[beforePromptStep] args invalid`)


  if (args.startsWith("@@")) {
  
    const continueParallel1: mls.msg.AgentIntentPromptReady = {
      type: "prompt_ready",
      args,
      messageId: context.message.orderAt,
      threadId: context.message.threadId,
      taskId: context.task?.PK || '',
      hookSequential,
      parentStepId: parentStep.stepId,
      humanPrompt: '',
      systemPrompt: system1
    }
    return [continueParallel1];

  }

  //

  const orch = getMaterializeOrchestrator(args);
  const itens = await orch.process('init');

  const continueParallel: mls.msg.AgentIntentPromptReady = {
    type: "prompt_ready",
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt: JSON.stringify({ path: args, itens })
  }

  return [continueParallel];

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
  if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`)
  let status: mls.msg.AIStepStatus = 'completed';


  const orch = getMaterializeOrchestrator(payload.result.path);
  const group = orch.groupByAgent(payload.result.itens)

  const newSteps: mls.msg.AgentIntentAddStep[] = [];

  Object.keys(group).forEach((g) => {

    const info = group[g];

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
        agentName: g,
        prompt: '@@ ' + JSON.stringify(info),
        rags: [],
      },
      executionMode: { type: 'parallel', args: info.map((i: any) => JSON.stringify({ path: payload.result.path, item:i })) }
    };

    newSteps.push(newStep)

  });



  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    status
  };

  return [...newSteps, updateStatus];

}

const system1 = `
<!-- modelType: code-->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

Return same content


## Output format
You must return the object strictly as JSON
[[OutputSection]]

`

//#region OutputSection
export type Output =
  {
    type: "flexible";
    result: OutputParse;
  }

export type OutputParse = {
  path: string // path pass by human
  itens: any // same content
}
//#endregion 


