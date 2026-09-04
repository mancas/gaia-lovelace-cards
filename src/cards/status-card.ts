import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type {
  HomeAssistant,
  StatusCardConfig,
  StatusCardEntity,
  GridOptions,
  HassEntity,
} from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  friendlyName,
  formatState,
  relativeTime,
  lang,
  isUnavailable,
} from '../helpers.js';

defineEditor(
  'custom-status-card-editor',
  [
    { name: 'name', selector: { text: {} } },
    { name: 'layout', selector: { select: { mode: 'dropdown', options: ['list', 'grid'] } } },
    { name: 'show_last_changed', selector: { boolean: {} } },
    { name: 'entities', required: true, selector: { entity: { multiple: true } } },
  ],
  {
    guard: (config) => {
      // Per-entity overrides (name/icon/attention_state) cannot be expressed by an
      // entity picker; hand those configs to the YAML editor rather than flatten them.
      const entities = config['entities'];
      if (Array.isArray(entities) && entities.some((e) => typeof e === 'object' && e !== null)) {
        throw new Error('status-card: per-entity overrides are edited in YAML');
      }
    },
  },
);

/** binary_sensor device classes where "on" means something needs attention */
const ON_IS_ATTENTION = new Set([
  'moisture',
  'smoke',
  'gas',
  'carbon_monoxide',
  'problem',
  'safety',
  'tamper',
  'vibration',
  'motion',
  'occupancy',
  'door',
  'window',
  'opening',
  'garage_door',
  'lock',
  'sound',
  'heat',
  'cold',
  'update',
]);
/** binary_sensor device classes where "off" means something needs attention */
const OFF_IS_ATTENTION = new Set(['connectivity', 'plug', 'power', 'presence', 'battery_charging']);

const CLASS_ICON: Record<string, [string, string]> = {
  moisture: ['mdi:water-off', 'mdi:water-alert'],
  smoke: ['mdi:smoke-detector', 'mdi:smoke-detector-alert'],
  gas: ['mdi:gas-cylinder', 'mdi:gas-cylinder'],
  motion: ['mdi:motion-sensor-off', 'mdi:motion-sensor'],
  occupancy: ['mdi:home-outline', 'mdi:home'],
  door: ['mdi:door-closed', 'mdi:door-open'],
  window: ['mdi:window-closed-variant', 'mdi:window-open-variant'],
  opening: ['mdi:square', 'mdi:square-outline'],
  garage_door: ['mdi:garage', 'mdi:garage-open'],
  lock: ['mdi:lock', 'mdi:lock-open'],
  connectivity: ['mdi:lan-disconnect', 'mdi:lan-connect'],
  plug: ['mdi:power-plug-off', 'mdi:power-plug'],
  power: ['mdi:power-off', 'mdi:power'],
  battery: ['mdi:battery', 'mdi:battery-alert'],
  battery_charging: ['mdi:battery', 'mdi:battery-charging'],
  running: ['mdi:stop', 'mdi:play'],
  problem: ['mdi:check-circle', 'mdi:alert-circle'],
  safety: ['mdi:check-circle', 'mdi:alert'],
  presence: ['mdi:account-off', 'mdi:account'],
  tamper: ['mdi:shield-check', 'mdi:shield-alert'],
  vibration: ['mdi:vibrate-off', 'mdi:vibrate'],
  update: ['mdi:package', 'mdi:package-up'],
};

export class StatusCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: StatusCardConfig;

  static styles = [
    sharedStyles,
    css`
      .summary {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--cc-muted-bg);
        color: var(--secondary-text-color);
      }
      .summary.alert {
        background: color-mix(in srgb, var(--error-color, #f44336) 16%, transparent);
        color: var(--error-color, #f44336);
        font-weight: 500;
      }
      .list {
        display: flex;
        flex-direction: column;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        cursor: pointer;
      }
      .row:last-child {
        border-bottom: none;
      }
      .row .icon-bubble {
        width: 34px;
        height: 34px;
      }
      .row .icon-bubble ha-icon {
        --mdc-icon-size: 19px;
      }
      .row .name {
        flex: 1;
        min-width: 0;
        font-size: 0.88rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .when {
        font-size: 0.7rem;
        color: var(--secondary-text-color);
      }
      .row .state {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }
      .attention .icon-bubble {
        background: color-mix(in srgb, var(--error-color, #f44336) 16%, transparent);
        color: var(--error-color, #f44336);
      }
      .attention .state {
        color: var(--error-color, #f44336);
        font-weight: 500;
      }
      .ok .icon-bubble {
        background: color-mix(in srgb, var(--success-color, #4caf50) 14%, transparent);
        color: var(--success-color, #4caf50);
      }
      .tile.attention {
        background: color-mix(in srgb, var(--error-color, #f44336) 16%, transparent);
        color: var(--error-color, #f44336);
      }
      .tile.attention .tile-name {
        color: var(--error-color, #f44336);
      }
      .tile.ok {
        color: var(--success-color, #4caf50);
      }
    `,
  ];

  setConfig(config: StatusCardConfig) {
    if (!config.entities?.length) throw new Error("status-card: 'entities' is required");
    this._config = { layout: 'list', show_last_changed: true, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-status-card-editor');
  }

  static getStubConfig(): Omit<StatusCardConfig, 'type'> {
    return { name: 'Safety', entities: ['binary_sensor.water_leak'], layout: 'list' };
  }

  getCardSize() {
    return (
      1 +
      Math.ceil(this._config?.entities.length ?? 0) * (this._config?.layout === 'grid' ? 0.4 : 0.7)
    );
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private _normalize(item: string | StatusCardEntity): StatusCardEntity {
    return typeof item === 'string' ? { entity: item } : item;
  }

  private _needsAttention(cfg: StatusCardEntity, entity?: HassEntity): boolean {
    if (!entity || isUnavailable(entity)) return false;
    if (cfg.attention_state != null) {
      const states = Array.isArray(cfg.attention_state)
        ? cfg.attention_state
        : [cfg.attention_state];
      return states.includes(entity.state);
    }
    const [domain] = cfg.entity.split('.');
    const cls = entity.attributes['device_class'] as string | undefined;
    if (domain === 'binary_sensor') {
      if (cls && OFF_IS_ATTENTION.has(cls)) return entity.state === 'off';
      if (cls && ON_IS_ATTENTION.has(cls)) return entity.state === 'on';
      return entity.state === 'on';
    }
    if (domain === 'sensor' && cls === 'battery') return parseFloat(entity.state) <= 20;
    if (domain === 'sensor' && cls === 'enum')
      return ['error', 'actionrequired', 'alarm', 'problem'].includes(entity.state);
    if (domain === 'lock') return entity.state !== 'locked';
    if (domain === 'cover') return entity.state === 'open';
    if (domain === 'alarm_control_panel') return entity.state === 'triggered';
    return false;
  }

  private _icon(cfg: StatusCardEntity, entity: HassEntity | undefined, attention: boolean): string {
    if (cfg.icon) return cfg.icon;
    const custom = entity?.attributes['icon'] as string | undefined;
    if (custom) return custom;
    const cls = entity?.attributes['device_class'] as string | undefined;
    const [domain] = cfg.entity.split('.');
    if (domain === 'binary_sensor' && cls && CLASS_ICON[cls])
      return CLASS_ICON[cls][entity?.state === 'on' ? 1 : 0];
    if (domain === 'sensor' && cls === 'battery') return CLASS_ICON.battery[attention ? 1 : 0];
    if (domain === 'lock') return entity?.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open';
    if (domain === 'cover')
      return entity?.state === 'open' ? 'mdi:window-open-variant' : 'mdi:window-closed-variant';
    return attention ? 'mdi:alert-circle' : 'mdi:check-circle-outline';
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const items = this._config.entities.map((i) => this._normalize(i));
    const rows = items.map((cfg) => {
      const entity = this.hass.states[cfg.entity];
      const attention = this._needsAttention(cfg, entity);
      return { cfg, entity, attention, unavailable: isUnavailable(entity) };
    });
    const alerts = rows.filter((r) => r.attention).length;
    const grid = this._config.layout === 'grid';

    return html`
      <ha-card>
        ${
          this._config.name || alerts
            ? html`<div class="header">
                <div class="title">${this._config.name ?? ''}</div>
                <span class="summary ${alerts ? 'alert' : ''}"
                  >${alerts ? `${alerts} alert${alerts > 1 ? 's' : ''}` : 'All clear'}</span
                >
              </div>`
            : nothing
        }
        ${
          grid
            ? html`<div class="tile-grid">
                ${rows.map(
                  ({ cfg, entity, attention, unavailable }) =>
                    html`<button
                      class="tile ${attention ? 'attention' : unavailable ? 'unavailable' : 'ok'}"
                      @click=${() => fireMoreInfo(this, cfg.entity)}
                    >
                      <ha-icon icon=${this._icon(cfg, entity, attention)}></ha-icon>
                      <span class="tile-name"
                        >${friendlyName(this.hass, cfg.entity, cfg.name)}</span
                      >
                      <span class="tile-state">${formatState(this.hass, entity)}</span>
                    </button>`,
                )}
              </div>`
            : html`<div class="list">
                ${rows.map(
                  ({ cfg, entity, attention, unavailable }) =>
                    html`<div
                      class="row ${attention ? 'attention' : unavailable ? 'unavailable' : 'ok'}"
                      @click=${() => fireMoreInfo(this, cfg.entity)}
                    >
                      <div class="icon-bubble">
                        <ha-icon icon=${this._icon(cfg, entity, attention)}></ha-icon>
                      </div>
                      <div style="flex:1;min-width:0">
                        <div class="name">${friendlyName(this.hass, cfg.entity, cfg.name)}</div>
                        ${this._config.show_last_changed && entity ? html`<div class="when">${relativeTime(entity.last_changed, lang(this.hass))}</div>` : nothing}
                      </div>
                      <span class="state">${formatState(this.hass, entity)}</span>
                    </div>`,
                )}
              </div>`
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-status-card', StatusCard);
