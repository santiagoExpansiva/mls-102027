/// <mls fileReference="_102027_/l2/libStor.ts" enhancement="_blank"/>

import { convertFileNameToTag } from '/_102027_/l2/utils';
import { createModel, createAllModels } from '/_102027_/l2/libModel.js'
import { getBaseTemplate, verifyNeedAddTripleslach } from '/_102027_/l2/libCommom.js';


export async function createStorFile(req: IReqCreateStorFile, needCreateModel: boolean, needCompile: boolean = true, awaitCompile: boolean = false): Promise<mls.stor.IFileInfo> {

    const params = {
        project: req.project,
        level: req.level,
        shortName: req.shortName,
        extension: req.extension,
        versionRef: '0',
        folder: req.folder
    };

    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[createStorFile] Invalid storFile');

    file.status = req.status ?? 'new';

    let source = req.source;
    if (req.level === 2) {
        source =  verifyNeedAddTripleslach(params, req.source, req.extension)
    }
    const fileInfo: mls.stor.IFileInfoValue = {
        content: source,
        contentType: 'string'
    };

    if (req.fileInfo) {
        fileInfo.originalFolder = req.fileInfo.originalFolder;
        fileInfo.originalProject = req.fileInfo.originalProject;
        fileInfo.originalShortName = req.fileInfo.originalShortName;
    }

    await mls.stor.localStor.setContent(file, fileInfo);

    if (needCreateModel) await createModel(file, needCompile, awaitCompile);

    // file.getModel = async () => _getModel(file);

    return file;

}

export async function createAllFiles(req: IReqCreateAllFiles, needCreateModel: boolean = true, awaitCompile: boolean = false): Promise<IRetAllFiles> {

    const { folder, shortName, project } = req;

    const template = await getBaseTemplate({ folder, shortName, project, extension: '.ts' }, req.enhancement);

    const templateHTML = await getBaseTemplate({ folder, shortName, project, extension: '.html' });

    const templateLess = await getBaseTemplate({ folder, shortName, project, extension: '.less' }, 'enhancementStyle');

    const templateTest = await getBaseTemplate({ folder, shortName, project, extension: '.test.ts' });

    const templateDefs = await getBaseTemplate({ folder, shortName, project, extension: '.defs.ts' });

    const newTSSource = req.tsSource || template;
    const newHTMLSource = req.htmlSource || templateHTML;
    const newLessSource = req.lessSource || templateLess;
    const newTestSource = req.testSource || templateTest;
    const newDefsSource = req.defsSource || templateDefs;

    const param: IReqCreateStorFile = {
        project: req.project,
        shortName: req.shortName,
        folder: req.folder,
        level: req.level,
        extension: '.ts',
        source: newTSSource,
        status: 'new'
    };

    const ret: IRetAllFiles = {
        ts: await safeCreate(param, false)
    }

    ret.html = await safeCreate({ ...param, extension: '.html', source: newHTMLSource }, false);
    ret.less = await safeCreate({ ...param, extension: '.less', source: newLessSource }, false);
    ret.test = await safeCreate({ ...param, extension: '.test.ts', source: newTestSource }, false);
    ret.def = await safeCreate({ ...param, extension: '.defs.ts', source: newDefsSource }, false);

    if (needCreateModel && ret.ts && !(ret.ts instanceof Error)) await createAllModels(ret.ts, true, awaitCompile);

    return ret;

}

export async function deleteFile(storFile: mls.stor.IFileInfo): Promise<void> {

    if (storFile.status === 'new') {
        await deleteFileSystem(storFile);
        return;
    }

    storFile.status = 'deleted';
    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);

    if (storFile.getValueInfo) {
        let valueInfo = mls.editor.models[keyToModel] ? await storFile.getValueInfo() : {} as mls.stor.IFileInfoValue;
        if (!valueInfo.content) {
            const src = await storFile.getContent() as string;
            valueInfo = {
                content: src,
                contentType: 'string',
                originalShortName: storFile.shortName,
                originalProject: storFile.project,
                originalCRC: mls.common.crc.crc32(src).toString(16)
            }
        }
        await mls.stor.localStor.setContent(storFile, valueInfo);
    }

}

export async function deleteAllFiles(storFile: mls.stor.IFileInfo): Promise<void> {

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        await deleteFile(mls.stor.files[key]);

    }

}

export async function renameFile(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<mls.stor.IFileInfo> {

    let source = await storFile.getContent() as string;
    if (!source) throw new Error('[renameFile] Impossible rename this file:' + storFile.shortName);

    //if (!newFolder) newFolder = storFile.folder;

    source = replaceTripleslashAndTag(storFile, newProject, newShortName, newFolder, source);

    const param: IReqCreateStorFile = {
        shortName: newShortName,
        project: newProject,
        folder: newFolder,
        level: storFile.level,
        source: source,
        extension: storFile.extension,
        status: storFile.status === 'new' ? 'new' : 'renamed',
        fileInfo: {
            originalFolder: storFile.folder,
            originalProject: storFile.project,
            originalShortName: storFile.shortName
        }
    }

    const needCreateModels = param.level === 2;
    const file = await createStorFile(param, needCreateModels, needCompile);
    await deleteFileSystem(storFile);

    return file;
}

export async function renameAllFiles(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<IRetAllFiles> {

    const ret: IRetAllFiles = {};

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts', '.json']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        const prop = mapExt[ext];
        ret[prop] = await safeRename(mls.stor.files[key], newProject, newShortName, newFolder, needCompile);

    }

    return ret;

}

export async function cloneFile(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<mls.stor.IFileInfo> {

    let source = await storFile.getContent() as string;
    if (!source) throw new Error('[cloneFile] Impossible rename this file:' + storFile.shortName);

    source = replaceTripleslashAndTag(storFile, newProject, newShortName, storFile.folder, source);

    const param: IReqCreateStorFile = {
        shortName: newShortName,
        project: newProject,
        folder: storFile.folder,
        level: storFile.level,
        source: source,
        extension: storFile.extension,
        status: 'new'
    }

    const file = await createStorFile(param, true);
    return file;

}

export async function cloneAllFiles(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<IRetAllFiles> {

    const ret: IRetAllFiles = {};

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;

        const prop = mapExt[ext];
        ret[prop] = await safeClone(mls.stor.files[key], newProject, newShortName);

    }

    return ret;

}

export async function undoFile(storFile: mls.stor.IFileInfo, removeProject: boolean = true): Promise<void> {

    storFile.getValueInfo = undefined;

    if (storFile.status === 'nochange' && !storFile.inLocalStorage) {
        return;
    }

    if (storFile.status === 'new') {
        await deleteFileSystem(storFile);
        return;
    }

    if (storFile.status === 'deleted') {
        storFile.status = 'nochange';
    }

    if (storFile.status === 'renamed') {
        await undoFileRenamed(storFile);
        return;
    }

    if (storFile.status === 'changed') {
        storFile.status = 'nochange';
        storFile.inLocalStorage = false;
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
        if (storFile.isLocalVersionOutdated && storFile.newVersionRefIfOutdated) {
            storFile.versionRef = storFile.newVersionRefIfOutdated;
            storFile.isLocalVersionOutdated = false;
            storFile.newVersionRefIfOutdated = undefined;
        }
    }

    if (storFile.inLocalStorage) {
        storFile.inLocalStorage = false;
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
    }

    const keyToModel = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    if (!mls.editor.models[keyToModel]) return;

    const prop = mapExtUndo[storFile.extension];
    if (prop && mls.editor.models[keyToModel]?.[prop]) {
        mls.editor.models[keyToModel][prop]?.model.dispose();
        delete mls.editor.models[keyToModel][prop];
    }

    if (removeProject && storFile) await mls.stor.localDB.removePrjInfo(storFile.project);

}

export async function undoAllFiles(storFile: mls.stor.IFileInfo): Promise<void> {

    for await (let ext of ['.ts', '.html', '.less', '.test.ts', '.defs.ts']) {

        const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, ext);

        if (!mls.stor.files[key]) continue;
        await undoFile(mls.stor.files[key], false);

    }

    await mls.stor.localDB.removePrjInfo(storFile.project);
    createAllModels(storFile, true, false, false)
}

function isNewNameValid(newShortName: string): boolean {
    if (newShortName.length === 0 || newShortName.length > 255) return false;
    const invalidCharacters = /[_\/{}\t\[\]\*$@#=\-+!|?,<>=.;^~º°""''``áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/;
    return (!invalidCharacters.test(newShortName));
}

//---------AUXILIARY FUNCTIONS AND DEFINITIONS-------------

const mapExt: Record<string, keyof IRetAllFiles> = {
    '.ts': 'ts',
    '.html': 'html',
    '.less': 'less',
    '.test.ts': 'test',
    '.defs.ts': 'def'
};

const mapExtUndo: Record<string, keyof typeof mls.editor.models[string]> = {
    '.ts': 'ts',
    '.html': 'html',
    '.less': 'style',
    '.test.ts': 'test',
    '.defs.ts': 'defs'
};

export function replaceTripleslashAndTag(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, src: string) {

    const { folder, project, shortName, level, extension } = storFile;

    const oldTag = convertFileNameToTag({ folder, project, shortName });
    const newTag = convertFileNameToTag({ folder: newFolder, project: newProject, shortName: newShortName });
    const fileReference = `_${newProject}_/l${level}/${newFolder ? newFolder + '/' : ''}${newShortName}${extension}`;
    const regex = new RegExp(oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');


    src = src.replace(/fileReference="[^"]*"/, `fileReference="${fileReference}"`).replace(/shortName="[^"]*"/, `shortName="${newShortName}"`).replace(/project="[^"]*"/, `project="${newProject}"`).replace(/folder="[^"]*"/, `folder="${newFolder}"`);
    return src.replace(regex, newTag);

}

async function deleteFileSystem(storFile: mls.stor.IFileInfo) {

    mls.editor.deleteModels(storFile.project, storFile.shortName, storFile.folder, true, storFile.level);
    const keyFiles = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);
    await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
    delete mls.stor.files[keyFiles];

}

async function safeCreate(param: IReqCreateStorFile, createMdl: boolean): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await createStorFile(param, createMdl);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function safeRename(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string, newFolder: string, needCompile: boolean = true): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await renameFile(storFile, newProject, newShortName, newFolder, needCompile);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function safeClone(storFile: mls.stor.IFileInfo, newProject: number, newShortName: string): Promise<mls.stor.IFileInfo | Error> {
    try {
        return await cloneFile(storFile, newProject, newShortName);
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
}

async function undoFileRenamed(storFile: mls.stor.IFileInfo) {

    if(!storFile.getValueInfo && (mls.stor.localDB as any).getContentInfoOrNull) storFile.getValueInfo = (mls.stor.localDB as any).getContentInfoOrNull

    const info = storFile.getValueInfo ? await storFile.getValueInfo() : {} as mls.stor.IFileInfoValue;

    if (!info.originalProject || !info.originalShortName)
        throw new Error('[undoFileRenamed] Not found info base for rename');

    const originalKey = mls.stor.getKeyToFiles(info.originalProject, storFile.level, info.originalShortName, info.originalFolder || storFile.folder, storFile.extension);

    const key = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);

    if (!mls.stor.files[originalKey]) {
        const params = {
            project: info.originalProject,
            level: storFile.level,
            shortName: info.originalShortName,
            extension: storFile.extension,
            versionRef: '0',
            folder: info.originalFolder || storFile.folder
        };
        await mls.stor.addOrUpdateFile(params);
    }

    if (mls.stor.files[key]) {
        await mls.stor.localStor.setContent(mls.stor.files[key], { contentType: 'string', content: null });
        delete mls.stor.files[key];
    }
}

//---------INTERFACE---------
export interface IReqCreateAllFiles {
    shortName: string,
    project: number,
    folder: string,
    enhancement: string,
    level: number,
    tsSource?: string,
    htmlSource?: string,
    lessSource?: string,
    testSource?: string,
    defsSource?: string,
}

export interface IReqCreateStorFile {
    shortName: string,
    project: number,
    folder: string,
    level: number,
    source: string,
    extension: string,
    status?: mls.stor.IFileInfoStatus,
    fileInfo?: {
        originalFolder: string;
        originalProject: number;
        originalShortName: string;
    }
}

export interface IRetAllFiles {
    ts?: mls.stor.IFileInfo | undefined | Error,
    html?: mls.stor.IFileInfo | undefined | Error,
    less?: mls.stor.IFileInfo | undefined | Error,
    def?: mls.stor.IFileInfo | undefined | Error,
    test?: mls.stor.IFileInfo | undefined | Error,
}