/// <mls fileReference="_102027_/l2/pluginBase.ts" enhancement="_102027_/l2/enhancementLit"/>

import { html, LitElement, TemplateResult } from 'lit';
import { CollabLitElement } from '/_102027_/l2/collabLitElement.js';
import { customElement, property, state } from 'lit/decorators.js';


@customElement('plugin-base-102027')
export abstract class PluginBase extends CollabLitElement {

    @property ({ type: String }) scope: string = "";

    abstract description: string;

    abstract getSvg(): TemplateResult;

}