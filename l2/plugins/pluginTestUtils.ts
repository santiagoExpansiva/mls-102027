/// <mls fileReference="_102027_/l2/plugins/pluginTestUtils.ts" enhancement="_102027_/l2/enhancementLit" />

// Utilitários compartilhados pelos arquivos *.test.ts dos plugins.
// Ver collabMyFiles/plugins.md ("Estratégia de testes dos plugins") para o desenho completo.

/**
 * Onde o caso de teste pode ser executado:
 * - 'browser': precisa de DOM/customElements reais (monta o componente, dispara eventos etc.).
 * - 'vscode': lógica pura, roda sem DOM (ex.: uma função exportada que só transforma dados).
 * Na dúvida, use 'browser' — é o ambiente com fidelidade total; 'vscode' é opt-in só para
 * lógica comprovadamente independente de DOM.
 */
export type TestEnv = 'browser' | 'vscode';

export interface IPluginTestParams {
    input?: any;
    expected: any;
    /** Quando true, `comparar` valida que `expected` é um subconjunto de `atual` (útil para saídas grandes/dinâmicas). */
    contains?: boolean;
}

/**
 * Compatível em formato com `ICANTest` (tsTestAST.ts): mesma dupla functionName/params,
 * com `env` a mais para o runner decidir onde executar cada função.
 */
export interface IPluginTestCase {
    functionName: string;
    env: TestEnv;
    params: IPluginTestParams[];
}

const ORDEM_ENV: Record<TestEnv, number> = { browser: 0, vscode: 1 };

/** Ordena testes priorizando 'browser' antes de 'vscode' — usar antes de executar em lote. */
export function ordenarPorAmbiente(testes: IPluginTestCase[]): IPluginTestCase[] {
    return [...testes].sort((a, b) => ORDEM_ENV[a.env] - ORDEM_ENV[b.env]);
}

export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof customElements !== 'undefined';
}

const elementosMontados: HTMLElement[] = [];
const mlsBackup: { key: string; value: any; existia: boolean }[] = [];

/**
 * Cria o elemento, aplica propriedades, anexa ao document e espera o primeiro render.
 * Cada chamada fica registrada para `cleanup()` remover depois — nunca esqueça de chamar cleanup().
 */
export async function mount<T extends HTMLElement = HTMLElement>(tag: string, props: Record<string, any> = {}): Promise<T> {
    if (!isBrowser()) throw new Error(`mount('${tag}') exige ambiente browser (env: 'browser')`);
    const el = document.createElement(tag) as T;
    Object.assign(el, props);
    document.body.appendChild(el);
    elementosMontados.push(el);
    if ('updateComplete' in el) await (el as any).updateComplete;
    return el;
}

/** Busca no shadow DOM se existir, senão cai para o light DOM (plugins variam entre os dois). */
export function query(el: Element, selector: string): Element | null {
    return el.shadowRoot?.querySelector(selector) ?? el.querySelector(selector);
}

/**
 * Troca chaves de `mls.*` por valores mockados; devolve uma função que restaura o estado original.
 * `cleanup()` também restaura qualquer troca pendente, então usar apenas trocarMls já é seguro
 * mesmo se o teste lançar antes de chamar o restaurador manualmente.
 */
export function trocarMls(overrides: Record<string, any>): () => void {
    const chaves = Object.keys(overrides);
    for (const key of chaves) {
        const existia = key in (mls as any);
        mlsBackup.push({ key, value: (mls as any)[key], existia });
        (mls as any)[key] = overrides[key];
    }
    return restaurarMls;
}

function restaurarMls(): void {
    while (mlsBackup.length) {
        const { key, value, existia } = mlsBackup.pop()!;
        if (existia) (mls as any)[key] = value;
        else delete (mls as any)[key];
    }
}

/** Remove todos os elementos montados e desfaz trocas de `mls.*` pendentes. Chamar ao fim de cada teste (try/finally). */
export function cleanup(): void {
    while (elementosMontados.length) {
        elementosMontados.pop()?.remove();
    }
    restaurarMls();
}

/**
 * Checagem universal de contrato (camada 1 da estratégia): elemento registrado e renderiza sem exceção.
 * Serve para qualquer um dos 88 plugins, independente do tipo.
 */
export async function montarEVerificar(tag: string, props: Record<string, any> = {}): Promise<{ registrado: boolean; renderizou: boolean }> {
    const registrado = !!customElements.get(tag);
    const el = await mount(tag, props);
    const renderizou = (el.shadowRoot?.childElementCount ?? 0) > 0 || el.childElementCount > 0;
    return { registrado, renderizou };
}

/**
 * Compara o valor obtido com o esperado (deep-equal com normalização) e lança um erro
 * formatado em caso de divergência — mantém a semântica "lançou = falhou" do runner ICAN.
 */
export function comparar(atual: any, expected: any, opts: { contains?: boolean } = {}): void {
    const a = normalizar(atual);
    const e = normalizar(expected);
    if (opts.contains) {
        if (!contido(e, a)) throw new Error(formatarDiff(a, e, true));
        return;
    }
    if (!deepEqual(a, e)) throw new Error(formatarDiff(a, e, false));
}

function normalizar(valor: any): any {
    if (typeof valor === 'string') return valor.replace(/\s+/g, ' ').trim();
    if (Array.isArray(valor)) return valor.map(normalizar);
    if (valor && typeof valor === 'object') {
        const out: Record<string, any> = {};
        for (const key of Object.keys(valor).sort()) out[key] = normalizar(valor[key]);
        return out;
    }
    return valor;
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (typeof a === 'object') {
        const ka = Object.keys(a), kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every((k) => deepEqual(a[k], b[k]));
    }
    return false;
}

function contido(esperadoParcial: any, atual: any): boolean {
    if (esperadoParcial && typeof esperadoParcial === 'object' && !Array.isArray(esperadoParcial)) {
        if (!atual || typeof atual !== 'object') return false;
        return Object.keys(esperadoParcial).every((k) => contido(esperadoParcial[k], atual[k]));
    }
    return deepEqual(esperadoParcial, atual);
}

function formatarDiff(atual: any, expected: any, contains: boolean): string {
    return `Esperado${contains ? ' (contém)' : ''}: ${JSON.stringify(expected)}\nObtido: ${JSON.stringify(atual)}`;
}
