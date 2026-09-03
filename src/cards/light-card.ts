import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, LightCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  friendlyName,
  fireMoreInfo,
  haptic,
  isUnavailable,
} from '../helpers.js';

defineEditor('custom-light-card-editor', [
  { name: 'entity', required: true, selector: { entity: { domain: 'light' } } },
  { name: 'name', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'show_brightness', selector: { boolean: {} } },
      { name: 'show_color_temp', selector: { boolean: {} } },
      { name: 'show_color', selector: { boolean: {} } },
    ],
  },
]);

const DEFAULT_PRESETS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: 'Red', rgb: [255, 64, 64] },
  { name: 'Orange', rgb: [255, 140, 0] },
  { name: 'Yellow', rgb: [255, 214, 0] },
  { name: 'Green', rgb: [76, 217, 100] },
  { name: 'Teal', rgb: [0, 200, 200] },
  { name: 'Blue', rgb: [64, 128, 255] },
  { name: 'Purple', rgb: [160, 90, 255] },
  { name: 'Pink', rgb: [255, 100, 180] },
];

const KELVIN_STEPS = [2200, 2700, 3000, 4000, 5000, 6500];

/** Rough sRGB approximation of a black‑body colour, good enough for a swatch */
function kelvinToCss(k: number): string {
  const t = k / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export class LightCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: LightCardConfig;
  @state() private _pendingBrightness?: number;
  private _debounce?: number;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        --light-color: var(--cc-accent);
      }
      .icon-bubble.active {
        background: color-mix(in srgb, var(--light-color) 22%, transparent);
        color: var(--light-color);
      }
      .brightness {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brightness ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
      }
      .brightness .out {
        font-size: 0.78rem;
        min-width: 36px;
        text-align: right;
        color: var(--secondary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .brightness input[type='range'] {
        accent-color: var(--light-color);
      }
      .swatches {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .swatch {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
        transition:
          transform 0.1s,
          border-color 0.15s;
        padding: 0;
      }
      .swatch:hover {
        transform: scale(1.1);
      }
      .swatch.selected {
        border-color: var(--primary-text-color);
      }
      .dim {
        opacity: 0.45;
        pointer-events: none;
      }
    `,
  ];

  setConfig(config: LightCardConfig) {
    if (!config.entity) throw new Error("light-card: 'entity' is required");
    this._config = { show_brightness: true, show_color_temp: true, show_color: true, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-light-card-editor');
  }

  static getStubConfig(): Omit<LightCardConfig, 'type'> {
    return {
      entity: 'light.living_room',
      show_brightness: true,
      show_color_temp: true,
      show_color: true,
    };
  }

  getCardSize() {
    return 3;
  }

  getGridOptions(): GridOptions {
    return { columns: 6, rows: 'auto', min_columns: 4 };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _toggle() {
    haptic(this);
    this.hass.callService('light', 'toggle', { entity_id: this._config.entity });
  }

  private _onBrightnessInput(e: Event) {
    const pct = parseInt((e.target as HTMLInputElement).value, 10);
    this._pendingBrightness = pct;
    window.clearTimeout(this._debounce);
    this._debounce = window.setTimeout(() => {
      const value = this._pendingBrightness;
      const data: Record<string, unknown> = { entity_id: this._config.entity };
      if (value === 0) {
        this.hass.callService('light', 'turn_off', data);
      } else {
        this.hass.callService('light', 'turn_on', { ...data, brightness_pct: value });
      }
      window.setTimeout(() => {
        if (this._pendingBrightness === value) this._pendingBrightness = undefined;
      }, 2500);
    }, 250);
  }

  private _setKelvin(k: number) {
    haptic(this);
    this.hass.callService('light', 'turn_on', {
      entity_id: this._config.entity,
      color_temp_kelvin: k,
    });
  }

  private _setRgb(rgb: [number, number, number]) {
    haptic(this);
    this.hass.callService('light', 'turn_on', { entity_id: this._config.entity, rgb_color: rgb });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    const attrs = entity?.attributes ?? {};
    const unavailable = isUnavailable(entity);
    const isOn = entity?.state === 'on';
    const modes = (attrs['supported_color_modes'] as string[] | undefined) ?? [];
    const supportsBrightness = modes.some((m) => m !== 'onoff');
    const supportsTemp = modes.includes('color_temp');
    const supportsColor = modes.some((m) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(m));
    const brightness =
      this._pendingBrightness ??
      (isOn ? Math.round((((attrs['brightness'] as number) ?? 0) / 255) * 100) : 0);
    const rgb = attrs['rgb_color'] as [number, number, number] | undefined;
    const colorMode = attrs['color_mode'] as string | undefined;
    const kelvin = attrs['color_temp_kelvin'] as number | undefined;
    const minK = (attrs['min_color_temp_kelvin'] as number | undefined) ?? 2000;
    const maxK = (attrs['max_color_temp_kelvin'] as number | undefined) ?? 6500;
    const lightColor =
      isOn && rgb && colorMode !== 'color_temp'
        ? `rgb(${rgb.join(',')})`
        : isOn && kelvin
          ? kelvinToCss(kelvin)
          : 'var(--cc-accent)';
    const name = friendlyName(this.hass, this._config.entity, this._config.name);
    const subtitle = unavailable
      ? 'Unavailable'
      : isOn
        ? supportsBrightness
          ? `On · ${brightness}%`
          : 'On'
        : 'Off';
    const kelvinSteps = KELVIN_STEPS.filter((k) => k >= minK && k <= maxK);
    const presets = this._config.color_presets ?? DEFAULT_PRESETS;
    const rgbMatches = (p: [number, number, number]) =>
      !!rgb && colorMode !== 'color_temp' && p.every((v, i) => Math.abs(v - rgb[i]) < 24);

    return html`
      <ha-card style="--light-color:${lightColor}">
        <div class="header">
          <div
            class="icon-bubble ${isOn ? 'active' : ''}"
            @click=${() => fireMoreInfo(this, this._config.entity)}
          >
            <ha-icon
              icon=${this._config.icon ?? (attrs['icon'] as string) ?? 'mdi:lightbulb'}
            ></ha-icon>
          </div>
          <div style="flex:1;min-width:0">
            <div class="title">${name}</div>
            <div class="subtitle">${subtitle}</div>
          </div>
          <div
            class="toggle ${isOn ? 'on' : ''} ${unavailable ? 'dim' : ''}"
            role="switch"
            aria-checked=${isOn}
            @click=${this._toggle}
          >
            <div class="knob"></div>
          </div>
        </div>

        ${
          this._config.show_brightness && supportsBrightness
            ? html`<div class="brightness ${unavailable ? 'dim' : ''}">
                <ha-icon icon="mdi:brightness-6"></ha-icon>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  .value=${String(brightness)}
                  @input=${this._onBrightnessInput}
                  aria-label="Brightness"
                />
                <span class="out">${brightness}%</span>
              </div>`
            : nothing
        }
        ${
          this._config.show_color_temp && supportsTemp && kelvinSteps.length
            ? html`<div class="section-label">White</div>
                <div class="swatches ${unavailable ? 'dim' : ''}">
                  ${kelvinSteps.map(
                    (k) =>
                      html`<button
                        class="swatch ${isOn && colorMode === 'color_temp' && kelvin && Math.abs(kelvin - k) < 200 ? 'selected' : ''}"
                        style="background:${kelvinToCss(k)}"
                        title="${k} K"
                        @click=${() => this._setKelvin(k)}
                      ></button>`,
                  )}
                </div>`
            : nothing
        }
        ${
          this._config.show_color && supportsColor
            ? html`<div class="section-label">Colour</div>
                <div class="swatches ${unavailable ? 'dim' : ''}">
                  ${presets.map(
                    (p) =>
                      html`<button
                        class="swatch ${isOn && rgbMatches(p.rgb) ? 'selected' : ''}"
                        style="background:rgb(${p.rgb.join(',')})"
                        title=${p.name ?? p.rgb.join(',')}
                        @click=${() => this._setRgb(p.rgb)}
                      ></button>`,
                  )}
                </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-light-card', LightCard);
