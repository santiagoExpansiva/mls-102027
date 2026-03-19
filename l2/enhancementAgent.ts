/// <mls fileReference="_102027_/l2/enhancementAgent.ts" enhancement="_blank"/>

import { getPropierties } from '/_102027_/l2/propiertiesLit.js'

export const requires: mls.l2.enhancement.IRequire[] = []

export const getDesignDetails = async (
    modelTS: mls.editor.IModelTS
): Promise<mls.l2.enhancement.IDesignDetailsReturn> => {
    return {
        defaultGroupName: "",
        defaultHtmlExamplePreview: "",
        properties: getPropierties(modelTS),
        webComponentDependencies: []
    };
};

export const onAfterChange = async (modelTS: mls.editor.IModelTS): Promise<void> => {
}

export const onAfterCompile = async (modelTS: mls.editor.IModelTS): Promise<void> => {
    await injectSourceInJs(modelTS);
}

export const onAfterCompileAction = async (sourceJS: string, sourceTS: string): Promise<string> => {
    return injectSourceInJsAction(sourceJS, sourceTS);
}

/** 
 * search for regions on source TS, change .js references ex
 * const var1 = `xxx [[region1]]`
 * //#region region1
 * ...
 * //#endregion
 */
async function injectSourceInJs(modelTS: mls.editor.IModelTS): Promise<void> {
    if (!modelTS || !modelTS.compilerResults) return;
    let sourceJS: string = modelTS.compilerResults.prodJS;
    const sourceTS: string = modelTS.model.getValue();
    sourceJS = removeRegionsIntoJS(sourceJS);
    sourceJS = injectRegionsIntoTemplate({ sourceTS, sourceJS, warnUnusedRegions: true })
    let { project, shortName, folder, extension } = modelTS.storFile;
    const version = modelTS.compilerResults.cacheVersion;
    extension = extension.replace('.ts', '.js');
    modelTS.compilerResults.prodJS = sourceJS
    const url = await mls.stor.cache.addIfNeed({ project, folder, shortName, version, content: sourceJS, extension });
    modelTS.compilerResults.trace.push(`enhancementAgent, updated JS, cache url:${url}`)
}

async function injectSourceInJsAction(js: string, ts: string): Promise<string> {
    let sourceJS = removeRegionsIntoJS(js);
    sourceJS = injectRegionsIntoTemplate({ sourceTS: ts, sourceJS, warnUnusedRegions: true });
    return sourceJS;
}


/**
 * Replaces [[REGION_NAME]] placeholders in the template with the actual content
 * from //#region REGION_NAME blocks in the source TypeScript file.
 * 
 * Throws clear errors if:
 * - A region is opened but not closed
 * - Regions are nested
 * - Region name is duplicated
 * - A placeholder exists but no matching region
 * - A region exists but no placeholder uses it (optional, can be disabled)
 */
function injectRegionsIntoTemplate(
    args: {
        sourceTS: string,
        sourceJS: string,
        warnUnusedRegions: boolean
    }
): string {
    const regions = new Map<string, string>();
    let currentRegion: string | null = null;
    const lines = args.sourceTS.split('\n');

    // 1. Extract regions from TS
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();

        if (trimmed.startsWith('//#region')) {
            const match = line.match(/\/\/\s*#region\s+([\w-]+)/);
            if (!match) {
                throw new Error(`Invalid //#region syntax at line ${i + 1}`);
            }
            const name = match[1];
            if (currentRegion !== null) {
                throw new Error(`Nested //#region "${name}" inside "${currentRegion}" at line ${i + 1}`);
            }
            if (regions.has(name)) {
                throw new Error(`Duplicate //#region "${name}" at line ${i + 1}`);
            }
            currentRegion = name;
            regions.set(name, '');
            continue;
        }

        if (trimmed.startsWith('//#endregion')) {
            if (currentRegion === null) {
                throw new Error(`Unexpected //#endregion at line ${i + 1}`);
            }
            currentRegion = null;
            continue;
        }

        if (currentRegion !== null) {
            if (line.includes('`')) {
                throw new Error(
                    `Invalid character \` inside //#region "${currentRegion}". ` +
                    `Regions injected into JS templates must not contain backticks.`
                );
            }
            regions.set(currentRegion, regions.get(currentRegion)! + line + '\n');
        }
    }

    if (currentRegion !== null) {
        throw new Error(`Unclosed //#region "${currentRegion}" at end of file`);
    }

    // 2. Replace placeholders in JS
    const used = new Set<string>();
    const result = args.sourceJS.replace(/\[\[([\w-]+)\]\]/g, (full, name: string) => {
        if (!regions.has(name)) {
            throw new Error(`Placeholder [[${name}]] not found in source regions`);
        }
        used.add(name);
        return regions.get(name)!.trimEnd();
    });

    // 3. Warn unused regions (optional)
    if (args.warnUnusedRegions) {
        for (const name of regions.keys()) {
            if (!used.has(name)) {
                console.warn(`Warning: //#region ${name} defined but not used`);
            }
        }
    }

    return result;
}

function removeRegionsIntoJS(
    sourceJS: string
): string {
    return sourceJS.replace(
        /\/\/\s*#region[\s\S]*?\/\/\s*#endregion/g,
        ''
    );
}
