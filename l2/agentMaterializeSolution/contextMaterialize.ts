/// <mls fileReference="_102027_/l2/agentMaterializeSolution/contextMaterialize.ts" enhancement="_blank"/>

import { collabImport } from '/_102027_/l2/collabImport.js';
import {
  getContentByMlsPath,
  parseDefinitionFromContent,
  parsePipelineFromContent,
  parseMlsPath,
  readProjectJson,
  toMlsPath,
  loadModuleByBuild,
  loadRulesForIds,
  getDtsForFile,
} from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';
import type {
  PipelineItem,
  L1FileType,
  L2FileType,
  ProjectJson,
  VisualStyle,
} from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';

declare const mls: any;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GenContext {
  pipelineItem: PipelineItem;
  fileType: L1FileType | L2FileType;
  definition: string;
  skillSections: string[];    // content blocks for the system prompt
  contextSections: string[];  // def-context + dep blocks for the human prompt
  resolvedRules: Record<string, unknown>[];
  visualStyle?: VisualStyle;
}

// ─── Import extractor ────────────────────────────────────────────────────────

function extractDtsImportPaths(dts: string, project: number): string[] {
  const found: string[] = [];
  const re = /from\s+'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dts)) !== null) {
    let imp = m[1];
    if (imp.startsWith('/')) imp = imp.slice(1);
    const p = parseMlsPath(imp);
    if (p && p.project === project) found.push(imp);
  }
  return [...new Set(found)];
}

// ─── Module var loader ────────────────────────────────────────────────────────

async function loadVarFromModule(mlsPath: string, varName: string): Promise<string> {
  const clean = mlsPath.startsWith('/') ? mlsPath.slice(1) : mlsPath;
  const f = mls.stor.convertFileReferenceToFile(clean);
  if (!f) return '';
  let mod: any = null;
  try {
    mod = await collabImport(f);
  } catch {
    mod = await loadModuleByBuild(clean);
  }
  if (!mod) return '';
  const value = mod[varName];
  if (typeof value === 'string') return value;
  if (value !== null && value !== undefined) {
    try { return JSON.stringify(value, null, 2); } catch {}
  }
  return '';
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function buildGenContext(defPath: string): Promise<GenContext> {
  const parsed = parseMlsPath(defPath);
  if (!parsed) throw new Error(`[contextMaterialize] invalid defPath: ${defPath}`);
  const { project, folder } = parsed;
  const moduleName = folder.split('/')[0];

  // Read .defs.ts
  const defsContent = await getContentByMlsPath(defPath);
  if (!defsContent) throw new Error(`[contextMaterialize] .defs.ts not found: ${defPath}`);

  const definition = (await loadVarFromModule(defPath, 'definition')) || parseDefinitionFromContent(defsContent);
  const pipeline = parsePipelineFromContent(defsContent);
  if (!pipeline?.length) throw new Error(`[contextMaterialize] no pipeline in: ${defPath}`);
  const pipelineItem = pipeline[0];
  const fileType = resolveFileType(pipelineItem.type);

  // Project data
  const projectJson = await readProjectJson();
  const moduleExports = await loadModuleExports(project, moduleName);

  // Skills
  const genomeKey = folder.slice(moduleName.length + 1); // e.g. "web/desktop/page11"
  const skillPaths = resolveSkillPaths(fileType, moduleExports, projectJson, genomeKey);
  const skillSections: string[] = [];
  const defContextSections: string[] = [];
  for (const sp of skillPaths) {
    const clean = sp.startsWith('/') ? sp.slice(1) : sp;
    if (/^_\d+_$/.test(clean)) {
      const content = await loadProjectDefinition(clean);
      if (content) defContextSections.push(`### Project Definition (${clean})
\`\`\`typescript
${content}
\`\`\``);
    } else {
      const content = await loadSkillContent(sp);
      if (content) skillSections.push(`<!-- skill: ${sp} -->
${content}`);
    }
  }

  // Visual style (page only)
  const visualStyle = fileType === 'page' && projectJson
    ? projectJson.modules.find(m => m.moduleName === moduleName)?.module?.visualStyle
    : undefined;

  // Business rules
  let resolvedRules: Record<string, unknown>[] = [];
  if (pipelineItem.rulesApplied?.length) {
    resolvedRules = await loadRulesForIds(project, moduleName, pipelineItem.rulesApplied);
  }

  // dependsFiles — three modes based on path suffix:
  //   .d.ts       → compiled definition via getDtsForFile
  //   .ts         → raw source via getContentByMlsPath
  //   .ts?varName → import module (collabImport → esbuild fallback), access module[varName]
  const seen = new Set<string>();
  const depSections: string[] = [];

  async function addDep(rawPath: string, followImports = false): Promise<void> {
    if (seen.has(rawPath)) return;
    seen.add(rawPath);

    const qIdx = rawPath.indexOf('?');
    const mlsPath = qIdx !== -1 ? rawPath.slice(0, qIdx) : rawPath;
    const query = qIdx !== -1 ? rawPath.slice(qIdx + 1) : undefined;
    // Supports both "?skill" and "?key=skill" formats
    const eqIdx = query !== undefined ? query.indexOf('=') : -1;
    const varName = query !== undefined
      ? (eqIdx !== -1 ? query.slice(eqIdx + 1) : query)
      : undefined;

    const p = parseMlsPath(mlsPath);
    let content = '';

    if (varName !== undefined) {
      content = await loadVarFromModule(mlsPath, varName);
    } else if (mlsPath.endsWith('.d.ts')) {
      if (p) content = await getDtsForFile(p.project, p.level, p.folder, p.shortName) ?? '';
      else content = await getContentByMlsPath(mlsPath) ?? '';
    } else {
      content = await getContentByMlsPath(mlsPath) ?? '';
    }

    if (!content) return;
    depSections.push(`### ${rawPath}\n\`\`\`typescript\n${content}\n\`\`\``);

    if (followImports && p && mlsPath.endsWith('.d.ts')) {
      for (const imp of extractDtsImportPaths(content, p.project)) {
        await addDep(imp.replace(/\.js$/, '.d.ts'));
      }
    }
  }

  for (const dep of pipelineItem.dependsFiles) {
    await addDep(dep, true);
  }

  return {
    pipelineItem,
    fileType,
    definition,
    skillSections,
    contextSections: [...defContextSections, ...depSections],
    resolvedRules,
    visualStyle,
  };
}

// ─── File type resolver ───────────────────────────────────────────────────────

export function resolveFileType(itemType: string): L1FileType | L2FileType {
  const map: Record<string, L1FileType | L2FileType> = {
    layer_1_external:    'layer1',
    layer_4_entities:    'layer4',
    layer_3_usecases:    'layer3',
    layer_2_controllers: 'layer2',
    l2_contract:         'contract',
    l2_shared:           'shared',
    l2_page:             'page',
  };
  return (map[itemType] ?? 'layer1') as L1FileType | L2FileType;
}

// ─── Skill resolution ─────────────────────────────────────────────────────────

const NEEDS_DEFINITION: string[] = ['layer1', 'layer4'];

function resolveSkillPaths(
  fileType: L1FileType | L2FileType,
  moduleExports: any,
  projectJson: ProjectJson | null,
  genomeKey?: string,
): string[] {
  if (!moduleExports) return [];

  if (fileType === 'contract') return moduleExports.skills?.contract?.skillPath ?? [];

  if (fileType === 'shared') {
    const p = moduleExports.shared?.web?.sharedSkill as string | undefined;
    return p ? [p] : [];
  }

  if (fileType === 'page') {
    const genome = moduleExports.moduleGenome?.[genomeKey ?? 'web/desktop/page11'];
    if (!genome) return [];
    const paths: string[] = [];
    if (genome.layout && projectJson) {
      const entry = Object.values(projectJson.layouts ?? {}).find(l => l.name === genome.layout);
      if (entry?.skill) paths.push(entry.skill);
    }
    if (genome.designSystem && projectJson) {
      const entry = Object.values(projectJson.designSystems ?? {}).find(d => d.name === genome.designSystem);
      if (entry?.skill) paths.push(entry.skill);
    }
    return paths;
  }

  // L1 types: layer1, layer2, layer3, layer4
  const paths: string[] = [...(moduleExports.skills?.[fileType]?.skillPath ?? [])];
  if (NEEDS_DEFINITION.includes(fileType)) {
    const defPaths: string[] = moduleExports.skills?.definition?.skillPath ?? [];
    paths.push(...defPaths);
  }
  return paths;
}

// ─── Module loader ────────────────────────────────────────────────────────────

async function loadModuleExports(project: number, moduleName: string): Promise<any> {
  const path = toMlsPath(project, 2, moduleName, 'module', '.ts');
  const f = mls.stor.convertFileReferenceToFile(path);
  if (!f) return null;
  try {
    return await collabImport(f);
  } catch {
    return await loadModuleByBuild(path);
  }
}

// ─── Skill content loaders ────────────────────────────────────────────────────

async function loadProjectDefinition(projectRef: string): Promise<string> {
  const models = (mls as any).editor?.models;
  if (!models?.[projectRef]?.ts) return '';
  return models[projectRef].ts.model?.getValue?.() ?? '';
}

async function loadSkillContent(skillPath: string): Promise<string> {
  const clean = skillPath.startsWith('/') ? skillPath.slice(1) : skillPath;

  if (clean.endsWith('.md')) return await getContentByMlsPath(clean) ?? '';

  const f = mls.stor.convertFileReferenceToFile(clean);
  if (!f) return '';

  let mod: any;
  try {
    mod = await collabImport(f);
  } catch {
    mod = await loadModuleByBuild(clean);
  }

  if (typeof mod?.skill === 'string') return mod.skill;
  return await getContentByMlsPath(clean) ?? '';
}