/// <mls fileReference="_102027_/l2/designSystemBase.ts" enhancement="_blank" />

import { collabImport } from '/_102027_/l2/collabImport.js';

export async function getTokens(project: number): Promise<IDesignSystemTokens[]> {
    const fileName = `./_${project}_designSystem`;
    const instance: IDesignSystem = await collabImport({ folder: '', project, shortName: 'designSystem' });
    if (!instance) throw new Error(`Invalid ds file: ${fileName}`);
    return instance.tokens || [];
}

export async function getTokensLess(project: number, theme: string): Promise<string> {
    const tokens = await getTokens(project)
    const tokenByTheme = tokens.find((item) => item.themeName === theme);
    if (!tokenByTheme) throw new Error(`no find theme: ${theme}`);
    let tokensLess = '';
    tokensLess += Object.keys(tokenByTheme.color).map((key) => {
        let token = '';
        if (!key.startsWith('_dark-')) token = `@${key}: ${tokenByTheme.color[key]};`
        return token;
    }).filter((item) => !!item).join('\n')
    tokensLess += '\n' + Object.keys(tokenByTheme.typography).map((key) => `@${key}: ${tokenByTheme.typography[key]};`).join('\n');
    tokensLess += '\n' + Object.keys(tokenByTheme.global).map((key) => `@${key}: ${tokenByTheme.global[key]};`).join('\n');
    return Promise.resolve(tokensLess);
}

export async function getTokensLessByTokensArray(tokens: IDesignSystemTokens[], theme: string): Promise<string> {

    const tokenByTheme = tokens.find((item) => item.themeName === theme);
    if (!tokenByTheme) throw new Error(`no find theme: ${theme}`);
    let tokensLess = '';
    tokensLess += Object.keys(tokenByTheme.color).map((key) => {
        let token = '';
        if (!key.startsWith('_dark-')) token = `@${key}: ${tokenByTheme.color[key]};`
        return token;
    }).filter((item) => !!item).join('\n')
    tokensLess += '\n' + Object.keys(tokenByTheme.typography).map((key) => `@${key}: ${tokenByTheme.typography[key]};`).join('\n');
    tokensLess += '\n' + Object.keys(tokenByTheme.global).map((key) => `@${key}: ${tokenByTheme.global[key]};`).join('\n');
    return Promise.resolve(tokensLess);
}


export async function getTokensCss(project: number, theme: string): Promise<string> {

    const tokens = await getTokens(project);
    const prefix = ':root';
    try {
        const tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) return '';
        const allTokens = { ...tokenInfo.color, ...tokenInfo.typography, ...tokenInfo.global };
        const darkAndLight = getDarkAndLight(allTokens);
        const cssVars = getCssVars(darkAndLight, prefix);
        const tokensCss = convertLessTokensToCss(cssVars, darkAndLight['root']);
        return tokensCss;
    } catch (err: any) {
        throw new Error(`Error on compile tokens Less: ${err.message}`);
    }
}


export async function getGlobalCss(project: number, theme: string): Promise<string> {
    let less = await getGlobalLess(project);
    less = less.replace(/project-\d+\s*{([\s\S]*)}$/m, "$1");
    const compiled = await preCompileLess(project, less, theme);
    return compiled;
}

export async function getGlobalLess(project: number): Promise<string> {

    const shortName = 'project';
    const folder = '';
    const key = mls.stor.getKeyToFiles(project, 2, shortName, folder, '.less');
    const storFile = mls.stor.files[key];
    if (!storFile) return '';
    let less = await storFile.getContent();
    if (!less || typeof less !== 'string') return '';
    return less;

}
export async function compileLess(str: string): Promise<string> {

    return new Promise((resolve, reject) => {
        if (!str || str.trim().length < 1) resolve('');
        mls.l2.less.compile(str).then(async (css) => {
            resolve(css);
        }).catch((err) => {
            reject(new Error('Error LESS: ' + err));
        });
    });
}

export async function preCompileLess(project: number, less: string, theme: string): Promise<string> {

    const tokens = await getTokens(project);
    const prefix = ':root';

    try {
        less = removeTokensFromSource(less);
        const tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) return '';
        const allTokens = { ...tokenInfo.color, ...tokenInfo.typography, ...tokenInfo.global };
        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(less, darkAndLight['root']);
        const tokensLess = await getTokensLess(project, theme);
        const res = await compileLess(`${newLess}\n${tokensLess}`)
        return res;
    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }

}

export async function preCompileLessAction(
    lessSource: string,
    tokens: IDesignSystemTokens[],
    theme: string
): Promise<string> {

    try {

        lessSource = removeTokensFromSource(lessSource);

        const tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) return '';

        const allTokens = {
            ...tokenInfo.color,
            ...tokenInfo.typography,
            ...tokenInfo.global
        };

        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(lessSource, darkAndLight['root']);
        const tokensLess = await getTokensLessByTokensArray(tokens, theme);

        const finalSource = `${newLess}\n${tokensLess}`;

        let lessEngine: any;

        //  Browser
        if (typeof window !== 'undefined' && (window as any).less) {
            lessEngine = (window as any).less;
        }
        //  Node (CommonJS ou ESM)
        else {
            const url = 'less';
            const lessModule = await import(url);
            lessEngine = lessModule.default || lessModule;
        }

        const res = await lessEngine.render(finalSource, {
            compress: false,
            filename: 'input.less'
        });

        return res.css;

    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }
}

export async function preCompileLessByThemeOrDefault(project: number, less: string, theme: string): Promise<string> {

    const tokens = await getTokens(project);
    const prefix = ':root';

    try {

        less = removeTokensFromSource(less);
        let tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) {
            tokenInfo = tokens.find((item) => item.themeName === 'Default');
            theme = 'Default';
        }
        if (!tokenInfo) throw new Error(`Not found tokens`);
        const allTokens = { ...tokenInfo.color, ...tokenInfo.typography, ...tokenInfo.global };
        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(less, darkAndLight['root']);
        const tokensLess = await getTokensLess(project, theme);
        const res = await compileLess(`${newLess}\n${tokensLess}`)
        return res;
    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }

}

function getDarkAndLight(allTokens: IKeyValueToken): IDarkLight {
    const themes: IDarkLight = {};

    Object.entries(allTokens).forEach((entry) => {
        const [key, value] = entry;
        const [theme] = key.split('-');
        let themeName = 'root';
        if (theme === '_dark') themeName = 'dark';
        if (!themes[themeName]) themes[themeName] = {};
        themes[themeName][key] = value;
    });

    return themes;
}

function getCssVars(themes: IDarkLight, prefix: ':host' | ':root') {
    const cssArr: string[] = [];
    Object.entries(themes).forEach((entry) => {
        const [key, value] = entry;
        if (key === 'root') {

            const cssVars: string[] = [];
            Object.entries(value).forEach((entryTokens) => {
                const [keyToken, valueToken] = entryTokens;
                const cssVar = `--${keyToken}: ${valueToken};`;
                cssVars.push(cssVar);
            });
            const cssFinal = `${prefix}{\n\t${cssVars.join('\n\t')}\n}`;
            cssArr.push(cssFinal);

        } else {

            const cssVars: string[] = [];
            Object.entries(value).forEach((entryTokensDark) => {
                const [keyToken, valueToken] = entryTokensDark;
                const tokenKey = keyToken.substring(1 + key.length + 1, keyToken.length);
                const cssVar = `--${tokenKey}: ${valueToken};`;
                cssVars.push(cssVar);
            });
            const cssFinal = `[data-theme="dark"] {\n\t${cssVars.join('\n\t')}\n}`;
            cssArr.push(cssFinal);
        }
    });

    return cssArr.join('\n');
}

function convertLessTokensToCss(less: string, tokens: IKeyValueToken): string {

    const lessTokens = new Set(Object.keys(tokens));
    return less.replace(/@([a-zA-Z0-9-_]+)/g, (match, token, offset, fullText) => {
        if (!lessTokens.has(token)) {
            return match;
        }

        const beforeText = fullText.slice(0, offset);
        const insideMediaQuery = /@media\s*\([^{}]*$/.test(beforeText);
        const lessFunctions = [
            "lighten", "darken", "saturate", "desaturate", "fadein", "fadeout", "fade",
            "spin", "mix", "tint", "shade", "contrast", "ceil", "floor", "round", "abs",
            "sqrt", "pow", "mod", "min", "max", "escape", "e", "unit", "convert",
            "extract", "length"
        ];

        const insideLessFunction = new RegExp(`(${lessFunctions.join("|")})\\s*\\([^()]*$`, "i").test(beforeText);
        if (insideMediaQuery || insideLessFunction) {
            return match;
        }

        return `var(--${token})`;
    });
}

export function removeTokensFromSource(src: string) {
    const regex = /\/\/Start Less Tokens[\s\S]*?\/\/End Less Tokens/g;
    return src.replace(regex, '');
}

export async function removeTokensTheme(project: number, themeName: string): Promise<void> {
    const actualTokens = await getTokens(project);
    const themeIndex = actualTokens.findIndex((theme) => theme.themeName === themeName);
    if (themeIndex === -1) return;
    actualTokens.splice(themeIndex, 1);
    await serializeTokens(project, actualTokens);
}

async function serializeTokens(project: number, tokens: IDesignSystemTokens[]) {
    const content = tokens.map(t => JSON.stringify(t, null, 4)).join(",\n\n");
    const key = mls.stor.getKeyToFiles(project, 2, 'designSystem', '', '.ts');
    const storFile = mls.stor.files[key];
    if (!storFile) return;

    const libCommon = await import('/_102027_/l2/libCommom.js');
    await libCommon.forceServiceInstance(2, '_100554_serviceSource');

    const serviceSource = mls.services['100554_serviceSource_left'];
    if (!serviceSource) throw new Error('Service source is not instancied');

    const libModel = await import('/_102027_/l2/libModel.js');
    const models = await libModel.createAllModels(storFile);
    if (!models || !models.ts) throw new Error(`Invalid models for file: ${project}_designSystem`);
    const newCode = replaceTokensBlock(models.ts.model.getValue(), `\n${content}\n`);
    serviceSource.setValueInModeKeepingUndo(models.ts.model, newCode, true);
}

export function replaceTokensBlock(code: string, newContent: string): string {
    const regex = /export\s+const\s+tokens\s*:\s*IDesignSystemTokens\[\]\s*=\s*\[[\s\S]*?\];?/g;
    return code.replace(regex, `export const tokens: IDesignSystemTokens[] = [\n${newContent}\n]`);
}

export interface IDesignSystemTokens {
    description: string,
    themeName: string,
    color: Record<string, string>,
    global: Record<string, string>,
    typography: Record<string, string>,
}

export interface IDesignSystem {
    tokens: IDesignSystemTokens[]
}

interface IKeyValueToken {
    [x: string]: string
}

export interface IDarkLight {
    [theme: string]: IKeyValueToken
}
