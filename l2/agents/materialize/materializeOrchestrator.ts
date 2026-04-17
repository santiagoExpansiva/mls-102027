/// <mls fileReference="_102027_/l2/agents/materialize/materializeOrchestrator.ts" enhancement="_blank"/>

import { getMaterializeIndex } from '/_102027_/l2/defsAST.js'
import { collabImport } from '/_102027_/l2/collabImport.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { createModelAnyFile } from '/_102027_/l2/libModel.js';

const cacheMaterializeOrchestrator = new Map<string, MaterializeOrchestrator>();

export function getMaterializeOrchestrator(defPath: string): MaterializeOrchestrator {
    if (!cacheMaterializeOrchestrator.has(defPath)) {
        const orchestrator = new MaterializeOrchestrator(defPath);
        orchestrator.onAllCompleted = () => {
            cacheMaterializeOrchestrator.delete(defPath);
        };
        cacheMaterializeOrchestrator.set(defPath, orchestrator);
    }
    return cacheMaterializeOrchestrator.get(defPath)!;
}

export class MaterializeOrchestrator {

    private jsonPath: string;
    private items: mls.defs.MaterializeEntry[];
    private completedIds: Set<string>;
    public onAllCompleted: (() => void) | null;

    constructor(jsonPath: string) {
        this.jsonPath = jsonPath;
        this.items = [];
        this.completedIds = new Set<string>();
        this.onAllCompleted = null;
    }

    async loadItems(): Promise<void> {

        const sfInfo = await mls.stor.convertFileReferenceToFile(this.jsonPath);
        if (!sfInfo) return;

        const key = mls.stor.getKeyToFile(sfInfo);
        const sf = mls.stor.files[key];
        if (!sf) return;

        const data = await sf.getContent() as string;
        this.items = getMaterializeIndex(data);
    }

    isAllCompleted(): boolean {
        return (
            this.items.length > 0 &&
            this.items.every((item) => this.completedIds.has(item.id))
        );
    }

    async process(trigger: OrchestratorTrigger): Promise<mls.defs.MaterializeEntry[]> {
        if (!this.items.length) await this.loadItems();

        if (trigger === 'init') {
            return this.items.filter((item) => item.dependsOn.length === 0);
        }

        this.completedIds.add(trigger);

        if (this.isAllCompleted()) {
            this.onAllCompleted?.();
            return [];
        }

        return this.items.filter((item) => {
            if (!item.dependsOn.includes(trigger)) return false;
            if (this.completedIds.has(item.id)) return false;
            if (item.dependsOn.length === 0) return false;
            return item.dependsOn.every((dep) => this.completedIds.has(dep));
        });
    }

    getStatus(): OrchestratorStatus {
        return {
            total: this.items.length,
            completed: this.completedIds.size,
            pending: this.items.length - this.completedIds.size,
            completedIds: [...this.completedIds],
            pendingIds: this.items
                .filter((item) => !this.completedIds.has(item.id))
                .map((item) => item.id),
            isAllCompleted: this.isAllCompleted(),
        };
    }

    reset(): void {
        this.completedIds.clear();
    }

    public async getSkill(path: string): Promise<string> {
        try {

            if (path.startsWith('/')) path = path.slice(1);

            const f = mls.stor.convertFileReferenceToFile(path);
            if (!f) return '';

            const module = await collabImport(f as any);

            if (!module) {
                console.info(`[getSkill]Módulo não registrado: ${path}`);
                return '';
            }

            let src = module.skill;

            return await this.processTemplate(src);

        } catch (err) {
            console.error(`Erro em ${path}`, err);
            return '';
        }
    }

    public async processTemplate(input: string): Promise<string> {
        const regex = /\[\[\((.*?)\)\.(.*?)\]\]/g;

        let result = input;

        const matches = [...input.matchAll(regex)];

        for (const match of matches) {
            const fullMatch = match[0];
            const filePath = match[1];
            const expression = match[2];

            const isFunction = expression.endsWith("()");
            const exportName = isFunction
                ? expression.replace("()", "")
                : expression;

            try {
                const f = mls.stor.convertFileReferenceToFile(filePath);
                if (!f) continue;
                const module = await collabImport(f as any);

                if (!module) {
                    console.info(`Módulo não registrado: ${filePath}`);
                    continue;
                }

                let replacement;

                if (isFunction) {
                    replacement = await module[exportName]();
                } else {
                    replacement = module[exportName];
                }

                result = result.replace(fullMatch, String(replacement));

            } catch (err) {
                console.error(`Erro em ${fullMatch}`, err);
            }
        }

        return result;
    }


    async processGroup(trigger: OrchestratorTrigger): Promise<GroupedByAgent> {
        if (!this.items.length) await this.loadItems();

        if (trigger === 'init') {
            return this.groupByAgent(this.items.filter((item) => item.dependsOn.length === 0));
        }

        this.completedIds.add(trigger);

        if (this.isAllCompleted()) {
            this.onAllCompleted?.();
            return {};
        }

        return this.groupByAgent(this.items.filter((item) => {
            if (!item.dependsOn.includes(trigger)) return false;
            if (this.completedIds.has(item.id)) return false;
            if (item.dependsOn.length === 0) return false;
            return item.dependsOn.every((dep) => this.completedIds.has(dep));
        }));
    }


    public groupByAgent(tasks: mls.defs.MaterializeEntry[]): GroupedByAgent {
        return tasks.reduce((acc, task) => {
            if (!acc[task.agent]) acc[task.agent] = [];
            acc[task.agent].push(task);
            return acc;
        }, {} as GroupedByAgent);
    }

    public async getVar(path:string, variable: string): Promise<string> {

        try {
            const f = mls.stor.convertFileReferenceToFile(path);
            if (!f) return '';
            const module = await collabImport(f as any);

            if (!module) {
                console.info(`Módulo não registrado: ${path}`);
                return '';
            }

            if (!module[variable]) {
                console.info(`Variable não registrado: ${path}; ${variable}`);
                return '';
            }
        

            let result = module[variable];

            if (typeof result === 'object') {
                return JSON.stringify(result);
            }

            return await this.processTemplate(result); 

        } catch (err) {
            console.error(`Erro em ${path}`, err);
            return '';
        }

    }

    public async createStorFile(fileRef: string, src: string): Promise<mls.stor.IFileInfo>{

        if (!fileRef.startsWith('_')) fileRef = `_${mls.actualProject || 0}_${fileRef}`;
        
        const info = mls.stor.convertFileReferenceToFile(fileRef);

        const k = mls.stor.getKeyToFile(info);

        let sf = mls.stor.files[k];

        if (!sf) {
            const param: IReqCreateStorFile = {
                ...info,
                source:src
            } 

            sf = await createStorFile(param, false, false, false);

        } else {

            if (!['.ts', '.less', '.defs.ts', '.test.ts'].includes(sf.extension)) {

                const m = await createModelAnyFile(sf);
                if (m && m.model) m.model.setValue(src);
                
            } else {

                const m = await sf.getOrCreateModel();
                if (m && m.model) m.model.setValue(src);
            }
        }

        return sf;
        
    }

}

export interface OrchestratorStatus {
    total: number;
    completed: number;
    pending: number;
    completedIds: string[];
    pendingIds: string[];
    isAllCompleted: boolean;
}



type GroupedByAgent = Record<string, mls.defs.MaterializeEntry[]>;

export type OrchestratorTrigger = 'init' | string;