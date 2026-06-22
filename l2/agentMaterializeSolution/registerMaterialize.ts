/// <mls fileReference="_102027_/l2/agentMaterializeSolution/registerMaterialize.ts" enhancement="_blank"/>

import { convertFileNameToTag } from '/_102027_/l2/utils.js';
import {
  getFileContent,
  saveGeneratedTs,
  saveGeneratedJson,
  parseMlsPath,
  toMlsPath,
} from '/_102027_/l2/agentMaterializeSolution/artifactsMaterialize.js';
import {
  addImport,
  addRoute,
} from '/_102027_/l2/agentMaterializeSolution/ast/astRouter.js';
import {
  addModuleNav,
  addModuleRoute,
} from '/_102027_/l2/agentMaterializeSolution/ast/astModuleFront.js';
import {
  addNav,
  addPage,
} from '/_102027_/l2/agentMaterializeSolution/ast/astIndex.js';
import {
  addTableDef,
  extractTableDefVarName,
} from '/_102027_/l2/agentMaterializeSolution/ast/astPersistence.js';
import {
  addNavigation,
  addPage as addCollabPage,
} from '/_102027_/l2/agentMaterializeSolution/ast/astCollab.js';

// ─── File-level mutex ─────────────────────────────────────────────────────────
// Serializes concurrent read-modify-write operations on the same file.
// Each file path gets its own promise chain; different files run in parallel.

const fileLocks = new Map<string, Promise<void>>();

function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(res => { release = res; });
  fileLocks.set(path, current);
  return prev.then(() => fn()).finally(() => release());
}

// ─── Controller registration ──────────────────────────────────────────────────

interface RouterEntry {
  routeKey: string;
  handlerName: string;
  importPath: string;
}

function extractRouterEntries(source: string): RouterEntry[] {
  const results: RouterEntry[] = [];
  const re = /'([^']+)'\s*:\s*\{\s*handlerName\s*:\s*'([^']+)'\s*,\s*importPath\s*:\s*'([^']+)'\s*,?\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    results.push({ routeKey: m[1], handlerName: m[2], importPath: m[3] });
  }
  return results;
}

export function registerController(
  project: number,
  moduleName: string,
  generatedSource: string,
): Promise<void> {
  const entries = extractRouterEntries(generatedSource);
  if (!entries.length) return Promise.resolve();

  const routerPath = toMlsPath(project, 1, `${moduleName}/layer_2_controllers`, 'router', '.ts');

  return withLock(routerPath, async () => {
    const routerSource = await getFileContent(project, 1, `${moduleName}/layer_2_controllers`, 'router', '.ts');
    if (!routerSource) return;

    let updated = routerSource;
    for (const { routeKey, handlerName, importPath } of entries) {
      updated = addImport(updated, { kind: 'value', names: [handlerName], from: importPath });
      updated = addRoute(updated, routeKey, handlerName);
    }

    if (updated === routerSource) return;
    const p = parseMlsPath(routerPath);
    if (p) await saveGeneratedTs(p.project, p.level, p.folder, p.shortName, updated);
  });
}

// ─── Page registration ────────────────────────────────────────────────────────

export async function registerPage(
  project: number,
  moduleName: string,
  shortName: string,
  outputPath: string,
): Promise<void> {
  const parsed = parseMlsPath(outputPath);
  if (!parsed) return;

  const tag = convertFileNameToTag({ shortName: parsed.shortName, project: parsed.project, folder: parsed.folder });
  const href = `/${moduleName}/${shortName}`;
  const label = toLabel(shortName);
  const loader = '/' + outputPath.replace(/\.ts$/, '.js');

  await Promise.all([
    //updateModuleTs(project, moduleName, shortName, href, label, loader, tag),
    //updateIndexTs(project, moduleName, href, label, loader, tag),
    updateCollabConfig(project, moduleName, shortName, outputPath, href, label, tag),
  ]);
}

function updateModuleTs(
  project: number,
  moduleName: string,
  shortName: string,
  href: string,
  label: string,
  loader: string,
  tag: string,
): Promise<void> {
  const path = toMlsPath(project, 2, moduleName, 'module', '.ts');

  return withLock(path, async () => {
    const source = await getFileContent(project, 2, moduleName, 'module', '.ts');
    if (!source) return;

    let updated = source;
    updated = addModuleNav(updated, { id: shortName, label, href, description: label });
    updated = addModuleRoute(updated, { path: href, aliases: [], entrypoint: loader, tag, title: label });

    if (updated === source) return;
    const p = parseMlsPath(path);
    if (p) await saveGeneratedTs(p.project, p.level, p.folder, p.shortName, updated);
  });
}

function updateIndexTs(
  project: number,
  moduleName: string,
  href: string,
  label: string,
  loader: string,
  tag: string,
): Promise<void> {
  const path = toMlsPath(project, 2, moduleName, 'index', '.ts');

  return withLock(path, async () => {
    const source = await getFileContent(project, 2, moduleName, 'index', '.ts');
    if (!source) return;

    let updated = source;
    updated = addNav(updated, { label, href });
    updated = addPage(updated, { path: href, title: label, tagName: tag, loader });

    if (updated === source) return;
    const p = parseMlsPath(path);
    if (p) await saveGeneratedTs(p.project, p.level, p.folder, p.shortName, updated);
  });
}

function updateCollabConfig(
  project: number,
  moduleName: string,
  shortName: string,
  outputPath: string,
  href: string,
  label: string,
  tag: string,
): Promise<void> {
  const configPath = toMlsPath(project, 0, '', 'config', '.json');

  return withLock(configPath, async () => {
    const configSource = await getFileContent(project, 0, '', 'config', '.json');
    if (!configSource) return;

    const projectId = String(project);
    const relPath = outputPath.replace(/^_\d+_\//, '');

    let updated = configSource;
    updated = addNavigation(updated, projectId, moduleName, {
      id: shortName,
      label,
      href,
      description: label,
    });
    updated = addCollabPage(updated, projectId, moduleName, {
      pageId: shortName,
      route: href,
      source: relPath,
      definition: relPath.replace(/\.ts$/, '.defs.ts'),
      componentTag: tag,
    });

    if (updated === configSource) return;
    await saveGeneratedJson(project, 0, '', 'config', updated);
  });
}

// ─── Layer1 (persistence) registration ───────────────────────────────────────

export function registerLayer1(
  project: number,
  moduleName: string,
  generatedSource: string,
  outputPath: string,
): Promise<void> {
  const varName = extractTableDefVarName(generatedSource);
  if (!varName) return Promise.resolve();

  const importPath = '/' + outputPath.replace(/\.ts$/, '.js');
  const persistencePath = toMlsPath(project, 1, `${moduleName}/layer_1_external`, 'persistence', '.ts');

  return withLock(persistencePath, async () => {
    const persistenceSource = await getFileContent(project, 1, `${moduleName}/layer_1_external`, 'persistence', '.ts');
    if (!persistenceSource) return;

    const updated = addTableDef(persistenceSource, varName, importPath);
    if (updated === persistenceSource) return;

    const p = parseMlsPath(persistencePath);
    if (p) await saveGeneratedTs(p.project, p.level, p.folder, p.shortName, updated);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLabel(shortName: string): string {
  return shortName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}
