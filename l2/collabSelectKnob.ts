/// <mls fileReference="_102027_/l2/collabSelectKnob.ts" enhancement="_102027_/l2/enhancementLit.ts"/>

import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StateLitElement } from '/_102029_/l2/stateLitElement.js';

@customElement('collab-select-knob-102027')
export class SelectOneKnobWidget extends StateLitElement {

  @property({ type: Number }) min = 1;
  @property({ type: Number }) max = 9;
  @property({ type: Number, reflect: true }) value: number | null = null;
  @property({ type: Number }) step = 1;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, attribute: 'show-ticks' }) showTicks = false;

  @state() private _focused = false;
  @state() private _editing = false;

  private _dragStartY = 0;
  private _dragStartValue = 0;
  private _dragging = false;

  private _pendingDigit = '';
  private _digitTimeout: ReturnType<typeof setTimeout> | null = null;

  @state() private _pendingDisplay: string | null = null;
  @state() private _pendingInvalid = false;

  private get _hasValue(): boolean {
    return this.value !== null && this.value !== undefined;
  }

  private get _rotation(): number {
    if (!this._hasValue) return -135;
    const range = this.max - this.min;
    const normalized = ((this.value! - this.min) / range);
    return -135 + normalized * 270;
  }

  private get _tickCount(): number {
    return Math.floor((this.max - this.min) / this.step) + 1;
  }

  private get _displayValue(): string {
    if (this._pendingDisplay !== null) return this._pendingDisplay;
    if (this._hasValue) return String(this.value);
    return '';
  }

  private get _displayHidden(): boolean {
    return !this._hasValue && this._pendingDisplay === null;
  }

  private get _canInteract(): boolean {
    return !this.disabled && this.active;
  }

  private _clamp(v: number): number {
    return Math.min(this.max, Math.max(this.min, v));
  }

  private _setValue(next: number | null) {
    const prev = this.value;
    this.value = next !== null ? this._clamp(next) : null;
    if (this.value !== prev) {
      this.dispatchEvent(new CustomEvent('knob-change', {
        bubbles: true,
        composed: false,
        detail: { value: this.value, previous: prev }
      }));
    }
  }

  private _cycleValue() {
    if (!this._hasValue) {
      this._setValue(this.min);
      return;
    }
    const next = this.value! + this.step;
    this._setValue(next > this.max ? this.min : next);
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (!this._canInteract) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      this._cancelDigitInput();
      this._setValue((this._hasValue ? this.value! : this.min - this.step) + this.step);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this._cancelDigitInput();
      this._setValue((this._hasValue ? this.value! : this.min) - this.step);
      return;
    }
    if (e.key === 'Escape') {
      this._editing = false;
      this._cancelDigitInput();
      (this.renderRoot as HTMLElement).blur?.();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this._cancelDigitInput();
      this._setValue(null);
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      this._pendingDigit += e.key;

      const parsed = parseInt(this._pendingDigit, 10);
      this._pendingDisplay = this._pendingDigit;
      this._pendingInvalid = parsed < this.min || parsed > this.max;

      if (this._digitTimeout) clearTimeout(this._digitTimeout);
      this._digitTimeout = setTimeout(() => {
        if (!isNaN(parsed) && parsed >= this.min && parsed <= this.max) {
          this._setValue(parsed);
        }
        this._pendingDigit = '';
        this._pendingInvalid = false;
        this._pendingDisplay = null;
      }, 600);
    }
  }

  private _cancelDigitInput() {
    if (this._digitTimeout) clearTimeout(this._digitTimeout);
    this._digitTimeout = null;
    this._pendingDigit = '';
    this._pendingDisplay = null;
    this._pendingInvalid = false;
  }

  private _onMouseDown(e: MouseEvent) {
    if (this.disabled) return;
    e.preventDefault();
    this._dragging = false;
    this._dragStartY = e.clientY;
    this._dragStartValue = this._hasValue ? this.value! : this.min;

    const onMove = (ev: MouseEvent) => {
      if (!this.active) return;
      const delta = this._dragStartY - ev.clientY;
      if (Math.abs(delta) > 3) this._dragging = true;
      const steps = Math.round(delta / 8);
      this._setValue(this._dragStartValue + steps * this.step);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this._dragging = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private _onWheel(e: WheelEvent) {
    if (!this._canInteract) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    this._setValue((this._hasValue ? this.value! : this.min) + dir * this.step);
  }

  private _onFocus() {
    if (this.disabled) return;
    this._focused = true;
    this.dispatchEvent(new CustomEvent('knob-focus', { bubbles: true, composed: false }));
  }

  private _onBlur() {
    this._focused = false;
    this._editing = false;
    this._cancelDigitInput();
    this.dispatchEvent(new CustomEvent('knob-blur', { bubbles: true, composed: false }));
  }

  private _onDisplayClick(e: MouseEvent) {
    if (this.disabled) return;
    e.stopPropagation();

    if (!this.active) {
      this.dispatchEvent(new CustomEvent('knob-click', { bubbles: true, composed: false }));
      return;
    }

    this._editing = true;
    const root = this.renderRoot.querySelector('[data-knob-root]') as HTMLElement;
    root?.focus();
  }

  private _onClick() {
    if (this.disabled) return;

    if (this.active && !this._dragging) {
      this._cycleValue();
    }

    this.dispatchEvent(new CustomEvent('knob-click', { bubbles: true, composed: false }));
  }

  private _renderTicks() {
    if (!this.showTicks) return '';
    const ticks = [];
    const total = this._tickCount;
    for (let i = 0; i < total; i++) {
      const angle = -135 + (i / (total - 1)) * 270;
      const isCurrent = this._hasValue && (this.min + i * this.step) === this.value;
      ticks.push(html`
        <div
          class="knob__tick ${isCurrent ? 'knob__tick--active' : ''}"
          style="transform: rotate(${angle}deg)"
        ></div>
      `);
    }
    return ticks;
  }

  override render() {
    const rootClasses = [
      'widgets--select-one-knob-102027',
      this.active ? 'is-active' : '',
      this.selected ? 'is-selected' : '',
      this._focused ? 'is-focused' : '',
      this._editing ? 'is-editing' : '',
      this.disabled ? 'is-disabled' : '',
      this._hasValue ? 'has-value' : '',
      this._pendingDisplay !== null ? 'is-typing' : '',
      this._pendingInvalid ? 'is-invalid' : '',
      !this.showTicks ? 'no-ticks' : '',
    ].filter(Boolean).join(' ');

    return html`
      <div
        class="${rootClasses}"
        data-knob-root
        tabindex="${this.disabled ? -1 : 0}"
        role="spinbutton"
        aria-valuenow="${this._hasValue ? this.value : ''}"
        aria-valuemin="${this.min}"
        aria-valuemax="${this.max}"
        aria-disabled="${this.disabled}"
        @keydown="${this._onKeyDown}"
        @mousedown="${this._onMouseDown}"
        @wheel="${this._onWheel}"
        @focus="${this._onFocus}"
        @blur="${this._onBlur}"
        @click=${this._onClick}
      >
        <div class="knob__ticks-ring">
          ${this._renderTicks()}
        </div>

        <div
          class="knob__body"
          style="transform: rotate(${this._rotation}deg)"
        >
          <div class="knob__indicator"></div>
        </div>

        <div class="knob__display" @click=${this._onDisplayClick}>
          <span class="knob__value ${this._displayHidden ? 'knob__value--hidden' : ''}">
            ${this._displayValue}
          </span>
        </div>
      </div>
    `;
  }
}