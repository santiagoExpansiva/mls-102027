/// <mls fileReference="_102027_/l2/agentMaterializeSolution/agentMaterializeGen.ts" enhancement="_102027_/l2/enhancementAgent"/>
 
import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  getContentByMlsPath,
  parsePipelineFromContent,
  parseMlsPath,
  saveGeneratedTs,
  extractToolCallArgs,
  compileAndGetErrors,
  loadModuleByBuild,
} from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';
import { buildGenContext } from '/_102027_/l2/agentMaterializeSolution/contextMaterialize.js';
import type { GenStepArgs } from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';

declare const mls: any;

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializeGen',
    agentProject: 102027,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Generate a .ts file from a .defs.ts pipeline item using the resolved skill',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

const TOOL_NAME = 'submitGeneratedTs';

interface ToolOutput {
  code: string;
}

const toolSchema = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description: 'Submit the complete generated TypeScript file content.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['code'],
      properties: {
        code: {
          type: 'string',
          description: 'Complete TypeScript file content. Must start with the /// <mls fileReference="..."> header comment.',
        },
      },
    },
  },
} as const;

// ─── beforePromptStep ─────────────────────────────────────────────────────────

async function beforePromptStep(
  _agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  _step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!args) throw new Error('[agentMaterializeGen] missing args');

  const { defPath }: GenStepArgs = JSON.parse(args);
  const ctx = await buildGenContext(defPath);

  const intent: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    systemPrompt: buildSystemPrompt(ctx.skillSections, ctx.pipelineItem.outputPath),
    humanPrompt: buildHumanPrompt(ctx.definition, ctx.contextSections, ctx.pipelineItem.outputPath, ctx.resolvedRules, ctx.visualStyle),
    tools: [toolSchema as unknown as mls.msg.LLMTool],
    toolChoice: { type: 'function', function: { name: TOOL_NAME } },
  };

  return [intent];
}

// ─── afterPromptStep ──────────────────────────────────────────────────────────

async function afterPromptStep(
  _agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  const { defPath }: GenStepArgs = JSON.parse(step.prompt || '{}');

  const defsContent = defPath ? await getContentByMlsPath(defPath) : null;
  const pipeline = defsContent ? parsePipelineFromContent(defsContent) : null;
  const pipelineItem = pipeline?.[0];

  if (!pipelineItem) {
    return [mkStatus(context, parentStep, step, hookSequential, 'failed', 'pipeline not found in defs')];
  }

  const raw = step.interaction?.payload?.[0] as any;
  const out = extractToolCallArgs<ToolOutput>(raw, TOOL_NAME);

  if (!out?.code) {
    return [mkStatus(context, parentStep, step, hookSequential, 'failed', 'missing generated code')];
  }

  const parsed = parseMlsPath(pipelineItem.outputPath);
  if (!parsed) {
    return [mkStatus(context, parentStep, step, hookSequential, 'failed', `invalid outputPath: ${pipelineItem.outputPath}`)];
  }

  const header = `/// <mls fileReference="${pipelineItem.outputPath}" enhancement="_blank"/>`;
  const code = out.code.trimStart().startsWith('///')
    ? out.code
    : `${header}\n\n${out.code}`;

  const ok = await saveGeneratedTs(parsed.project, parsed.level, parsed.folder, parsed.shortName, code);

  if (ok) {
    try {
      const callbackRef = pipelineItem.afterSaveBackEnd ?? pipelineItem.afterSaveFrontEnd;
      if (callbackRef) {
        const sepIdx = callbackRef.indexOf('?');
        const modPath = sepIdx !== -1 ? callbackRef.slice(0, sepIdx) : callbackRef;
        const fnName  = sepIdx !== -1 ? callbackRef.slice(sepIdx + 1) : '';
        const mod = await loadModuleByBuild(modPath);
        if (mod && fnName && typeof mod[fnName] === 'function') {
          await mod[fnName]({
            type: pipelineItem.type,
            project: parsed.project,
            moduleName: parsed.folder.split('/')[0],
            code,
            outputPath: pipelineItem.outputPath,
            shortName: parsed.shortName,
          });
        }
      }
    } catch (err) {
      console.warn('[agentMaterializeGen] post-generation callback failed', err);
    }
  }

  if (ok) {
    const compileErrors = await compileAndGetErrors(parsed.project, parsed.level, parsed.folder, parsed.shortName);
    if (compileErrors.length > 0) {
      const fixArgs = JSON.stringify({ outputPath: pipelineItem.outputPath, defPath, errors: compileErrors });
      const planId = `fix-${parsed.shortName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
      const addStep: mls.msg.AgentIntentAddStep = {
        type: 'add-step',
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: step.stepId,
        step: {
          type: 'agent',
          stepId: 0,
          interaction: null,
          stepTitle: `Fix: ${parsed.shortName}`,
          status: 'waiting_human_input',
          nextSteps: [],
          agentName: 'agentMaterializeFix',
          prompt: fixArgs,
          rags: [],
          planning: { planId, dependsOn: [], executionMode: 'parallel_static', executionHost: 'client' },
        } as any,
      };
      return [addStep];
    }
  }

  return [mkStatus(
    context, parentStep, step, hookSequential,
    ok ? 'completed' : 'failed',
    ok ? undefined : 'saveGeneratedTs failed',
    ok ? 'input_output' : undefined,
  )];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkStatus(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  status: mls.msg.AIStepStatus,
  traceMsg?: string,
  cleaner?: 'input' | 'input_output',
): mls.msg.AgentIntentUpdateStatus {
  return {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    status,
    traceMsg,
    cleaner,
  };
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(skillSections: string[], outputPath: string): string {
  const skills = skillSections.length
    ? skillSections.join('\n\n---\n\n')
    : '<!-- no skill loaded -->';

  return `<!-- modelType: codeinstruct -->

You generate a TypeScript file based on a definition and context files.

Target file: ${outputPath}

The file must start with:
/// <mls fileReference="${outputPath}" enhancement="_blank"/>

Follow the instructions in the skill(s) below exactly.
Use the context files (dependsFiles) as reference for types, imports and logic.

---

${skills}`;
}

function buildHumanPrompt(
  definition: string,
  contextSections: string[],
  outputPath: string,
  resolvedRules?: Record<string, unknown>[],
  visualStyle?: object,
): string {
  const lines: string[] = ['## Definition', '', definition];

  if (resolvedRules && resolvedRules.length > 0) {
    lines.push('', '## Business Rules', '');
    lines.push('```json');
    lines.push(JSON.stringify(resolvedRules, null, 2));
    lines.push('```');
  }

  if (visualStyle) {
    lines.push('', '## Visual Style', '');
    lines.push('```json');
    lines.push(JSON.stringify(visualStyle, null, 2));
    lines.push('```');
  }

  if (contextSections.length) {
    lines.push('', '## Context Files', '');
    lines.push(...contextSections);
  }

  lines.push('', `Generate the file \`${outputPath}\` and call ${TOOL_NAME} with the complete code.`);
  return lines.join('\n');
}
