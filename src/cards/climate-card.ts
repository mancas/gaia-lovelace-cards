import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, ClimateCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  friendlyName,
  fireMoreInfo,
  numericState,
  formatNumber,
  haptic,
  isUnavailable,
} from '../helpers.js';

defineEditor('custom-climate-card-editor', [
  { name: 'entity', required: true, selector: { entity: { domain: 'climate' } } },
  { name: 'name', selector: { text: {} } },
  { name: 'step', selector: { number: { min: 0.1, max: 5, step: 0.1, mode: 'box' } } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'show_modes', selector: { boolean: {} } },
      { name: 'show_fan_modes', selector: { boolean: {} } },
    ],
  },
  {
    name: 'temperature_sensor',
    selector: { entity: { domain: 'sensor', device_class: 'temperature' } },
  },
  { name: 'humidity_sensor', selector: { entity: { domain: 'sensor', device_class: 'humidity' } } },
]);

const MODE_META: Record<string, { icon: string; label: string; color: string }> = {
  off: {
    icon: 'mdi:power',
    label: 'Off',
    color: 'var(--state-climate-off-color, var(--secondary-text-color))',
  },
  cool: { icon: 'mdi:snowflake', label: 'Cool', color: 'var(--state-climate-cool-color, #2b9af9)' },
  heat: { icon: 'mdi:fire', label: 'Heat', color: 'var(--state-climate-heat-color, #ff8100)' },
  heat_cool: {
    icon: 'mdi:sun-snowflake-variant',
    label: 'Auto',
    color: 'var(--state-climate-heat-cool-color, #4caf50)',
  },
  auto: {
    icon: 'mdi:thermostat-auto',
    label: 'Auto',
    color: 'var(--state-climate-auto-color, #4caf50)',
  },
  dry: {
    icon: 'mdi:water-percent',
    label: 'Dry',
    color: 'var(--state-climate-dry-color, #ff9800)',
  },
  fan_only: {
    icon: 'mdi:fan',
    label: 'Fan',
    color: 'var(--state-climate-fan-only-color, #6cb1e6)',
  },
};

const FAN_META: Record<string, { icon: string; label: string }> = {
  auto: { icon: 'mdi:fan-auto', label: 'Auto' },
  low: { icon: 'mdi:fan-speed-1', label: 'Low' },
  medium: { icon: 'mdi:fan-speed-2', label: 'Medium' },
  high: { icon: 'mdi:fan-speed-3', label: 'High' },
  quiet: { icon: 'mdi:fan-minus', label: 'Quiet' },
  turbo: { icon: 'mdi:fan-plus', label: 'Turbo' },
};

export class ClimateCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: ClimateCardConfig;
  /** Optimistic target while the debounced service call is pending */
  @state() private _pendingTarget?: number;
  private _debounce?: number;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        --mode-color: var(--cc-accent);
        position: relative;
        overflow: hidden;
      }
      ha-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--mode-color) 18%, transparent),
          transparent 60%
        );
        pointer-events: none;
        transition: background 0.4s;
      }
      ha-card.off::before {
        background: none;
      }
      .header,
      .hero,
      .pills,
      .section-label {
        position: relative;
      }
      .icon-bubble.active {
        background: color-mix(in srgb, var(--mode-color) 18%, transparent);
        color: var(--mode-color);
      }
      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .target {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .target .value {
        font-size: 2.6rem;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .target .value small {
        font-size: 1.1rem;
        font-weight: 400;
        color: var(--secondary-text-color);
        margin-left: 2px;
      }
      .target .current {
        font-size: 0.78rem;
        color: var(--secondary-text-color);
      }
      .stepper {
        display: flex;
        gap: 8px;
      }
      .stepper button {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          background 0.15s,
          transform 0.1s;
        font: inherit;
      }
      .stepper button:active {
        transform: scale(0.94);
      }
      .stepper button:hover {
        background: color-mix(in srgb, var(--mode-color) 20%, var(--cc-muted-bg));
      }
      .stepper button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .pill.active {
        background: var(--mode-color);
      }
      .pill.mode-off.active {
        background: var(--secondary-text-color);
      }
      .sensors {
        display: flex;
        gap: 6px;
      }
      .sensor-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--cc-muted-bg);
        color: var(--secondary-text-color);
      }
      .sensor-pill ha-icon {
        --mdc-icon-size: 14px;
      }
      .off .target .value {
        color: var(--secondary-text-color);
      }
      @container card (max-width: 380px) {
        .target .value {
          font-size: 2.2rem;
        }
        .stepper button {
          width: 40px;
          height: 40px;
        }
        .sensors {
          flex-basis: 100%;
          order: 3;
        }
        .header {
          flex-wrap: wrap;
        }
      }
      @container card (max-width: 260px) {
        .hero {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ];

  setConfig(config: ClimateCardConfig) {
    if (!config.entity) throw new Error("climate-card: 'entity' is required");
    this._config = { show_modes: true, show_fan_modes: true, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-climate-card-editor');
  }

  static getStubConfig(): Omit<ClimateCardConfig, 'type'> {
    return { entity: 'climate.living_room', show_modes: true, show_fan_modes: true };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private get _step(): number {
    return (
      this._config.step ??
      (this._entity?.attributes['target_temp_step'] as number | undefined) ??
      0.5
    );
  }

  private _setMode(mode: string) {
    haptic(this);
    this.hass.callService('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: mode,
    });
  }

  private _setFan(mode: string) {
    haptic(this);
    this.hass.callService('climate', 'set_fan_mode', {
      entity_id: this._config.entity,
      fan_mode: mode,
    });
  }

  private _bump(direction: 1 | -1) {
    const attrs = this._entity?.attributes ?? {};
    const min = (attrs['min_temp'] as number | undefined) ?? 7;
    const max = (attrs['max_temp'] as number | undefined) ?? 35;
    const base = this._pendingTarget ?? (attrs['temperature'] as number | undefined) ?? 21;
    const step = this._step;
    const next = Math.min(max, Math.max(min, Math.round((base + direction * step) / step) * step));
    this._pendingTarget = parseFloat(next.toFixed(2));
    haptic(this);
    window.clearTimeout(this._debounce);
    this._debounce = window.setTimeout(() => {
      const target = this._pendingTarget;
      this.hass.callService('climate', 'set_temperature', {
        entity_id: this._config.entity,
        temperature: target,
      });
      window.setTimeout(() => {
        if (this._pendingTarget === target) this._pendingTarget = undefined;
      }, 3000);
    }, 700);
  }

  private _sensorPill(entityId: string | undefined, icon: string, unit: string, fallback?: number) {
    const v = numericState(this.hass, entityId) ?? fallback;
    if (v == null) return nothing;
    return html`<span class="sensor-pill"
      ><ha-icon icon=${icon}></ha-icon>${formatNumber(v)}${unit}</span
    >`;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    const attrs = entity?.attributes ?? {};
    const unavailable = isUnavailable(entity);
    const mode = entity?.state ?? 'off';
    const isOff = mode === 'off' || unavailable;
    const meta = MODE_META[mode] ?? {
      icon: 'mdi:thermostat',
      label: mode,
      color: 'var(--cc-accent)',
    };
    const name = friendlyName(this.hass, this._config.entity, this._config.name);
    const target = this._pendingTarget ?? (attrs['temperature'] as number | undefined);
    const current = attrs['current_temperature'] as number | undefined;
    const action = attrs['hvac_action'] as string | undefined;
    const modes = (attrs['hvac_modes'] as string[] | undefined) ?? [];
    const fanModes = (attrs['fan_modes'] as string[] | undefined) ?? [];
    const fanMode = attrs['fan_mode'] as string | undefined;
    const unit = (attrs['temperature_unit'] as string | undefined) ?? '°';

    const subtitle = unavailable
      ? 'Unavailable'
      : action
        ? action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
        : meta.label;

    return html`
      <ha-card class=${isOff ? 'off' : ''} style="--mode-color:${meta.color}">
        <div class="header">
          <div
            class="icon-bubble ${isOff ? '' : 'active'}"
            @click=${() => fireMoreInfo(this, this._config.entity)}
          >
            <ha-icon icon=${meta.icon}></ha-icon>
          </div>
          <div style="flex:1;min-width:0">
            <div class="title">${name}</div>
            <div class="subtitle">${subtitle}</div>
          </div>
          <div class="sensors">
            ${this._sensorPill(this._config.temperature_sensor, 'mdi:thermometer', '°', undefined)}
            ${this._sensorPill(this._config.humidity_sensor, 'mdi:water-percent', '%')}
          </div>
        </div>

        <div class="hero">
          <div class="target" @click=${() => fireMoreInfo(this, this._config.entity)}>
            <div class="value">
              ${target != null ? formatNumber(target) : '—'}<small
                >${unit.replace('°C', '°').replace('°F', '°')}</small
              >
            </div>
            <div class="current">
              ${current != null ? html`Currently ${formatNumber(current)}${unit}` : nothing}
            </div>
          </div>
          <div class="stepper">
            <button ?disabled=${unavailable} aria-label="Decrease" @click=${() => this._bump(-1)}>
              <ha-icon icon="mdi:minus"></ha-icon>
            </button>
            <button ?disabled=${unavailable} aria-label="Increase" @click=${() => this._bump(1)}>
              <ha-icon icon="mdi:plus"></ha-icon>
            </button>
          </div>
        </div>

        ${
          this._config.show_modes && modes.length
            ? html`<div class="pills">
                ${modes.map((m) => {
                  const mm = MODE_META[m] ?? { icon: 'mdi:thermostat', label: m };
                  return html`<button
                    class="pill mode-${m} ${m === mode ? 'active' : ''}"
                    @click=${() => this._setMode(m)}
                    title=${mm.label}
                  >
                    <ha-icon icon=${mm.icon}></ha-icon><span>${mm.label}</span>
                  </button>`;
                })}
              </div>`
            : nothing
        }
        ${
          this._config.show_fan_modes && fanModes.length && !isOff
            ? html`<div class="section-label">Fan</div>
                <div class="pills">
                  ${fanModes.map((f) => {
                    const fm = FAN_META[f] ?? { icon: 'mdi:fan', label: f };
                    return html`<button
                      class="pill ${f === fanMode ? 'active' : ''}"
                      @click=${() => this._setFan(f)}
                    >
                      <ha-icon icon=${fm.icon}></ha-icon><span>${fm.label}</span>
                    </button>`;
                  })}
                </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-climate-card', ClimateCard);
