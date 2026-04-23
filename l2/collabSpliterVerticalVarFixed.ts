/// <mls fileReference="_102027_/l2/collabSpliterVerticalVarFixed.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html, svg, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('collab-spliter-vertical-var-fixed-102027')
export class CollabSpliterVerticalVarFixed extends LitElement {

    @property({ type: String }) fixedheight = '0';
    @property({ type: String }) complementcolor = '#000';
    @property({ type: Number }) spliterHeight = 20;
    @property({ type: String }) withresize = 'true';

    @property({ type: String }) actualfixedheight = this.fixedheight;
    @property({ type: String }) msize = '';
    @property() isBottomPaneOpen: boolean = true;

    @query('[slot="top"]') slotTop: HTMLElement | undefined;
    @query('[slot="bottom"]') slotBottom: HTMLElement | undefined;


    private resizeObserver?: ResizeObserver;

    private collab_chevron_down = svg`
    <svg width="12" height="12" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>
`;

    createRenderRoot() {
        return this;
    }

    updated(changedProperties: Map<string | number | symbol, unknown>) {

        if (changedProperties.has('msize')) this._applyMSize();

        if (changedProperties.has('fixedheight')) {
            this.actualfixedheight = this.fixedheight;
            this.style.setProperty('--fixed-height', this.fixedheight + 'px');
            if (this.isBottomPaneOpen) {
                this.style.setProperty('--bottom-pane-height', this.fixedheight + 'px');
            }
            this.updatePanelsMSize();
        }

        if (changedProperties.has('complementcolor')) {
            this.style.setProperty('--complement-color', this.complementcolor);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.resizeObserver) this.resizeObserver.disconnect();
    }

    firstUpdated() {
        this._distributeContent();
        this._applyMSize();
    }

    private getMSize() {
        const [w, h, t, l] = this.msize.split(',');
        return {
            heigth: h,
            width: w,
            top: t,
            left: l
        }
    }

    private getMSizeTop() {
        const msize = this.getMSize();
        let newHeight: string = '';
        let newMsize: string[] = [];

        if (this.withresize === 'true') newHeight = (+(msize.heigth) - (+this.actualfixedheight) - (this.spliterHeight)).toString();
        else newHeight = (+(msize.heigth) - (+this.actualfixedheight)).toString();

        newMsize = [msize.width, `${newHeight}`, msize.top, msize.left];
        return newMsize.join(',');
    }

    private getMSizeBottom() {
        const msize = this.getMSize();
        let newHeight: string = '';
        let newMsize: string[] = [];
        newHeight = this.actualfixedheight;
        newMsize = [msize.width, `${newHeight}`, msize.top, msize.left];
        return newMsize.join(',');
    }

    public updatePanelsMSize() {

        this.forceRefreshMsize(this.slotTop);
        this.forceRefreshMsize(this.slotBottom);

        setTimeout(() => {
            this.slotTop?.setAttribute('msize', this.getMSizeTop());
            this.slotBottom?.setAttribute('msize', this.getMSizeBottom());
        }, 50)

    }

    private forceRefreshMsize(el: HTMLElement | undefined) {
        if (!el) return;
        const msize = el.getAttribute('msize');
        if (!msize) return;
        let [w, h, t, l] = msize.split(',');
        l = ((+l) + 1).toString();
        el.setAttribute('msize', [w, h, t, l].join(','))

    }

    _applyMSize() {
        const [maxWidth, maxHeight] = this.msize.split(',').map(Number);
        if (!isNaN(maxHeight) && !isNaN(maxWidth)) {
            this.style.setProperty('--max-width', `${maxWidth}px`);
            this.style.setProperty('--max-height', `${maxHeight}px`);
        }
        this.updatePanelsMSize();
    }

    _onSpliterClick(event: MouseEvent) {
        const spliter = event.target as HTMLElement;
        const button = spliter.closest('.spliter-button')

        if (button) {
            const bottomPane = this.querySelector('.bottom-pane') as HTMLElement;
            this.isBottomPaneOpen = !this.isBottomPaneOpen;
            if (this.isBottomPaneOpen) {
                bottomPane.classList.remove('closed');
                button.classList.remove('closed');
                this.actualfixedheight = this.fixedheight;
                this.style.setProperty('--bottom-pane-height', this.fixedheight + 'px');
            } else {
                this.actualfixedheight = '0';
                bottomPane.classList.add('closed');
                button.classList.add('closed');
                this.style.setProperty('--bottom-pane-height', '0px');
            }
            this.updatePanelsMSize();
        }
    }

    timeoutResize: number | undefined;


    _distributeContent() {
        const topPane = this.querySelector('.top-pane');
        const bottomPane = this.querySelector('.bottom-pane');
        const children = Array.from(this.children);
        let msizeNew: string = this.msize;

        children.forEach(child => {
            const slotName = child.getAttribute('slot');

            if (slotName === 'top' && topPane) {
                topPane.appendChild(child);
                msizeNew = this.getMSizeTop();
                child.setAttribute('msize', msizeNew);
            } else if (slotName === 'bottom' && bottomPane) {
                msizeNew = this.getMSizeBottom();
                child.setAttribute('msize', msizeNew);
                bottomPane.appendChild(child);

                this.resizeObserver = new ResizeObserver((entries) => {

                    if (this.timeoutResize) clearTimeout(this.timeoutResize);
                    this.timeoutResize = setTimeout(() => {
                        for (let entry of entries) {
                            this.fixedheight = entry.contentRect.height.toString();
                        }
                    }, 500);

                });

                if (this.resizeObserver) this.resizeObserver.observe(child);

            }
        });
    }




    render() {
        return html`
      <div class="top-pane"></div>
      ${this.withresize === 'true' ?
                html`<div class="spliter">
          <div @click=${this._onSpliterClick} class="spliter-button">
            <i>${this.collab_chevron_down}</i>          
          </div>
        </div>
        ` : html``
            }
      <div class="bottom-pane"></div>
      <style>${this.styles}</style>
    `;
    }

    private styles = `
    collab-spliter-vertical-var-fixed-102027 {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      max-width: var(--max-width);
      max-height: var(--max-height);
      position: relative;
    }
    collab-spliter-vertical-var-fixed-102027 > .spliter {
      display: flex;
      justify-content: center;
      height: 20px;
      background-color: var(--complement-color);
      position: relative;
      z-index: 1;
    }
    collab-spliter-vertical-var-fixed-102027 > .spliter .spliter-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 20px;
      background-color: var(--collab-nav-bg-2);
      cursor: pointer;
      position: relative;
      z-index: 1;
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
    }

    collab-spliter-vertical-var-fixed-102027 > .spliter .spliter-button i {
      transition: transform 0.8s ease;
    }

    collab-spliter-vertical-var-fixed-102027 > .spliter .spliter-button.closed i {
      transform: rotate(180deg);
    }

    collab-spliter-vertical-var-fixed-102027 > .spliter .spliter-button i {
      cursor: pointer;
    }

    collab-spliter-vertical-var-fixed-102027 > .top-pane, .bottom-pane {
      overflow: auto;
    }
    collab-spliter-vertical-var-fixed-102027 > .top-pane {
      overflow:hidden;
      background-color: var(--complement-color);
      flex-grow: 1;
    }
    collab-spliter-vertical-var-fixed-102027 > .bottom-pane {
      overflow: hidden;
      background-color: var(--collab-nav-bg-2);
      max-height: var(--fixed-height);
      height: var(--bottom-pane-height, var(--fixed-height));
    }
    collab-spliter-vertical-var-fixed-102027 > .bottom-pane.closed {
      transition: height 0s;
      height: 0;
    }
  `;
}
