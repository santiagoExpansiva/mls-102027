/// <mls fileReference="_102027_/l2/wcTeste.ts" enhancement="_102027_enhancementLit" />

 import { html, LitElement } from 'lit'; 
import { customElement, property } from 'lit/decorators.js';
 import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
 
@customElement('wc-teste-102027')
 export class WcTeste100000 extends CollabLitElement {
    
     @property() name: string = 'Somebody';

     render() {
         return html`<p> Hello, ${ this.name } !</p>`;
     }
}
 