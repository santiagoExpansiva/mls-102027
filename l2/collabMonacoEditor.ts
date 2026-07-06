/// <mls fileReference="_102027_/l2/collabMonacoEditor.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StateLitElement } from '/_102029_/l2/stateLitElement.js';

@customElement('collab-monaco-editor-102027')
export class CollabMonacoEditor extends StateLitElement {

    @property({ attribute: 'msize',  hasChanged: () => true }) msize: string = '';

    public mlsEditor: any;

    get isMls2(): boolean {
        return !!this.closest('collab-page');
    }

    render() { return nothing; }

    updated(changed: Map<PropertyKey, unknown>) {
        super.updated(changed);
        if (changed.has('msize')) this._onMsizeChange(this.msize);
    }

    private _onMsizeChange(msize: string) {
        const [width, height] = msize.split(',');
        if (!width || !height) return;
        if (this.mlsEditor && typeof this.mlsEditor.layout === 'function') {
            this.mlsEditor.layout({ width: +width, height: +height });
        }
    }
}
