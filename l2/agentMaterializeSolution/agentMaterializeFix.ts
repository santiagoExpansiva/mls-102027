/// <mls fileReference="_102027_/l2/agentMaterializeSolution/agentMaterializeFix.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  getContentByMlsPath,
  parseMlsPath,
  saveGeneratedTs,
  extractToolCallArgs,
} from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';
import { buildGenContext } from '/_102027_/l2/agentMaterializeSolution/contextMaterialize.js';

declare const mls: any;

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializeFix',
    agentProject: 102027,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Fix TypeScript compiler errors in a generated .ts file',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

const TOOL_NAME = 'submitFixedTs';

interface FixStepArgs {
  outputPath: string;
  defPath: string;
  errors: string[];
}

interface ToolOutput {
  code: string;
}

const toolSchema = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description: 'Submit the corrected TypeScript file content.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['code'],
      properties: {
        code: {
          type: 'string',
          description: 'Complete corrected TypeScript file content. Must start with the /// <mls fileReference="..."> header.',
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
  if (!args) throw new Error('[agentMaterializeFix] missing args');

  const { outputPath, defPath, errors }: FixStepArgs = JSON.parse(args);
  const ctx = await buildGenContext(defPath);
  const currentCode = await getContentByMlsPath(outputPath) ?? '';

  const intent: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    systemPrompt: buildSystemPrompt(ctx.skillSections, outputPath),
    humanPrompt: buildHumanPrompt(ctx.definition, ctx.contextSections, currentCode, errors, outputPath),
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
  const { outputPath }: FixStepArgs = JSON.parse(step.prompt || '{}');
  const raw = step.interaction?.payload?.[0] as any;
  const out = extractToolCallArgs<ToolOutput>(raw, TOOL_NAME);

  if (!out?.code) {
    return [mkStatus(context, parentStep, step, hookSequential, 'failed', 'missing fixed code')];
  }

  const parsed = parseMlsPath(outputPath);
  if (!parsed) {
    return [mkStatus(context, parentStep, step, hookSequential, 'failed', `invalid outputPath: ${outputPath}`)];
  }

  const header = `/// <mls fileReference="${outputPath}" enhancement="_blank"/>`;
  const code = out.code.trimStart().startsWith('///') ? out.code : `${header}\n\n${out.code}`;

  const ok = await saveGeneratedTs(parsed.project, parsed.level, parsed.folder, parsed.shortName, code);

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

You fix TypeScript compiler errors in a generated file.

Target file: ${outputPath}

The file must start with:
/// <mls fileReference="${outputPath}" enhancement="_blank"/>

Apply only the changes needed to fix the reported errors.
Do not change logic, structure, or style beyond what is strictly necessary.
Follow the skill instructions for any type/import conventions.

---

${skills}`;
}

function buildHumanPrompt(
  definition: string,
  contextSections: string[],
  currentCode: string,
  errors: string[],
  outputPath: string,
): string {
  const lines: string[] = ['## Definition', '', definition];

  if (contextSections.length) {
    lines.push('', '## Context Files', '');
    lines.push(...contextSections);
  }

  lines.push('', '## Current file with errors', '');
  lines.push('```typescript');
  lines.push(currentCode);
  lines.push('```');

  lines.push('', '## Compiler errors', '');
  lines.push('```');
  lines.push(errors.join('\n'));
  lines.push('```');

  lines.push('', `Fix all errors and call ${TOOL_NAME} with the corrected \`${outputPath}\`.`);
  return lines.join('\n');
}
