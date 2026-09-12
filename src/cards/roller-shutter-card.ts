import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type {
  HomeAssistant,
  RollerShutterCardConfig,
  RollerShutterPreset,
  GridOptions,
} from '../types.js';
import { sharedStyles, friendlyName, isUnavailable, haptic, prettify } from '../helpers.js';

/* ------------------------------------------------------------------ */
/*  Preset helpers                                                     */
/* ------------------------------------------------------------------ */

type NormalizedPreset = { label: string; position: number };

function normalizePresets(raw: Array<number | RollerShutterPreset>): NormalizedPreset[] {
  return raw.map((p) =>
    typeof p === 'number'
      ? { label: `${p}%`, position: p }
      : { label: p.name ?? `${p.position}%`, position: p.position },
  );
}

const DEFAULT_PRESETS = [0, 25, 50, 75, 100];

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */

const BASE_SCHEMA = [
  { name: 'entity', required: true, selector: { entity: { domain: 'cover' } } },
  { name: 'name', selector: { text: {} } },
  { name: 'show_slider', selector: { boolean: {} } },
];

class RollerShutterCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config: Record<string, unknown> = {};

  static styles = css`
    ha-form {
      display: block;
    }
    .presets-section {
      margin-top: 8px;
    }
    .presets-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--secondary-text-color);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 4px 0 6px;
    }
    .preset-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .preset-name {
      flex: 1;
      min-width: 0;
    }
    .preset-position {
      width: 72px;
      flex-shrink: 0;
    }
    input[type='text'],
    input[type='number'] {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
      border-radius: 6px;
      font: inherit;
      font-size: 0.875rem;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      box-sizing: border-box;
      outline: none;
    }
    input[type='text']:focus,
    input[type='number']:focus {
      border-color: var(--primary-color);
    }
    .remove-btn {
      --mdc-icon-button-size: 36px;
      flex-shrink: 0;
      color: var(--secondary-text-color);
    }
    .add-btn {
      width: 100%;
      padding: 8px 12px;
      border: 1px dashed var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 6px;
      background: none;
      font: inherit;
      font-size: 0.875rem;
      color: var(--secondary-text-color);
      cursor: pointer;
      text-align: center;
      margin-top: 2px;
    }
    .add-btn:hover {
      background: var(--secondary-background-color);
    }
  `;

  setConfig(config: Record<string, unknown>) {
    this._config = config ?? {};
  }

  private get _presets(): Array<{ name?: string; position: number }> {
    const raw = this._config['presets'] as Array<number | RollerShutterPreset> | undefined;
    if (!raw) return DEFAULT_PRESETS.map((p) => ({ position: p }));
    return raw.map((p) =>
      typeof p === 'number' ? { position: p } : { name: p.name, position: p.position },
    );
  }

  private _dispatch(config: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }),
    );
  }

  private _onBaseChanged(ev: Event) {
    ev.stopPropagation();
    const formValue = { ...(ev as CustomEvent<{ value: Record<string, unknown> }>).detail.value };
    for (const [k, v] of Object.entries(formValue)) {
      if (v === '' || v === undefined || v === null) delete formValue[k];
    }
    // Presets are managed separately; re-inject from current state.
    const presets = this._config['presets'];
    if (presets !== undefined) formValue['presets'] = presets;
    this._config = formValue;
    this._dispatch(formValue);
  }

  private _savePresets(presets: Array<{ name?: string; position: number }>) {
    const config = { ...this._config, presets };
    this._config = config;
    this._dispatch(config);
  }

  private _setName(i: number, name: string) {
    const presets = [...this._presets];
    presets[i] = { ...presets[i], name: name || undefined };
    this._savePresets(presets);
  }

  private _setPosition(i: number, raw: string) {
    const position = Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
    const presets = [...this._presets];
    presets[i] = { ...presets[i], position };
    this._savePresets(presets);
  }

  private _remove(i: number) {
    this._savePresets(this._presets.filter((_, idx) => idx !== i));
  }

  private _add() {
    this._savePresets([...this._presets, { position: 50 }]);
  }

  render() {
    if (!this.hass) return nothing;
    const presets = this._presets;

    // Pass only base fields to ha-form so it does not interfere with presets.
    const baseData: Record<string, unknown> = { ...this._config };
    delete baseData['presets'];

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${baseData}
        .schema=${BASE_SCHEMA}
        .computeLabel=${(s: { name: string }) => prettify(s.name)}
        @value-changed=${this._onBaseChanged}
      ></ha-form>

      <div class="presets-section">
        <div class="presets-label">Presets</div>

        ${presets.map(
          (p, i) => html`
            <div class="preset-row">
              <div class="preset-name">
                <input
                  type="text"
                  .value=${p.name ?? ''}
                  placeholder="Label (optional)"
                  @change=${(e: Event) => this._setName(i, (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="preset-position">
                <input
                  type="number"
                  min="0"
                  max="100"
                  .value=${String(p.position)}
                  @change=${(e: Event) => this._setPosition(i, (e.target as HTMLInputElement).value)}
                />
              </div>
              <ha-icon-button class="remove-btn" .label=${'Remove'} @click=${() => this._remove(i)}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>
              </ha-icon-button>
            </div>
          `,
        )}

        <button class="add-btn" @click=${this._add}>+ Add preset</button>
      </div>
    `;
  }
}

customElements.define('custom-roller-shutter-card-editor', RollerShutterCardEditor);

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

export class RollerShutterCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: RollerShutterCardConfig;
  @state() private _pendingPosition?: number;

  static styles = [
    sharedStyles,
    css`
      .state-chip {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--cc-muted-bg);
        color: var(--secondary-text-color);
        text-transform: capitalize;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .state-chip.moving {
        background: var(--cc-accent-soft);
        color: var(--cc-accent);
      }
      .aperture-viz {
        width: 100%;
        height: 72px;
        border-radius: var(--cc-radius);
        border: 2px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        overflow: hidden;
        position: relative;
        background: color-mix(in srgb, var(--cc-accent) 8%, transparent);
        flex-shrink: 0;
      }
      .shutter-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        transition: height 0.35s ease;
        background-color: var(--cc-muted-bg);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent,
          transparent 10px,
          var(--divider-color, rgba(0, 0, 0, 0.15)) 10px,
          var(--divider-color, rgba(0, 0, 0, 0.15)) 11px
        );
      }
      .position-label {
        font-size: 2rem;
        font-weight: 600;
        text-align: center;
        line-height: 1;
        color: var(--primary-text-color);
      }
      .position-label small {
        font-size: 1rem;
        font-weight: 400;
        color: var(--secondary-text-color);
        margin-left: 2px;
      }
      .slider-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .slider-row input[type='range'] {
        flex: 1;
      }
      .slider-row ha-icon {
        --mdc-icon-size: 18px;
        opacity: 0.5;
        flex-shrink: 0;
      }
      .controls {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      ha-icon-button {
        --mdc-icon-button-size: 44px;
      }
    `,
  ];

  setConfig(config: RollerShutterCardConfig) {
    if (!config.entity) throw new Error("roller-shutter-card: 'entity' is required");
    this._config = { show_slider: true, presets: DEFAULT_PRESETS, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-roller-shutter-card-editor');
  }

  static getStubConfig(): Omit<RollerShutterCardConfig, 'type'> {
    return { entity: 'cover.living_room_blinds', show_slider: true };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 4, rows: 4, min_columns: 2, min_rows: 3 };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _call(service: string, data?: Record<string, unknown>) {
    this.hass.callService('cover', service, { entity_id: this._config.entity, ...data });
  }

  private _setPosition(position: number) {
    haptic(this, 'light');
    this._pendingPosition = position;
    this._call('set_cover_position', { position });
    setTimeout(() => {
      this._pendingPosition = undefined;
    }, 3000);
  }

  private _onSliderInput(e: Event) {
    this._pendingPosition = parseInt((e.target as HTMLInputElement).value, 10);
  }

  private _onSliderChange(e: Event) {
    const position = parseInt((e.target as HTMLInputElement).value, 10);
    this._setPosition(position);
  }

  private _coverIcon(entityState: string, position: number): string {
    if (entityState === 'opening') return 'mdi:arrow-up-circle-outline';
    if (entityState === 'closing') return 'mdi:arrow-down-circle-outline';
    return position > 50 ? 'mdi:window-shutter-open' : 'mdi:window-shutter';
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;

    if (!entity)
      return html`<ha-card
        ><div class="unavailable-banner">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>Entity not found
        </div></ha-card
      >`;

    if (isUnavailable(entity))
      return html`<ha-card
        ><div class="unavailable-banner">
          <ha-icon icon="mdi:window-shutter"></ha-icon>Unavailable
        </div></ha-card
      >`;

    const attrs = entity.attributes as Record<string, unknown>;
    const entityState = entity.state;
    const isMoving = entityState === 'opening' || entityState === 'closing';
    const rawPosition =
      (attrs['current_position'] as number | undefined) ?? (entityState === 'open' ? 100 : 0);
    const position = this._pendingPosition ?? rawPosition;
    const name = this._config.name ?? friendlyName(this.hass, this._config.entity);
    const presets = normalizePresets(this._config.presets ?? DEFAULT_PRESETS);
    const shutterHeight = 100 - position;

    return html`
      <ha-card>
        <div class="header">
          <div class="icon-bubble ${position > 0 ? 'active' : ''}">
            <ha-icon .icon=${this._coverIcon(entityState, position)}></ha-icon>
          </div>
          <div class="title">${name}</div>
          <span class="state-chip ${isMoving ? 'moving' : ''}">${entityState}</span>
        </div>

        <div class="aperture-viz">
          <div class="shutter-panel" style="height:${shutterHeight}%"></div>
        </div>

        <div class="position-label">${position}<small>%</small></div>

        <div class="pills">
          ${presets.map(
            (p) => html`
              <button
                class="pill ${position === p.position ? 'active' : ''}"
                @click=${() => this._setPosition(p.position)}
              >
                ${p.label}
              </button>
            `,
          )}
        </div>

        ${
          this._config.show_slider
            ? html`
                <div class="slider-row">
                  <ha-icon icon="mdi:window-shutter"></ha-icon>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    .value=${String(position)}
                    @input=${this._onSliderInput}
                    @change=${this._onSliderChange}
                  />
                  <ha-icon icon="mdi:window-shutter-open"></ha-icon>
                </div>
              `
            : nothing
        }

        <div class="controls">
          <ha-icon-button
            .label=${'Open'}
            @click=${() => {
              this._call('open_cover');
              haptic(this, 'light');
            }}
          >
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            .label=${'Stop'}
            ?disabled=${!isMoving}
            @click=${() => {
              this._call('stop_cover');
              haptic(this, 'medium');
            }}
          >
            <ha-icon icon="mdi:stop"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            .label=${'Close'}
            @click=${() => {
              this._call('close_cover');
              haptic(this, 'light');
            }}
          >
            <ha-icon icon="mdi:arrow-down"></ha-icon>
          </ha-icon-button>
        </div>
      </ha-card>
    `;
  }
}

customElements.define('custom-roller-shutter-card', RollerShutterCard);
