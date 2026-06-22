/// <mls fileReference="_102027_/l2/agentMaterializeSolution/artifactsMaterialize.ts" enhancement="_blank"/>

import { createStorFile } from '/_102027_/l2/libStor.js';


// ─── Pipeline item — embedded in each .defs.ts as `export const pipeline` ─────

export interface PipelineItem {
  id: string;
  type: string;
  outputPath: string;   // _102043_/l1/cafeFlow/layer_4_entities/PedidoEntity.ts
  defPath: string;      // _102043_/l1/cafeFlow/layer_4_entities/pedidoEntity.defs.ts
  dependsFiles: string[]; // already-generated .ts files the executor needs as context
  dependsOn: string[];    // pipeline item IDs that must complete before this one
  rulesApplied?: string[]; // business rules gathered from the definition (if any)
  agent: string;
}

// ─── L1 layer folders scanned for existing .defs.ts ──────────────────────────

export type L1LayerFolder =
  | 'layer_1_external'
  | 'layer_4_entities'
  | 'layer_3_usecases'
  | 'layer_2_controllers';

// ─── Fase 2: L1 generation ────────────────────────────────────────────────────

export type L1FileType = 'layer1' | 'layer4' | 'layer3' | 'layer2' | 'rulesApplied';

// ─── Scanned file descriptor ──────────────────────────────────────────────────

export interface ScannedDefsFile {
  project: number;
  level: number;
  folder: string;      // e.g. "cafeFlow/layer_4_entities"
  shortName: string;   // e.g. "pedidoEntity"
  moduleName: string;
  mlsPath: string;     // _102043_/l1/cafeFlow/layer_4_entities/pedidoEntity.defs.ts
}

// ─── Fase 2: L2 generation ────────────────────────────────────────────────────

export type L2FileType = 'contract' | 'shared' | 'page';

export interface GenStepArgs {
  planId: string;
  defPath: string; // MLS path of the .defs.ts — Gen resolves everything else from here
}

export interface ParsedMlsPath {
  project: number;
  level: number;
  folder: string;
  shortName: string;
  extension: string;
}

// ─── project.json ─────────────────────────────────────────────────────────────

export interface VisualStyle {
  tone?: string;
  layout?: string;
  palette?: string[];
}

export interface ProjectModuleRef {
  moduleName: string;
  module?: {
    visualStyle?: VisualStyle;
  };
}

export interface LayoutEntry {
  name: string;
  skill: string;
}

export interface DesignSystemEntry {
  name: string;
  skill: string;
}

export interface ProjectJson {
  modules: ProjectModuleRef[];
  layouts?: Record<string, LayoutEntry>;
  designSystems?: Record<string, DesignSystemEntry>;
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** _102043_/l1/cafeFlow/layer_4_entities/pedidoEntity.defs.ts */
export function toMlsPath(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  extension: string,
): string {
  const folderPart = folder ? `${folder}/` : '';
  return `_${project}_/l${level}/${folderPart}${shortName}${extension}`;
}

// ─── project.json ─────────────────────────────────────────────────────────────

export async function readProjectJson(): Promise<ProjectJson | null> {
  try {
    const project = mls.actualProject || 0;
    const fileInfo = { project, level: 5, folder: '', shortName: 'project', extension: '.json' };
    const key = mls.stor.getKeyToFile(fileInfo);
    const file = (mls.stor.files as Record<string, any>)[key];
    if (!file || file.status === 'deleted') return null;
    const raw = await file.getContent();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || !Array.isArray(parsed.modules)) return null;
    return parsed as ProjectJson;
  } catch (err) {
    console.warn('[artifactsMaterialize] readProjectJson failed', err);
    return null;
  }
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

const L1_LAYERS: L1LayerFolder[] = ['layer_1_external', 'layer_4_entities', 'layer_3_usecases', 'layer_2_controllers'];

export function scanL1DefsFiles(project: number, moduleName: string): ScannedDefsFile[] {
  const result: ScannedDefsFile[] = [];
  try {
    for (const layer of L1_LAYERS) {
      const folder = `${moduleName}/${layer}`;
      for (const f of Object.values(mls.stor.files as Record<string, any>)) {
        if (f.project !== project) continue;
        if (f.level !== 1) continue;
        if (f.folder !== folder) continue;
        if (f.extension !== '.defs.ts') continue;
        if (f.status === 'deleted') continue;
        result.push({
          project,
          level: 1,
          folder,
          shortName: f.shortName,
          moduleName,
          mlsPath: toMlsPath(project, 1, folder, f.shortName, '.defs.ts'),
        });
      }
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] scanL1DefsFiles failed', err);
  }
  return result;
}

export async function scanL1DefsWithPipeline(
  project: number,
  moduleName: string,
): Promise<Array<{ folder: string; shortName: string; pipeline: PipelineItem[] }>> {
  const result: Array<{ folder: string; shortName: string; pipeline: PipelineItem[] }> = [];
  try {
    for (const layer of L1_LAYERS) {
      const folder = `${moduleName}/${layer}`;
      for (const f of Object.values(mls.stor.files as Record<string, any>)) {
        if (f.project !== project) continue;
        if (f.level !== 1) continue;
        if (f.folder !== folder) continue;
        if (f.extension !== '.defs.ts') continue;
        if (f.status === 'deleted') continue;
        if (f.shortName === 'module' || f.shortName === 'index') continue;
        const content = String(await f.getContent());
        const pipeline = parsePipelineFromContent(content);
        if (!pipeline || pipeline.length === 0) continue;
        result.push({ folder, shortName: f.shortName as string, pipeline });
      }
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] scanL1DefsWithPipeline failed', err);
  }
  return result;
}

export function scanL2PageDefsFiles(project: number, moduleName: string): ScannedDefsFile[] {
  const result: ScannedDefsFile[] = [];
  try {
    const SKIP = new Set(['layer_2_contracts', 'project']);
    for (const f of Object.values(mls.stor.files as Record<string, any>)) {
      if (f.project !== project) continue;
      if (f.level !== 2) continue;
      if (f.folder !== moduleName) continue;
      if (f.extension !== '.defs.ts') continue;
      if (f.status === 'deleted') continue;
      if (SKIP.has(f.shortName as string)) continue;
      result.push({
        project,
        level: 2,
        folder: moduleName,
        shortName: f.shortName,
        moduleName,
        mlsPath: toMlsPath(project, 2, moduleName, f.shortName, '.defs.ts'),
      });
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] scanL2PageDefsFiles failed', err);
  }
  return result;
}

// ─── Dep layer listing ────────────────────────────────────────────────────────

export function listDepLayerPaths(
  project: number,
  moduleName: string,
  forLayer: L1LayerFolder,
): string[] {
  const depLayer: Partial<Record<L1LayerFolder, L1LayerFolder>> = {
    layer_4_entities:    'layer_1_external',
    layer_3_usecases:    'layer_4_entities',
    layer_2_controllers: 'layer_3_usecases',
  };
  const dep = depLayer[forLayer];
  if (!dep) return [];
  const folder = `${moduleName}/${dep}`;
  const result: string[] = [];
  try {
    for (const f of Object.values(mls.stor.files as Record<string, any>)) {
      if (f.project !== project) continue;
      if (f.level !== 1) continue;
      if (f.folder !== folder) continue;
      if (f.extension !== '.defs.ts') continue;
      if (f.status === 'deleted') continue;
      result.push(toMlsPath(project, 1, folder, f.shortName, '.defs.ts'));
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] listDepLayerPaths failed', err);
  }
  return result;
}

// ─── File content reader ──────────────────────────────────────────────────────

export async function getFileContent(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  extension: string,
): Promise<string | null> {
  try {
    const fileInfo = { project, level, folder, shortName, extension };
    const key = mls.stor.getKeyToFile(fileInfo);
    const file = (mls.stor.files as Record<string, any>)[key];
    if (!file || file.status === 'deleted') return null;
    return String(await file.getContent());
  } catch (err) {
    console.warn('[artifactsMaterialize] getFileContent failed', err);
    return null;
  }
}

// ─── Append pipeline to existing .defs.ts ────────────────────────────────────

export async function appendPipelineToFile(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  items: PipelineItem[],
): Promise<boolean> {
  try {
    const fileInfo = { project, level, folder, shortName, extension: '.defs.ts' };
    const key = mls.stor.getKeyToFile(fileInfo);
    const file = (mls.stor.files as Record<string, any>)[key];
    if (!file || file.status === 'deleted') return false;

    const existing = String(await file.getContent());
    if (existing.includes('export const pipeline')) return true; // already done

    const pipelineSrc = `\nexport const pipeline = ${JSON.stringify(items, null, 2)} as const;\n`;
    const newContent = existing.trimEnd() + '\n' + pipelineSrc;

    await mls.stor.localStor.setContent(file, { contentType: 'string', content: newContent });

    // Read-back verify
    const readBack = String(await file.getContent());
    return readBack.includes('export const pipeline');
  } catch (err) {
    console.warn('[artifactsMaterialize] appendPipelineToFile failed', err);
    return false;
  }
}

// ─── Create new .defs.ts file ─────────────────────────────────────────────────

export async function createDefsFile(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  definitionJson: unknown,
  items: PipelineItem[],
): Promise<boolean> {
  try {
    const fileRef = toMlsPath(project, level, folder, shortName, '.defs.ts');
    const defStr = JSON.stringify(definitionJson, null, 2);
    const source = [
      `/// <mls fileReference="${fileRef}" enhancement="_blank"/>`,
      ``,
      `export const definition = ${defStr};`,
      ``,
      `export const pipeline = ${JSON.stringify(items, null, 2)} as const;`,
      ``,
    ].join('\n');

    const fileInfo = { project, level, folder, shortName, extension: '.defs.ts' };
    const key = mls.stor.getKeyToFile(fileInfo);
    let storFile = (mls.stor.files as Record<string, any>)[key];

    if (!storFile) {
      storFile = await createStorFile({ ...fileInfo, source }, false, false, false);
    }
    await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: source });

    // Read-back verify
    const readBack = String(await storFile.getContent());
    return readBack.includes('export const pipeline');
  } catch (err) {
    console.warn('[artifactsMaterialize] createDefsFile failed', err);
    return false;
  }
}

// ─── esbuild helpers (shared, used by agentMaterializeL2 and agentMaterializeGen) ──

export async function getEsbuild(): Promise<any> {
  const w = window as any;
  const url = 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.4/esm/browser.js';
  if (!w.__esbuildInstance) w.__esbuildInstance = import(url);
  const esbuild = await w.__esbuildInstance;
  if (!w.__esbuildReady) {
    w.__esbuildReady = esbuild.initialize({
      wasmURL: 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.25.4/esbuild.wasm',
    });
  }
  await w.__esbuildReady;
  return esbuild;
}

export async function loadModuleByBuild(path: string): Promise<any> {
  try {
    const info = mls.stor.convertFileReferenceToFile(path);
    if (!info) return null;
    const key = mls.stor.getKeyToFile(info);
    const sf = (mls.stor.files as Record<string, mls.stor.IFileInfo>)[key];
    if (!sf) return null;
    const src = await sf.getContent() as string;
    const esbuild = await getEsbuild();
    const result = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'esnext' });
    const blob = new Blob([result.code], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      return await import(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
}

// ─── Fase 2: Generation helpers ──────────────────────────────────────────────

/** Extract the `pipeline` array from a .defs.ts content string. */
export function parsePipelineFromContent(content: string): PipelineItem[] | null {
  try {
    const match = content.match(/export\s+const\s+pipeline\s*=\s*([\s\S]*?)\s+as\s+const\s*;/);
    if (!match) return null;
    return JSON.parse(match[1]) as PipelineItem[];
  } catch {
    return null;
  }
}

/** Extract the `definition` template literal value from a .defs.ts content string. */
export function parseDefinitionFromContent(content: string): string {
  const match = content.match(/export\s+const\s+definition\s*=\s*`([\s\S]*?)`;/);
  return match ? match[1].trim() : content;
}

/**
 * Returns the updatedAt timestamp (ms) of a file, or a sentinel, or null.
 *
 * null              → file does not exist → needs generation
 * Number.MAX_SAFE_INTEGER → file exists, no timestamp, status 'new'|'changed'
 *                       → treat as very recent, DO NOT regenerate
 * null (second case) → file exists, no timestamp, other status
 *                       → cannot determine staleness, treat as missing → regenerate
 * >0                → normal timestamp comparison
 */
export function getFileModified(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  extension: string,
): number | null {
  try {
    const key = mls.stor.getKeyToFile({ project, level, folder, shortName, extension });
    const file = (mls.stor.files as Record<string, mls.stor.IFileInfo>)[key];
    if (!file || file.status === 'deleted') return null;
    if (file.updatedAt) return Date.parse(file.updatedAt);
    const status = (file as any).status as string;
    return (status === 'new' || status === 'changed') ? Number.MAX_SAFE_INTEGER : null;
  } catch {
    return null;
  }
}

/** Read any file by its full MLS path string. */
export async function getContentByMlsPath(mlsPath: string): Promise<string | null> {
  try {
    const info = mls.stor.convertFileReferenceToFile(mlsPath);
    const key = mls.stor.getKeyToFile(info);
    const file = (mls.stor.files as Record<string, any>)[key];
    if (!file || file.status === 'deleted') return null;
    return String(await file.getContent());
  } catch {
    return null;
  }
}

/** Parse a MLS path like `_102043_/l2/cafeFlow/web/contracts/page.defs.ts`. */
export function parseMlsPath(mlsPath: string): ParsedMlsPath | null {
  const match = mlsPath.match(/^_(\d+)_\/l(\d+)\/(.+)$/);
  if (!match) return null;
  const project = parseInt(match[1], 10);
  const level   = parseInt(match[2], 10);
  const rest    = match[3];
  const lastSlash = rest.lastIndexOf('/');
  const folder    = lastSlash >= 0 ? rest.slice(0, lastSlash) : '';
  const filename  = lastSlash >= 0 ? rest.slice(lastSlash + 1) : rest;
  let shortName: string, extension: string;
  if (filename.endsWith('.defs.ts')) {
    shortName = filename.slice(0, -'.defs.ts'.length);
    extension = '.defs.ts';
  } else if (filename.endsWith('.d.ts')) {
    shortName = filename.slice(0, -'.d.ts'.length);
    extension = '.d.ts';
  } else {
    const dot = filename.lastIndexOf('.');
    shortName = dot >= 0 ? filename.slice(0, dot) : filename;
    extension = dot >= 0 ? filename.slice(dot) : '';
  }
  return { project, level, folder, shortName, extension };
}

/**
 * Scan all l2 .defs.ts in sub-folders of a module that contain a pipeline export.
 * Excludes top-level source files (folder === moduleName).
 */
export async function scanL2DefsWithPipeline(
  project: number,
  moduleName: string,
): Promise<Array<{ project: number; level: number; folder: string; shortName: string; pipeline: PipelineItem[] }>> {
  const result: Array<{ project: number; level: number; folder: string; shortName: string; pipeline: PipelineItem[] }> = [];
  try {
    const prefix = moduleName + '/';
    for (const f of Object.values(mls.stor.files as Record<string, any>)) {
      if (f.project !== project) continue;
      if (f.level !== 2) continue;
      if (f.extension !== '.defs.ts') continue;
      if (f.status === 'deleted') continue;
      if (f.shortName === 'module' || f.shortName === 'index') continue;
      const folder = f.folder as string;
      if (folder === moduleName) continue;
      if (!folder.startsWith(prefix)) continue;
      const content = String(await f.getContent());
      const pipeline = parsePipelineFromContent(content);
      if (!pipeline || pipeline.length === 0) continue;
      result.push({ project, level: 2, folder, shortName: f.shortName as string, pipeline });
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] scanL2DefsWithPipeline failed', err);
  }
  return result;
}

/** Save (create or overwrite) a generated .ts file and force a recompile. */
export async function saveGeneratedTs(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  content: string,
): Promise<boolean> {
  try {
    const fileInfo = { project, level, folder, shortName, extension: '.ts' };
    const key = mls.stor.getKeyToFile(fileInfo);
    let file = (mls.stor.files as Record<string, any>)[key] as mls.stor.IFileInfo;
    if (!file) {
      file = await createStorFile({ ...fileInfo, source: content }, false, false, false);
    } else {
      const model = await file.getOrCreateModel();
      if (model) model.model.setValue(content);
    }
    await mls.stor.localStor.setContent(file, { contentType: 'string', content });
    if (!shortName.endsWith('.defs')) compileGeneratedTs(project, level, folder, shortName);
    return true;
  } catch (err) {
    console.warn('[artifactsMaterialize] saveGeneratedTs failed', err);
    return false;
  }
}

function compileGeneratedTs(project: number, level: number, folder: string, shortName: string): void {
  try {
    const editorKey = mls.editor.getKeyModel(project, shortName, folder, level);
    let modelBase = mls.editor.models[editorKey];
    if (!modelBase) {
      mls.editor.addModels(project, shortName, folder, level).then((m: any) => {
        if (!m) return;
        const modelTs = m?.ts;
        if (modelTs && modelTs.compilerResults) modelTs.compilerResults.modelNeedCompile = true;
        mls.l2.typescript.compileAndPostProcess(m, true, true);
      }).catch(() => {});
      return;
    }
    const modelTs = modelBase?.ts;
    if (modelTs && modelTs.compilerResults) modelTs.compilerResults.modelNeedCompile = true;
    mls.l2.typescript.compileAndPostProcess(modelBase, true, true);
  } catch (err) {
    console.warn('[artifactsMaterialize] compileGeneratedTs failed', err);
  }
}

/**
 * Load rules.defs.ts for a module, filter by ruleIds and return the matched rule objects.
 * File: _<project>_/l5/<moduleName>/rules.defs.ts — exports `rulesPlan` with `data.rules[]`.
 */
export async function loadRulesForIds(
  project: number,
  moduleName: string,
  ruleIds: string[],
): Promise<Record<string, unknown>[]> {
  if (!ruleIds.length) return [];
  const path = toMlsPath(project, 5, moduleName, 'rules', '.defs.ts');
  const content = await getContentByMlsPath(path);
  if (!content) return [];
  try {
    const match = content.match(/export\s+const\s+rulesPlan\s*=\s*([\s\S]*?)\s+as\s+const\s*;/);
    if (!match) return [];
    const plan = JSON.parse(match[1]);
    const allRules: Record<string, unknown>[] = plan?.data?.rules ?? [];
    return allRules.filter(r => ruleIds.includes(r['ruleId'] as string));
  } catch {
    return [];
  }
}

/** Extract all unique string values from every JSON array field named `fieldName` in `content`. */
export function extractJsonArrayField(content: string, fieldName: string): string[] {
  const vals = new Set<string>();
  const blockRe = new RegExp(`"${fieldName}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'g');
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(content)) !== null) {
    const valRe = /"([^"]+)"/g;
    let val: RegExpExecArray | null;
    while ((val = valRe.exec(block[1])) !== null) vals.add(val[1]);
  }
  return [...vals];
}

export async function saveGeneratedJson(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  content: string,
): Promise<boolean> {
  try {
    const fileInfo = { project, level, folder, shortName, extension: '.json' };
    const key = mls.stor.getKeyToFile(fileInfo);
    let file = (mls.stor.files as Record<string, any>)[key];
    if (!file) {
      file = await createStorFile({ ...fileInfo, source: content }, false, false, false);
    }
    await mls.stor.localStor.setContent(file, { contentType: 'string', content });
    return true;
  } catch (err) {
    console.warn('[artifactsMaterialize] saveGeneratedJson failed', err);
    return false;
  }
}

export async function saveGeneratedHtml(
  project: number,
  level: number,
  folder: string,
  shortName: string,
  content: string,
): Promise<boolean> {
  try {
    const fileInfo = { project, level, folder, shortName, extension: '.html' };
    const key = mls.stor.getKeyToFile(fileInfo);
    let file = (mls.stor.files as Record<string, any>)[key];
    if (!file) {
      file = await createStorFile({ ...fileInfo, source: content }, false, false, false);
    }
    await mls.stor.localStor.setContent(file, { contentType: 'string', content });
    return true;
  } catch (err) {
    console.warn('[artifactsMaterialize] saveGeneratedHtml failed', err);
    return false;
  }
}

/**
 * Returns the first-level import paths from compilerResults.imports for a .ts file,
 * filtered to imports belonging to the same project.
 */
export function getFileImports(
  project: number,
  level: number,
  folder: string,
  shortName: string,
): string[] {
  try {
    const key = mls.editor.getKeyModel(project, shortName, folder, level);
    const imports: string[] = mls.editor.models[key]?.ts?.compilerResults?.imports ?? [];
    return imports
      .map(imp => imp.startsWith('/') ? imp.slice(1) : imp)
      .filter((imp) => {
        const parsed = parseMlsPath(imp);
        return parsed !== null && parsed.project === project;
      });
  } catch {
    return [];
  }
}

/** Compile a generated .ts file and return any compiler errors. */
export async function compileAndGetErrors(
  project: number,
  level: number,
  folder: string,
  shortName: string,
): Promise<string[]> {
  try {
    // Ensure Monaco model exists and capture it (required before compile)
    const storKey = mls.stor.getKeyToFile({ project, level, folder, shortName, extension: '.ts' });
    const file = (mls.stor.files as Record<string, any>)[storKey];
    const storModel = file ? await file.getOrCreateModel() : null;

    const editorKey = mls.editor.getKeyModel(project, shortName, folder, level);
    let modelBase = mls.editor.models[editorKey];
    if (!modelBase) {
      modelBase = await mls.editor.addModels(project, shortName, folder, level);
    }
    if (!modelBase) return [];
    const modelTs = modelBase?.ts;
    if (!modelTs) return [];
    // Bridge: assign the Monaco model if the editor model doesn't have it yet
    if (!modelTs.model && storModel?.model) modelTs.model = storModel.model;
    if (!modelTs.model) return [];
    if (modelTs.compilerResults) modelTs.compilerResults.modelNeedCompile = true;
    await mls.l2.typescript.compile(modelTs);
    const errors: any[] = modelTs.compilerResults?.errors ?? [];
    return errors.map((e: any) => (typeof e === 'string' ? e : JSON.stringify(e)));
  } catch (err) {
    console.warn('[artifactsMaterialize] compileAndGetErrors failed', err);
    return [];
  }
}

/**
 * Returns the .d.ts declaration for a .ts file.
 * Tries prodDTS from the editor model (compiling on demand if needed).
 * Falls back to raw .ts content if no model is available or compile fails.
 */
export async function getDtsForFile(
  project: number,
  level: number,
  folder: string,
  shortName: string,
): Promise<string> {
  try {
    const key = mls.editor.getKeyModel(project, shortName, folder, level);
    let modelTS = mls.editor.models[key]?.ts;

    if (!modelTS) {
      const iModels = await mls.editor.addModels(project, shortName, folder, level);
      modelTS = iModels?.ts;
    }

    if (modelTS) {
      if (!modelTS.compilerResults?.prodDTS) {
        await mls.l2.typescript.compile(modelTS);
      }
      const dts = modelTS.compilerResults?.prodDTS;
      if (dts) return dts;
    }
  } catch (err) {
    console.warn('[artifactsMaterialize] getDtsForFile compile failed, falling back', err);
  }

  return (
    await getContentByMlsPath(toMlsPath(project, level, folder, shortName, '.d.ts')) ??
    await getContentByMlsPath(toMlsPath(project, level, folder, shortName, '.ts')) ??
    ''
  );
}

// ─── Tool call payload extractor ─────────────────────────────────────────────

export function extractToolCallArgs<T>(raw: unknown, toolName: string): T | null {
  const v = parseMaybeJson(raw);
  if (!isRecord(v)) return null;

  if (v.toolName === toolName) {
    const args = parseMaybeJson(v.arguments);
    return isRecord(args) ? (args as unknown as T) : null;
  }

  if (v.type === 'flexible' && v.result !== undefined) {
    const result = parseMaybeJson(v.result);
    if (isRecord(result) && result.toolName === toolName) {
      const args = parseMaybeJson(result.arguments);
      return isRecord(args) ? (args as unknown as T) : null;
    }
  }

  if (Array.isArray(v.tool_calls)) {
    const call = (v.tool_calls as unknown[]).find(
      (item) => isRecord(item) && isRecord((item as any).function) && (item as any).function.name === toolName,
    );
    if (isRecord(call)) {
      const fn = (call as any).function;
      const args = parseMaybeJson(fn.arguments);
      return isRecord(args) ? (args as unknown as T) : null;
    }
  }

  return null;
}

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
