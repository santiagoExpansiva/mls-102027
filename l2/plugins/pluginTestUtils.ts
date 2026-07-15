/// <mls fileReference="_102027_/l2/plugins/pluginTestUtils.ts" enhancement="_102027_/l2/enhancementLit" />

// Utilities shared by the plugins' *.test.ts files.
// See collabMyFiles/plugins.md ("Estratégia de testes dos plugins") for the full design.

/**
 * Where a test case can run:
 * - 'browser': needs real DOM/customElements (mounts the component, dispatches events, etc.).
 * - 'vscode': pure logic, runs without DOM (e.g. an exported function that only transforms data).
 * When in doubt, use 'browser' — it's the environment with full fidelity; 'vscode' is opt-in
 * only for logic proven to be DOM-independent.
 */
export type TestEnv = 'browser' | 'vscode';

export interface IPluginTestParams {
    input?: any;
    expected: any;
    /** When true, `compare` checks that `expected` is a subset of `actual` (useful for large/dynamic outputs). */
    contains?: boolean;
}

/**
 * Shape-compatible with `ICANTest` (tsTestAST.ts): same functionName/params pair,
 * with `env` added so the runner can decide where to execute each function.
 */
export interface IPluginTestCase {
    functionName: string;
    env: TestEnv;
    params: IPluginTestParams[];
}

const ENV_ORDER: Record<TestEnv, number> = { browser: 0, vscode: 1 };

/** Sorts tests so 'browser' comes before 'vscode' — use before running a batch. */
export function sortByEnvironment(tests: IPluginTestCase[]): IPluginTestCase[] {
    return [...tests].sort((a, b) => ENV_ORDER[a.env] - ENV_ORDER[b.env]);
}

export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof customElements !== 'undefined';
}

const mountedElements: HTMLElement[] = [];

interface IMlsBackupEntry {
    target: any;
    key: string;
    descriptor: PropertyDescriptor | undefined;
}

const mlsBackup: IMlsBackupEntry[] = [];

/**
 * Creates the element, applies properties, appends it to the document and waits for the first render.
 * Every call is tracked so `cleanup()` can remove it later — never forget to call cleanup().
 */
export async function mount<T extends HTMLElement = HTMLElement>(tag: string, props: Record<string, any> = {}): Promise<T> {
    if (!isBrowser()) throw new Error(`mount('${tag}') requires a browser environment (env: 'browser')`);
    const el = document.createElement(tag) as T;
    Object.assign(el, props);
    document.body.appendChild(el);
    mountedElements.push(el);
    if ('updateComplete' in el) await (el as any).updateComplete;
    return el;
}

/** Looks inside the shadow DOM if it exists, otherwise falls back to the light DOM (plugins vary between the two). */
export function query(el: Element, selector: string): Element | null {
    return el.shadowRoot?.querySelector(selector) ?? el.querySelector(selector);
}

/**
 * Replaces `mls.*` keys with mocked values; returns a function that restores the original state.
 * `cleanup()` also restores any pending override, so using only overrideMls is already safe
 * even if the test throws before manually calling the restorer.
 *
 * Several `mls.*` namespaces (e.g. `mls.stor`, and even leaves inside it like `mls.stor.getKeyToFiles`)
 * are exposed as getter-only accessors with no setter — a plain `mls.stor.getKeyToFiles = fn` throws
 * `Cannot set property getKeyToFiles of [object Object] which has only a getter`. To work regardless of
 * depth, every write goes through `Object.defineProperty` (which replaces the property descriptor
 * outright, bypassing the missing setter) instead of plain assignment.
 *
 * When both the current value and the override are plain objects, only the override's own keys are
 * replaced on the *existing* object — one level deep — instead of swapping the whole reference. E.g.
 * `overrideMls({ stor: { getKeyToFiles: fn } })` replaces just `mls.stor.getKeyToFiles`, leaving every
 * other property of the real `mls.stor` (and its many loaded files) untouched.
 */
export function overrideMls(overrides: Record<string, any>): () => void {
    for (const key of Object.keys(overrides)) {
        applyMlsOverride(mls as any, key, overrides[key]);
    }
    return restoreMls;
}

function applyMlsOverride(target: any, key: string, value: any): void {
    const current = target[key];
    if (isMergeableContainer(current) && isPlainOverride(value)) {
        for (const subKey of Object.keys(value)) {
            defineWithBackup(current, subKey, value[subKey]);
        }
        return;
    }
    defineWithBackup(target, key, value);
}

/** Objects and arrays can both be merged INTO (by key/index) — only the override side must be a plain object to trigger merging. */
function isMergeableContainer(value: any): boolean {
    return !!value && typeof value === 'object';
}

function isPlainOverride(value: any): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function defineWithBackup(target: any, key: string, value: any): void {
    mlsBackup.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
    Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: true });
}

function restoreMls(): void {
    while (mlsBackup.length) {
        const { target, key, descriptor } = mlsBackup.pop()!;
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else delete target[key];
    }
}

/** Removes every mounted element and undoes any pending `mls.*` overrides. Call at the end of each test (try/finally). */
export function cleanup(): void {
    while (mountedElements.length) {
        mountedElements.pop()?.remove();
    }
    restoreMls();
}

/**
 * Universal contract check (layer 1 of the strategy): element registered and renders without throwing.
 * Works for any of the 88 plugins, regardless of type.
 */
export async function mountAndVerify(tag: string, props: Record<string, any> = {}): Promise<{ registered: boolean; rendered: boolean }> {
    const registered = !!customElements.get(tag);
    const el = await mount(tag, props);
    const rendered = (el.shadowRoot?.childElementCount ?? 0) > 0 || el.childElementCount > 0;
    return { registered, rendered };
}

/**
 * Compares the actual value against the expected one (deep-equal with normalization) and throws
 * a formatted error on mismatch — keeps the "threw = failed" semantics of the ICAN runner.
 */
export function compare(actual: any, expected: any, opts: { contains?: boolean } = {}): void {
    const a = normalize(actual);
    const e = normalize(expected);
    if (opts.contains) {
        if (!isContainedIn(e, a)) throw new Error(formatDiff(a, e, true));
        return;
    }
    if (!deepEqual(a, e)) throw new Error(formatDiff(a, e, false));
}

function normalize(value: any): any {
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const key of Object.keys(value).sort()) out[key] = normalize(value[key]);
        return out;
    }
    return value;
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

function isContainedIn(partialExpected: any, actual: any): boolean {
    if (partialExpected && typeof partialExpected === 'object' && !Array.isArray(partialExpected)) {
        if (!actual || typeof actual !== 'object') return false;
        return Object.keys(partialExpected).every((k) => isContainedIn(partialExpected[k], actual[k]));
    }
    return deepEqual(partialExpected, actual);
}

function formatDiff(actual: any, expected: any, contains: boolean): string {
    return `Expected${contains ? ' (contains)' : ''}: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`;
}
