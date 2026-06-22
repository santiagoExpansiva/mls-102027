/// <mls fileReference="_102027_/l2/agentMaterializeSolution/ast/astCollab.ts" enhancement="_blank"/>

// Target file: _${project}_/l0/config.json
//
// Manipulates two dynamic arrays inside
// projects[projectId].modules[moduleId]:
//
//   "navigation": [
//     { "id": "cardapioEstoque", "label": "...", "href": "...", "description": "..." }
//   ],
//   "frontend": {
//     "pages": [
//       { "pageId": "cardapioEstoque", "route": "...", "source": "...",
//         "definition": "...", "componentTag": "..." }
//     ]
//   }

// ============================================================
// TYPES
// ============================================================

export interface CollabNavEntry {
  id: string;
  label: string;
  href: string;
  description: string;
}

export interface CollabPageEntry {
  pageId: string;
  route: string;
  source: string;
  definition: string;
  componentTag: string;
}

// ============================================================
// NAVIGATION
// ============================================================

export function getNavigation(
  source: string,
  projectId: string,
  moduleId: string,
): CollabNavEntry[] {
  const obj = parse(source);
  return findModule(obj, projectId, moduleId)?.navigation ?? [];
}

export function hasNavigation(
  source: string,
  projectId: string,
  moduleId: string,
  id: string,
): boolean {
  return getNavigation(source, projectId, moduleId).some(n => n.id === id);
}

export function addNavigation(
  source: string,
  projectId: string,
  moduleId: string,
  entry: CollabNavEntry,
  throwIfExists = false,
): string {
  if (hasNavigation(source, projectId, moduleId, entry.id)) {
    if (throwIfExists) throw new Error(`Nav id "${entry.id}" already exists.`);
    return source;
  }
  const obj = parse(source);
  const mod = requireModule(obj, projectId, moduleId);
  if (!Array.isArray(mod.navigation)) mod.navigation = [];
  mod.navigation.push(entry);
  return serialize(obj);
}

export function removeNavigation(
  source: string,
  projectId: string,
  moduleId: string,
  id: string,
): string {
  const obj = parse(source);
  const mod = requireModule(obj, projectId, moduleId);
  if (!Array.isArray(mod.navigation)) return source;
  mod.navigation = mod.navigation.filter((n: CollabNavEntry) => n.id !== id);
  return serialize(obj);
}

// ============================================================
// PAGES
// ============================================================

export function getPages(
  source: string,
  projectId: string,
  moduleId: string,
): CollabPageEntry[] {
  return findModule(parse(source), projectId, moduleId)?.frontend?.pages ?? [];
}

export function hasPage(
  source: string,
  projectId: string,
  moduleId: string,
  pageId: string,
): boolean {
  return getPages(source, projectId, moduleId).some(p => p.pageId === pageId);
}

export function addPage(
  source: string,
  projectId: string,
  moduleId: string,
  entry: CollabPageEntry,
  throwIfExists = false,
): string {
  if (hasPage(source, projectId, moduleId, entry.pageId)) {
    if (throwIfExists) throw new Error(`Page "${entry.pageId}" already exists.`);
    return source;
  }
  const obj = parse(source);
  const mod = requireModule(obj, projectId, moduleId);
  if (!mod.frontend || typeof mod.frontend !== 'object') mod.frontend = {};
  if (!Array.isArray(mod.frontend.pages)) mod.frontend.pages = [];
  mod.frontend.pages.push(entry);
  return serialize(obj);
}

export function removePage(
  source: string,
  projectId: string,
  moduleId: string,
  pageId: string,
): string {
  const obj = parse(source);
  const mod = requireModule(obj, projectId, moduleId);
  if (!mod.frontend?.pages) return source;
  mod.frontend.pages = mod.frontend.pages.filter((p: CollabPageEntry) => p.pageId !== pageId);
  return serialize(obj);
}

// ============================================================
// INTERNAL
// ============================================================

function parse(source: string): any {
  try {
    return JSON.parse(source);
  } catch (e) {
    throw new Error(`[astCollab] invalid JSON: ${(e as Error).message}`);
  }
}

function serialize(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

function findModule(obj: any, projectId: string, moduleId: string): any | null {
  const modules: any[] = obj?.projects?.[projectId]?.modules;
  if (!Array.isArray(modules)) return null;
  return modules.find((m: any) => m.moduleId === moduleId) ?? null;
}

function requireModule(obj: any, projectId: string, moduleId: string): any {
  const mod = findModule(obj, projectId, moduleId);
  if (!mod) throw new Error(`[astCollab] module "${moduleId}" not found in project "${projectId}"`);
  return mod;
}


// ============================================================
// USE CASE
// ============================================================

/*

test('add + remove navigation', () => {
  let out = addNavigation(SRC, '102043', 'cafeFlow', {
    id: 'newPage',
    label: 'Nova Página',
    href: '/cafe-flow/nova',
    description: 'Descrição.',
  });
  eq(getNavigation(out, '102043', 'cafeFlow').length, prevLen + 1);

  out = removeNavigation(out, '102043', 'cafeFlow', 'newPage');
  eq(getNavigation(out, '102043', 'cafeFlow').length, prevLen);
});

test('add + remove page', () => {
  let out = addPage(SRC, '102043', 'cafeFlow', {
    pageId: 'newPage',
    route: '/cafe-flow/nova',
    source: 'l2/cafeFlow/novaPage.ts',
    definition: 'l2/cafeFlow/novaPage.defs.ts',
    componentTag: 'cafe-flow-nova-page-102043',
  });
  eq(getPages(out, '102043', 'cafeFlow').length, prevLen + 1);

  out = removePage(out, '102043', 'cafeFlow', 'newPage');
  eq(getPages(out, '102043', 'cafeFlow').length, prevLen);
});

*/
