/// <mls fileReference="_102027_/l2/plugins/pluginBase.ts" enhancement="_102027_/l2/enhancementLit" />

import { html, LitElement, TemplateResult } from 'lit';
import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
import { customElement, property, state } from 'lit/decorators.js';


@customElement('plugin-base-100554')
export abstract class PluginBase extends CollabLitElement {

    @property ({ type: String }) scope: string = "";

    abstract description: string;

    abstract getSvg(): TemplateResult;

}