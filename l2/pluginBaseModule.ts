/// <mls fileReference="_102027_/l2/pluginBaseModule.ts" enhancement="_blank"/>

import { property } from 'lit/decorators.js';
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';

export abstract class PluginBaseModule extends StateLitElement {

    @property() scope: 'detail' | 'dashboard' = 'dashboard';
    abstract render(): any;
    
}