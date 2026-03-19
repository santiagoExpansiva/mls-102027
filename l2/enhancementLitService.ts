/// <mls fileReference="_102027_/l2/enhancementLitService.ts" enhancement="_blank"/>

import {
    getDesignDetails as getDesignDetailsDefault,
    getDefaultHtmlExamplePreview as getDefaultHtmlExamplePreviewDefault,
    onAfterChange as onAfterChangeDefault,
    requires as requiresDefault,
} from '/_102027_/l2/enhancementLit.js';

import { injectStyle ,injectStyleAction } from '/_102027_/l2/processCssLit.js'

export const requires = requiresDefault;

export const getDefaultHtmlExamplePreview = (modelTS: mls.editor.IModelTS): string => {
    return getDefaultHtmlExamplePreviewDefault(modelTS)
}

export const getDesignDetails = (modelTS: mls.editor.IModelTS): Promise<mls.l2.enhancement.IDesignDetailsReturn> => {
    return getDesignDetailsDefault(modelTS);
}

export const onAfterChange = async (modelTS: mls.editor.IModelTS): Promise<void> => {
    return onAfterChangeDefault(modelTS);
};

export const onAfterCompile = async (modelTS: mls.editor.IModelTS): Promise<void> => {
    await injectStyle(modelTS, 'Default', '_102027_/l2/enhancementLitService');
    return;
}

export const onAfterCompileAction = async (sourceJS: string, sourceTS: string, css?: { sourceLess: string, sourceTokens: string }): Promise<string> => {
    return await injectStyleAction(sourceJS, sourceTS, css?.sourceLess || '', css?.sourceTokens || '', 'Default', '_102027_/l2/enhancementLitService');
}
