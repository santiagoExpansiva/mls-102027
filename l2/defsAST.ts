/// <mls fileReference="_102027_/l2/defsAST.ts" enhancement="_blank"/>

// ============================================================
// PARSE  –  extrai as 3 variáveis da string do arquivo
// ============================================================

export function parseDefsFile(source: string): {
  asis: mls.defs.AsIs;
  history: mls.defs.ChangeHistoryItem[];
  skill: string;
} {
  return {
    asis:    getAsis(source),
    history: getHistory(source),
    skill:   getSkill(source),
  };
}

// ============================================================
// ASIS  –  já é JSON puro, só extrai e faz JSON.parse
// ============================================================

export function getAsis(source: string): mls.defs.AsIs {
  const raw = extractBlock(source, 'asis', '{', '}');
  return JSON.parse(raw);
}

export function updateAsis(source: string, patch: DeepPartial<mls.defs.AsIs>): string {
  const current = getAsis(source);
  const updated = deepMerge(current, patch);
  return replaceVar(source, 'asis', JSON.stringify(updated, null, 2), 'export const asis: mls.defs.AsIs =');
}

export function replaceAsis(source: string, value: mls.defs.AsIs): string {
  return replaceVar(source, 'asis', JSON.stringify(value, null, 2), 'export const asis: mls.defs.AsIs =');
}

// ============================================================
// HISTORY  –  estilo TS (single-quotes, keys sem aspas), normaliza antes do parse
// ============================================================

export function getHistory(source: string): mls.defs.ChangeHistoryItem[] {
  const raw = extractBlock(source, 'history', '[', ']');
  return JSON.parse(normalizeTs(raw));
}

export function addHistoryItem(source: string, item: mls.defs.ChangeHistoryItem): string {
  const current = getHistory(source);
  current.push(item);
  return replaceVar(source, 'history', historyToTs(current), 'export const history: mls.defs.ChangeHistoryItem[] =');
}

export function updateHistoryItem(
  source: string,
  version: number,
  patch: Partial<mls.defs.ChangeHistoryItem>
): string {
  const current = getHistory(source);
  const idx = current.findIndex(h => h.version === version);
  if (idx === -1) throw new Error(`History version ${version} not found.`);
  current[idx] = { ...current[idx], ...patch };
  return replaceVar(source, 'history', historyToTs(current), 'export const history: mls.defs.ChangeHistoryItem[] =');
}

export function replaceHistory(source: string, value: mls.defs.ChangeHistoryItem[]): string {
  return replaceVar(source, 'history', historyToTs(value), 'export const history: mls.defs.ChangeHistoryItem[] =');
}


// ============================================================
// SKILL  –  template literal, extrai conteúdo entre backticks
// ============================================================

export function getSkill(source: string): string {
  const { content } = extractTemplateLiteral(source);
  return content;
}

export function updateSkill(source: string, value: string): string {
  const decl = 'export const skill =';
  const newLiteral = '`' + value + '`';
  if (!/export\s+const\s+skill\s*=/.test(source)) {
    return source.trimEnd() + '\n\n' + decl + ' ' + newLiteral + '\n';
  }
  const { start, end } = extractTemplateLiteral(source);
  return source.slice(0, start) + newLiteral + source.slice(end);
}

function extractTemplateLiteral(source: string): { content: string; start: number; end: number } {
  const match = /export\s+const\s+skill\s*=\s*`/.exec(source);
  if (!match) throw new Error('Variable "skill" not found in source.');
  const start = match.index + match[0].length - 1; // posição do backtick de abertura
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }  // escapes: \` ou qualquer outro
    if (source[i] === '`') {
      return {
        content: source.slice(start + 1, i),
        start,
        end: i + 1,
      };
    }
    i++;
  }
  throw new Error('Unterminated template literal for "skill".');
}

// ============================================================
// INTERNAL – substitui bloco da variável na string original
// ============================================================

function replaceVar(
  source: string,
  varName: string,
  newBlock: string,
  declaration: string
): string {
  const match = new RegExp(`export\\s+const\\s+${varName}[^=]*=\\s*`).exec(source);
  if (!match) {
    // variável não existe — cria no final do arquivo
    return source.trimEnd() + '\n\n' + declaration + '\n' + newBlock + '\n';
  }
  const start = match.index + match[0].length;
  const open  = source[start];
  const close = open === '{' ? '}' : ']';
  const old   = balancedSlice(source, start, open, close);
  return source.slice(0, start) + newBlock + source.slice(start + old.length);
}

// ============================================================
// INTERNAL – extrai bloco balanceado da variável
// ============================================================

function extractBlock(source: string, varName: string, open: string, close: string): string {
  const match = new RegExp(`export\\s+const\\s+${varName}[^=]*=\\s*`).exec(source);
  if (!match) throw new Error(`Variable "${varName}" not found in source.`);
  const start = match.index + match[0].length;
  if (source[start] !== open) throw new Error(`Expected "${open}" at start of "${varName}".`);
  return balancedSlice(source, start, open, close);
}

function balancedSlice(source: string, start: number, open: string, close: string): string {
  let depth = 0;
  let inStr = false;
  let strCh = '';
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === open)  depth++;
    if (ch === close) { if (--depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error('Unbalanced block.');
}

// ============================================================
// INTERNAL – normaliza TS → JSON (só para history)
// ============================================================

function normalizeTs(raw: string): string {
  return raw
    .replace(/,\s*([}\]])/g, '$1')                          // trailing commas
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // keys sem aspas
    .replace(/:\s*'([^']*)'/g, ': "$1"');                    // single-quote values
}

// ============================================================
// INTERNAL – serializa history de volta em estilo TS
// ============================================================

function historyToTs(items: mls.defs.ChangeHistoryItem[]): string {
  const lines = items.map(item => {
    const entries = Object.entries(item)
      .map(([k, v]) => `    ${k}: ${typeof v === 'number' ? v : `'${v}'`}`)
      .join(',\n');
    return `  {\n${entries}\n  }`;
  });
  return `[\n${lines.join(',\n')}\n]`;
}

// ============================================================
// TYPES / UTILS
// ============================================================

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge((target as any)[key] ?? {}, val as any);
    } else if (val !== undefined) {
      (result as any)[key] = val;
    }
  }
  return result;
}

// ============================================================
// MATERIALIZE INDEX  –  estilo TS (single-quotes, keys sem aspas)
// ============================================================

export function getMaterializeIndex(source: string): mls.defs.MaterializeIndex {
  const raw = extractBlock(source, 'materializeIndex', '[', ']');
  return JSON.parse(normalizeTs(raw));
}

export function replaceMaterializeIndex(source: string, value: mls.defs.MaterializeIndex): string {
  return replaceVar(
    source,
    'materializeIndex',
    materializeIndexToTs(value),
    'export const materializeIndex: mls.defs.MaterializeIndex =',
  );
}

export function addMaterializeItem(source: string, item: mls.defs.MaterializeEntry): string {
  const current = getMaterializeIndex(source);
  if (current.find((i) => i.id === item.id)) {
    throw new Error(`MaterializeItem with id "${item.id}" already exists.`);
  }
  current.push(item);
  return replaceMaterializeIndex(source, current);
}

export function updateMaterializeItem(
  source: string,
  id: string,
  patch: Partial<mls.defs.MaterializeEntry>,
): string {
  const current = getMaterializeIndex(source);
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error(`MaterializeItem with id "${id}" not found.`);
  current[idx] = { ...current[idx], ...patch };
  return replaceMaterializeIndex(source, current);
}

export function removeMaterializeItem(source: string, id: string): string {
  const current = getMaterializeIndex(source);
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) {
    throw new Error(`MaterializeItem with id "${id}" not found.`);
  }
  return replaceMaterializeIndex(source, filtered);
}

// ============================================================
// INTERNAL – serializa materializeIndex de volta em estilo TS
// ============================================================

function materializeIndexToTs(items: mls.defs.MaterializeIndex): string {
  const lines = items.map((item) => {
    const dependsOnTs = `[${item.dependsOn.map((d) => `'${d}'`).join(', ')}]`;
    return [
      '  {',
      `    id: '${item.id}',`,
      `    specVar: '${item.specVar}',`,
      `    outputPath: '${item.outputPath}',`,
      `    skillPath: '${item.skillPath}',`,
      `    agent: '${item.agent}',`,
      `    dependsOn: ${dependsOnTs},`,
      `    specUpdatedAt: '${item.specUpdatedAt}',`,
      '  }',
    ].join('\n');
  });
  return `[\n${lines.join(',\n')}\n]`;
}

// ============================================================
// AnyTextVariable  –  template literal, extrai conteúdo entre backticks
// ============================================================

export function getVariableText(source: string, varName: string): string {
  const { content } = extractTemplateLiteralByNameText(source, varName);
  return content;
}

export function updateVariableText(source: string, varName: string, value: string): string {
  const decl = `export const ${varName} =`;
  const newLiteral = '`' + value + '`';
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegex(varName)}\\s*=`);
  if (!pattern.test(source)) {
    return source.trimEnd() + '\n\n' + decl + ' ' + newLiteral + '\n';
  }
  const { start, end } = extractTemplateLiteralByNameText(source, varName);
  return source.slice(0, start) + newLiteral + source.slice(end);
}

function extractTemplateLiteralByNameText(
  source: string,
  varName: string
): { content: string; start: number; end: number } {
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegex(varName)}\\s*=\\s*\``);
  const match = pattern.exec(source);
  if (!match) throw new Error(`Variable "${varName}" not found in source.`);
  const start = match.index + match[0].length - 1;
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '`') {
      return {
        content: source.slice(start + 1, i),
        start,
        end: i + 1,
      };
    }
    i++;
  }
  throw new Error(`Unterminated template literal for "${varName}".`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// AnyTextJSON  –  template literal, extrai conteúdo entre backticks
// ============================================================


export function getVariableJson<T = unknown>(source: string, varName: string): T {
  const { content } = extractJsonByName(source, varName);
  return JSON.parse(content) as T;
}

export function updateVariableJson(source: string, varName: string, value: unknown): string {
  const decl = `export const ${varName} =`;
  const newJson = JSON.stringify(value, null, 2);
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegex(varName)}\\s*=`);
  if (!pattern.test(source)) {
    return source.trimEnd() + '\n\n' + decl + ' ' + newJson + '\n';
  }
  const { start, end } = extractJsonByName(source, varName);
  return source.slice(0, start) + newJson + source.slice(end);
}

function extractJsonByName(
  source: string,
  varName: string
): { content: string; start: number; end: number } {
  const pattern = new RegExp(`export\\s+const\\s+${escapeRegex(varName)}\\s*=\\s*([{\\[])`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`Variable "${varName}" not found in source.`);

  const start = match.index + match[0].length - 1; // posição do { ou [
  const openChar = match[1];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let i = start;

  while (i < source.length) {
    const ch = source[i];
    if (source[i - 1] !== '\\' && ch === '"') { inString = !inString; }
    if (!inString) {
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return {
            content: source.slice(start, i + 1),
            start,
            end: i + 1,
          };
        }
      }
    }
    i++;
  }
  throw new Error(`Unterminated JSON object/array for "${varName}".`);
}