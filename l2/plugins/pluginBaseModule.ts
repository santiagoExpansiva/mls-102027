/// <mls fileReference="_102027_/l2/plugins/pluginBaseModule.ts" enhancement="_100554_/l2/enhancementLit" />


import { property } from 'lit/decorators.js';
import { StateLitElement } from '/_102029_/l2/stateLitElement.js';

export abstract class PluginBaseModule extends StateLitElement {

    @property() scope: 'detail' | 'dashboard' = 'dashboard';
    abstract render(): any;
    
}
