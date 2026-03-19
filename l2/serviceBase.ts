/// <mls fileReference="_102027_/l2/serviceBase.ts" enhancement="_102027_/l2/enhancementLit"/>
 
import { StateLitElement } from '/_102027_/l2/stateLitElement.js';
import { customElement, property, state } from 'lit/decorators.js';
import * as libCommom from '/_102027_/l2/libCommom.js'; 

@customElement('service-base-102027')
export abstract class ServiceBase extends StateLitElement {

    get level(): mls.Level { return +(this.getAttribute('level') || 7) as mls.Level };

    @property({ type: String, reflect: true })
    public position: 'left' | 'right' = 'left';

    @property({ type: String, noAccessor: true })
    visible = 'false';

    @property({ type: String, noAccessor: true }) msize = '';

    @state() loading: boolean = false;

    @state() loadingFeedBack: string = '';

    private _nav3Service: IMlsNav3 | null | undefined;

    private _serviceContent: IToolbarContent | null | undefined;

    private _serviceItemNav: IMlsNav2Item | null | undefined;

    private _tooltipEl: ITooltipElement | null | undefined;

    get serviceContent() {
        if (this._serviceContent === undefined) {
            this._serviceContent = this.getNav3ServiceContent();
        }
        return this._serviceContent;
    }

    get nav3Service() {
        if (this._nav3Service === undefined) {
            this._nav3Service = this.getNav3Service();
        }
        return this._nav3Service;
    }

    get nav3Menu() {
        return this.getNav3ServiceMenu();
    }

    get serviceItemNav() {
        this._serviceItemNav = this.getServiceItemNav();
        return this._serviceItemNav;
    }

    get tooltipEl() {
        if (this._tooltipEl === undefined) {
            this._tooltipEl = this.getTooltip();
        }
        return this._tooltipEl;
    }

    abstract details: IService;

    abstract menu: IServiceMenu;

    abstract onServiceClick(visible: boolean, reinit: boolean, el: IToolbarContent | null): void;

    public getActualRef(): string {
        return this.nav3Service?.getAttribute('data-service') || '';
    }

    public setError(error: string): void {
        const nav3Service = this.getNav3Service();
        if (!nav3Service) return;
        (nav3Service as any)['serviceBind'] = this.details.widget;
        nav3Service.setAttribute('error', error);
    }

    public toogleBadge(show: boolean, serviceName: string, saveState: boolean = true) {
        const mlsNav2 = this.getMlsNav2();
        if (!mlsNav2) {
            console.error('Function toogleBadge: mls-nav-2 dont exist');
            return;
        }
        mlsNav2.toogleBadge(show, serviceName, saveState);
    }

    public openMe() {
        const itemService = this.serviceItemNav;
        if (itemService) itemService.click();
    }

    public showNav2Item(show: boolean) {
        const itemService = this.serviceItemNav as IMlsNav2Item;
        if (itemService && itemService.show) itemService.show(show);
    }

    public openService(service: string, position: 'left' | 'right', level: number, args?: Record<string, string>) {
        libCommom.openService(service, position, level, args);
    }

    public setFullScreen(level: number, position: 'right' | 'left' | 'default') {
        const spliter = this.getSplitter();
        if (!spliter) return;
        spliter.setFullScreen(level, position)
    }

    public selectLevel(level: number) {
        libCommom.selectLevel(level);
    }

    connectedCallback() {
        super.connectedCallback();
        (this as any)['mlsWidget'] = this;
        this.serviceContent?.addEventListener('focusin', this.checkFocus.bind(this));
    }

    attributeChangedCallback(name: string, oldVal: string, newVal: string) {
        if (name === 'visible') {
            const visible = newVal === 'true';
            const reinit: boolean = oldVal !== null && visible !== false;

            if (this.onServiceClick && typeof this.onServiceClick === 'function') {

                const nav3 = this.getNav3ServiceContent();
                if (nav3) nav3.layout(); // resize
                this.onServiceClick(visible, reinit, nav3);

            }
        }

        if (name === 'msize') {
            const [width, height, top, left] = this.msize.split(',');
            if (height) this.style.height = height + 'px';
            this.style.overflow = 'auto';
        }

        super.attributeChangedCallback(name, oldVal, newVal);

    }

    updated(changedProperties: Map<string | number | symbol, unknown>) {
        super.updated(changedProperties);

        if (changedProperties.has('loading')) {
            const loading = changedProperties.get('loading');

            if (loading !== undefined) {

                const nav3Service = this.getNav3Service();
                if (!nav3Service) return;
                (nav3Service as any)['serviceBind'] = this.details.widget;
                nav3Service.setAttribute('loading', (!loading).toString());

            }
        }


        if (changedProperties.has('loadingFeedBack')) {
            const loadingFeedBack = changedProperties.get('loadingFeedBack');
            if (loadingFeedBack !== undefined) {
                const nav3Service = this.getNav3Service();
                if (!nav3Service) return;
                nav3Service.setAttribute('loadingFeedBack', this.loadingFeedBack);
            }
        }

    }

    private checkFocus() {
        if (!this.serviceContent) return;
        if (this.serviceContent.contains(document.activeElement)) {
            this.setActualServicePosition();
        }
    }

    private setActualServicePosition() {
        if (!this.serviceContent || !this.nav3Service) return;
        const service = this.serviceContent.getAttribute('data-service') || '';
        const position = this.nav3Service.getAttribute('toolbarposition') || '';
        mls.setActualPosition(position as any);
        mls.setActualService(service)
    }

    private getMlsNav2(): IMlsNav2 | null {
        const mlsNav2 = this.closest('collab-nav-3')?.previousElementSibling as IMlsNav2 | null;
        return mlsNav2;
    }

    private getNav3ServiceContent() {
        const parentToolbarContent = this.closest('collab-nav-3-service') as IToolbarContent | null;
        return parentToolbarContent;
    }

    private getNav3Service() {
        const parentToolbarContent = this.closest('collab-nav-3') as IMlsNav3 | null;
        return parentToolbarContent;
    }

    private getNav3ServiceMenu() {
        const content = this.getNav3ServiceContent();
        if (!content) return null;
        let nav3Menu = content.querySelector('mls-nav3-100529') as HTMLElement | null;
        if (!nav3Menu) nav3Menu = content.querySelector('collab-nav-3-menu') as HTMLElement | null;
        return nav3Menu;
    }

    private getTooltip() {
        const tooltip = document.querySelector('collab-tooltip') as ITooltipElement | null;
        return tooltip;
    }

    private getSplitter() {
        const tooltip = this.closest('collab-spliter') as ISpliterElement | null;
        return tooltip;
    }

    private getServiceItemNav(): IMlsNav2Item | null {
        const toolbar = this.getMlsNav2();
        if (!toolbar) return null;
        const content = this.getNav3ServiceContent();
        if (!content) return null;
        const dataservice = content.getAttribute('data-service');
        const item = toolbar.querySelector(`collab-nav-2-item[data-service="${dataservice}"]`) as IMlsNav2Item;
        return item;
    }

}


export interface IToolbarContent extends HTMLElement {
    layout: Function
}

export interface ITooltipElement extends HTMLElement {
    tooltip: (el: HTMLElement) => void
}

export interface ISpliterElement extends HTMLElement {
    setFullScreen: (level: number, position: 'right' | 'left' | 'default') => void
}

export interface IMlsNav2 extends HTMLElement {
    toogleBadge: (show: boolean, serviceName: string, saveState?: boolean) => void
}

export interface IMlsNav3 extends HTMLElement {
    getActiveInstance: (position: 'left' | 'right') => ServiceBase | undefined
}

export interface IMlsNav2Item extends HTMLElement {
    show: (show: boolean) => void
}

export interface IService {
    widget: string,
    state: ICollabServiceState,
    icon: string,
    tooltip: string,
    visible: boolean,
    position: ICollabServicePosition,
    level: number[],
    tags?: string[],
    classname?: ICollabServiceClass,
    isStatic?: boolean,
    customConfiguration?: IServiceCustom
}

export type IServiceCustom = {
    [key: number]: IServiceCustomByPosition | IServiceCustomPlace
}
export type IServiceCustomByPosition = {
    right?: IServiceCustomPlace,
    left?: IServiceCustomPlace,
}

export interface IServiceCustomPlace {
    tooltip?: string,
    visible?: boolean,
    state?: ICollabServiceState,
    classname?: ICollabServiceClass,
    show?: boolean
}

export interface IToolbarChangeEvent {
    level: number,
    position: 'left' | 'right',
    from: string,
    to: string
}

export type ICollabServicePosition = "left" | "right" | "all"
export type ICollabServiceState = "foreground" | "background"
export type ICollabServiceClass = "separator-left" | "separator-right";




// New

export type ITitleClickCallBack = (title: string) => void | undefined;
export type IMainClickCallBack = (value: string) => void | undefined;
export type IToolsClickCallBack = (value: string) => void | undefined;
export type ITabsClickCallBack = (index: number) => void | undefined;
export type ITabsNavigationClickCallBack = (index: number, oldTab: HTMLElement, newTab: HTMLElement) => void | undefined;

export type TSetMode = (mode: TMode | null, page?: HTMLElement) => void;
export type TGetLastMode = () => TMode;
export type TMode =
    'initial' // show siblings with hamburguer icon
    | 'page' // show page (About ...) with close icon
    | 'editor'; // show siblings with close icon

export interface IOptions {
    text: string,
    icon?: string
    class?: string
}

export interface IOptionsSubMenu {
    text: string,
    icon?: string,
    class?: string,
    options: IOptions[]
}

export interface ITools {
    [key: string]: IToolsData
}

export interface IMain {
    [key: string]: IOptions | string
}

interface ITabs {
    type: 'full' | 'onlyicon',
    effect?: 'slide' | 'none',
    mode?: 'normal' | 'compact'
    group: string,
    selected?: number,
    previous?: number,
    options: IOptions[]
}

export interface IBaseToolsData {
    icon?: string;
    class?: string;
}

export interface IToolsData1 extends IBaseToolsData {
    type: 'dropdown' | 'cycle' | 'link';
    selected?: number;
    onlyMenu?: boolean;
    options: IOptions[];
}

export interface IToolsData2 extends IBaseToolsData {
    type: 'tree-dropdown';
    selected?: number[];
    onlyMenu?: boolean;
    options: IOptionsSubMenu[];
}

type IToolsData = IToolsData1 | IToolsData2;

export interface IServiceMenu {
    enabled?: boolean;
    title: IOptions | string,
    main: IMain,
    tabs: ITabs | undefined,
    tools: ITools,

    onClickTitle?: ITitleClickCallBack,
    onClickMain?: IMainClickCallBack,
    onClickTools?: IToolsClickCallBack,
    onClickTabs?: ITabsClickCallBack,
    onClickTabsNavigation?: ITabsNavigationClickCallBack,

    setMenuActive?: (op: string) => void
    setTabActive?: (index: number) => void,
    tabNavigate?: (index: number, oldTab: HTMLElement | undefined, newTab: HTMLElement) => void,
    tabBack?: () => void,
    toggleErrorTab?: (index: number, show: boolean) => void
    selectTool?: (op: string) => void,

    mainDefault?: string,
    lastMain?: string,

    setMode?: TSetMode,
    refresh?: (mode?: 'full' | 'tabs' | 'tools') => void,
    closeMenu?: Function,
    getLastMode?: TGetLastMode,
    updateTitle?: Function,

}