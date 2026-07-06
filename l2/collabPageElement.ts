/// <mls fileReference="_102027_/l2/collabPageElement.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, PropertyValueMap, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { StateLitElement } from '/_102029_/l2/stateLitElement.js';
import { convertTagToFileName } from '/_102027_/l2/utils.js';

export const PREFIX_ICA_ID = 'ica_';

export function toPascalCase(str: string) {
    return str.replace(/(^\w|-\w)/g, match => match.replace('-', '').toUpperCase());
}

export abstract class CollabPageElement extends StateLitElement {

    abstract initPage(): void

    @property({ type: String, reflect: true }) modeoverlay: string = '';

    @property() initPageComplete: boolean = false;

    @property({ type: String, reflect: true }) level: string = window.mls && mls.actualLevel ? mls.actualLevel.toString() :  '7';

    public overlay: any | undefined;

    public isPage = true;

    public recreateOverlay() {
        this.overlay?.remove();
        this.overlay = undefined;
        this.createOverlay();
    }

    public refreshOverlay() {
        this.checkToAddOverlay();
    }

    constructor() {
        super();
    }

    //--------COMPONENT------------

    createRenderRoot() {
        return this; // dont use shadow root
    }

    async firstUpdated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);
        setTimeout(() => {
            this.checkToAddOverlay();
        }, 500);

        //this.setupIds();
        // this.setupEvents();
        await this.initPage();
        this.initPageComplete = true;

    }

    updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has('level') && changedProperties.get('level') !== undefined) {
            this.checkToAddOverlay();
        }
    }

    render() {
        this.style.position = 'relative';
        return html``;
    }

    //--------IMPLEMENTS------------


    private setupIds(): void {
        const icas = this.findAllElementsIca(this);
        icas.forEach((item) => {
            const oldId = item.element.id;
            const icaId = `${PREFIX_ICA_ID}${item.element.id}`;
            item.element.setAttribute('id', icaId);
            item.element.setAttribute('idel', oldId);
        });

    }

    private checkToAddOverlay(): void {

        if (this.level === '7') {
            this.overlay?.remove();
            this.overlay = undefined;
            return;
        }

        if (this.overlay) {
            this.overlay.setAttribute('level', this.level)
            this.overlay.changeOverlayItemsLevel();
            return;
        }

        this.createOverlay();
    }

    private async createOverlay() {

        if (!this.modeoverlay) return;
        const ok = await this.importWCDOverlay(this.modeoverlay);
        if (!ok) return;
        this.overlay = document.createElement(this.modeoverlay) as any;
        this.overlay.myItens = this.findAllElementsIca(this);
        this.overlay.createOverlayItems();
        this.appendChild(this.overlay as HTMLElement);
        mls.events.fire(3, 'WCDEventChange' as any,JSON.stringify({op:'recreateOverlay'}));

    }

    private hasImport: string[] = [];
    private async importWCDOverlay(imports: string) {

        try {

            if (this.hasImport.includes(imports)) return true;
            const info = convertTagToFileName(imports);
            if (!info) return;
            imports = `_${info.project}_/l2/${info.shortName}`;
            if (!imports.startsWith('./')) {
                imports = '/' + imports;                
            }
            await import(imports);
            this.hasImport.push(imports);
            return true;

        } catch (e) {
            console.info(e);
            return false
        }

    }

    private findAllElementsIca(el: HTMLElement): ElDepths[] {
        let elements: ElDepths[] = [];
        let elToSearch: Element | ShadowRoot = el;

        const arrayEls: HTMLElement[] = [];

        function traverseShadowRoot(element: HTMLElement, depth: number) {

            if (element.getAttribute('mls_origin') && !arrayEls.includes(element)) {
                const { x, y, height, width } = element.getBoundingClientRect();
                elements.push({ element: element as LitElementBaseMethods, depth, x, y, height, width, opacity: element.style.opacity });
                arrayEls.push(element);
                return;
            }
            if (element.shadowRoot) {
                element.shadowRoot.querySelectorAll('*').forEach((item) => {
                    traverseShadowRoot(item as HTMLElement, depth + 1);
                });
            } else {
                const children = Array.from(element.children);
                if (children.length > 0) {
                    children.forEach(child => traverseShadowRoot(child as HTMLElement, depth + 1));
                }
            }
        }



        if (el.shadowRoot)
            elToSearch = el.shadowRoot;
        elToSearch.querySelectorAll('*').forEach((item) => {
            traverseShadowRoot(item as HTMLElement, 0); // Inicializar com profundidade 0
        });

        return elements;

    }

}

interface ElDepths {
    element: LitElementBaseMethods,
    depth: number,
    x: number,
    y: number,
    height: number,
    width: number,
    opacity: string,
}

export interface LitElementBaseMethods extends LitElement {
    level: '1' | '2' | '3' | '4' | '5' | '6' | '7' | undefined;
    globalVariation: number | undefined;
    //widget: string | undefined;
    baseName: string;
    overlayRef: HTMLElement | undefined;
    mySymbol: string;
    getActionsTags(): ActionTag[];
}

interface ActionTag {
    name: string; // tag name or component name
    position?: 'p-l0' | 'p-l1' | 'p-l2' | 'p-l3' | 'p-l4' | 'p-m0' | 'p-m1' | 'p-m2' | 'p-m3' | 'p-m4' | 'p-r0' | 'p-r1' | 'p-r2' | 'p-r3' | 'p-r4' | 'p-title' | 'p-title-top' | '' ; // suggestion of position, WCD will define
    args?: string; // optional args string, can be a JSON string
    level?: number[]; // levels where this will be visible
    toolboxOptions?: IToolboxOptions
}

export interface IToolboxOptions {
    background?: string,
    border?: string,
}