import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, RoomOverviewCardConfig, GridOptions } from '../types.js';
import { navigate } from '../helpers.js';

const SCHEMA = [
  { name: 'name', required: true, selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'navigation_path', selector: { text: {} } },
  {
    name: 'temperature_sensor',
    selector: { entity: { domain: 'sensor', device_class: 'temperature' } },
  },
  { name: 'humidity_sensor', selector: { entity: { domain: 'sensor', device_class: 'humidity' } } },
  { name: 'lights', selector: { entity: { domain: ['light', 'switch'], multiple: true } } },
  { name: 'switches', selector: { entity: { domain: 'switch', multiple: true } } },
  { name: 'fans', selector: { entity: { domain: 'fan', multiple: true } } },
  { name: 'climate', selector: { entity: { domain: 'climate', multiple: true } } },
];

class RoomOverviewCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: RoomOverviewCardConfig;

  set config(config: RoomOverviewCardConfig) {
    this._config = config;
  }

  render() {
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${SCHEMA}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }

  private _valueChanged(ev: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: (ev as CustomEvent<{ value: RoomOverviewCardConfig }>).detail.value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
customElements.define('custom-room-overview-card-editor', RoomOverviewCardEditor);

export class RoomOverviewCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: RoomOverviewCardConfig;

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      display: block;
      padding: 16px;
      container-type: inline-size;
      container-name: card;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 8px;
      min-width: 0;
    }
    .header.link {
      cursor: pointer;
    }
    .room-name {
      font-size: 1.1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .room-name span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .room-name ha-icon {
      --mdc-icon-size: 22px;
      color: var(--primary-color, #03a9f4);
      flex-shrink: 0;
    }
    .room-name .chevron {
      --mdc-icon-size: 18px;
      opacity: 0.5;
      color: inherit;
    }
    .sensors {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-shrink: 0;
    }
    .sensor-pill {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 0.8rem;
      background: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
      padding: 3px 8px;
      border-radius: 16px;
      white-space: nowrap;
    }
    .sensor-pill ha-icon {
      --mdc-icon-size: 16px;
    }
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      opacity: 0.55;
      margin: 12px 0 6px;
    }
    .entity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--custom-room-tile-size, 80px), 1fr));
      gap: 8px;
    }
    .entity-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 6px;
      border-radius: 12px;
      background: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
      cursor: pointer;
      transition:
        background 0.2s,
        transform 0.15s ease;
      min-width: 0;
    }
    .entity-tile:hover {
      transform: scale(1.04);
    }
    .entity-tile.active {
      background: var(--custom-room-active-bg, var(--primary-color, #03a9f4));
      color: var(--text-primary-color, #fff);
    }
    .entity-tile.unavailable {
      opacity: 0.4;
      pointer-events: none;
    }
    .entity-tile ha-icon {
      --mdc-icon-size: 22px;
    }
    .entity-tile .tile-name {
      font-size: 0.7rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }
    .entity-tile .tile-state {
      font-size: 0.65rem;
      opacity: 0.75;
    }
    .climate-tile {
      min-width: 0;
    }

    /* Narrow card: pills drop under the title, tiles get denser */
    @container card (max-width: 380px) {
      ha-card {
        padding: 14px;
      }
      .header {
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .room-name {
        flex-basis: 100%;
      }
      .entity-grid {
        grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      }
    }
    @container card (max-width: 220px) {
      .sensors {
        flex-wrap: wrap;
      }
    }
  `;

  setConfig(config: RoomOverviewCardConfig) {
    if (!config.name) throw new Error("room-overview-card: 'name' is required");
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement('custom-room-overview-card-editor');
  }

  getCardSize() {
    const c = this._config;
    if (!c) return 3;
    const sections = [c.lights, c.switches, c.fans, c.climate].filter((l) => l?.length).length;
    return 1 + sections * 2;
  }

  getGridOptions(): GridOptions {
    return { columns: 6, rows: 'auto', min_columns: 4 };
  }

  private _headerTap() {
    if (this._config.navigation_path) navigate(this, this._config.navigation_path);
  }

  static getStubConfig(): Omit<RoomOverviewCardConfig, 'type'> {
    return {
      name: 'Living Room',
      lights: ['light.living_room'],
      temperature_sensor: 'sensor.living_room_temperature',
      humidity_sensor: 'sensor.living_room_humidity',
      fans: ['fan.living_room'],
      climate: ['climate.living_room'],
    };
  }

  private _toggle(entityId: string) {
    const [domain] = entityId.split('.');
    this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  private _sensorValue(entityId: string | undefined, unit = ''): string {
    if (!entityId) return '';
    const v = this.hass?.states[entityId]?.state;
    const n = parseFloat(v ?? '');
    return Number.isFinite(n) ? `${Math.round(n)}${unit}` : '—';
  }

  private _renderTile(entityId: string, icon: string) {
    const entity = this.hass?.states[entityId];
    const isOn = entity?.state === 'on';
    const isUnavailable = entity?.state === 'unavailable';
    const name =
      (entity?.attributes?.['friendly_name'] as string) ??
      entityId.split('.')[1].replace(/_/g, ' ');
    return html`
      <div
        class="entity-tile ${isOn ? 'active' : ''} ${isUnavailable ? 'unavailable' : ''}"
        @click=${() => this._toggle(entityId)}
        title="${entityId}"
      >
        <ha-icon .icon=${icon}></ha-icon>
        <div class="tile-name">${name}</div>
      </div>
    `;
  }

  private _renderClimateTile(entityId: string) {
    const entity = this.hass?.states[entityId];
    const attrs = entity?.attributes as Record<string, unknown> | undefined;
    const isOn = entity?.state !== 'off';
    const isUnavailable = entity?.state === 'unavailable';
    const name = (attrs?.['friendly_name'] as string) ?? entityId.split('.')[1].replace(/_/g, ' ');
    const current = attrs?.['current_temperature'] as number | undefined;
    const target = attrs?.['temperature'] as number | undefined;
    const hvacMode = entity?.state ?? '';
    const modeIconMap: Record<string, string> = {
      heat: 'mdi:fire',
      cool: 'mdi:snowflake',
      heat_cool: 'mdi:sun-snowflake',
      fan_only: 'mdi:fan',
      dry: 'mdi:water-percent',
      off: 'mdi:air-conditioner',
    };
    const icon = modeIconMap[hvacMode] ?? 'mdi:air-conditioner';

    return html`
      <div
        class="entity-tile climate-tile ${isOn ? 'active' : ''} ${isUnavailable ? 'unavailable' : ''}"
        @click=${() => this._toggle(entityId)}
        title="${entityId}"
      >
        <ha-icon .icon=${icon}></ha-icon>
        <div class="tile-name">${name}</div>
        ${
          current != null
            ? html`<div class="tile-state">${current}° → ${target ?? '?'}°</div>`
            : nothing
        }
      </div>
    `;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const {
      name,
      icon,
      lights = [],
      switches = [],
      fans = [],
      climate = [],
      temperature_sensor,
      humidity_sensor,
      navigation_path,
    } = this._config;
    const temp = this._sensorValue(temperature_sensor, '°');
    const hum = this._sensorValue(humidity_sensor, '%');

    return html`
      <ha-card>
        <div class="header ${navigation_path ? 'link' : ''}" @click=${this._headerTap}>
          <div class="room-name">
            ${icon ? html`<ha-icon .icon=${icon}></ha-icon>` : nothing}
            <span>${name}</span>
            ${navigation_path ? html`<ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>` : nothing}
          </div>
          <div class="sensors">
            ${temp ? html`<div class="sensor-pill"><ha-icon icon="mdi:thermometer"></ha-icon>${temp}</div>` : nothing}
            ${hum ? html`<div class="sensor-pill"><ha-icon icon="mdi:water-percent"></ha-icon>${hum}</div>` : nothing}
          </div>
        </div>

        ${
          lights.length
            ? html`
                <div class="section-label">Lights</div>
                <div class="entity-grid">
                  ${lights.map((id) => this._renderTile(id, (this.hass.states[id]?.attributes?.['icon'] as string) ?? 'mdi:lightbulb'))}
                </div>
              `
            : nothing
        }
        ${
          switches.length
            ? html`
                <div class="section-label">Switches</div>
                <div class="entity-grid">
                  ${switches.map((id) => this._renderTile(id, this.hass.states[id]?.attributes?.['device_class'] === 'outlet' ? 'mdi:power-socket-eu' : 'mdi:power'))}
                </div>
              `
            : nothing
        }
        ${
          fans.length
            ? html`
                <div class="section-label">Fans</div>
                <div class="entity-grid">${fans.map((id) => this._renderTile(id, 'mdi:fan'))}</div>
              `
            : nothing
        }
        ${
          climate.length
            ? html`
                <div class="section-label">Climate</div>
                <div class="entity-grid">${climate.map((id) => this._renderClimateTile(id))}</div>
              `
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-room-overview-card', RoomOverviewCard);
