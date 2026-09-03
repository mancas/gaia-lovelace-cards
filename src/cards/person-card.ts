import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, PersonCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  friendlyName,
  numericState,
  formatState,
  relativeTime,
  lang,
} from '../helpers.js';

defineEditor('custom-person-card-editor', [
  {
    name: 'entity',
    required: true,
    selector: { entity: { domain: ['person', 'device_tracker'] } },
  },
  { name: 'name', selector: { text: {} } },
  { name: 'battery', selector: { entity: { domain: 'sensor', device_class: 'battery' } } },
  { name: 'battery_state', selector: { entity: { domain: 'sensor' } } },
  { name: 'activity', selector: { entity: { domain: 'sensor' } } },
  { name: 'location', selector: { entity: { domain: 'sensor' } } },
  { name: 'steps', selector: { entity: { domain: 'sensor' } } },
]);

function batteryIcon(level: number | undefined, charging: boolean): string {
  if (level == null) return 'mdi:battery-unknown';
  const step = Math.max(10, Math.min(100, Math.round(level / 10) * 10));
  if (charging) return level >= 100 ? 'mdi:battery-charging-100' : `mdi:battery-charging-${step}`;
  return level >= 100 ? 'mdi:battery' : `mdi:battery-${step}`;
}

export class PersonCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: PersonCardConfig;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        cursor: pointer;
      }
      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--cc-muted-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        font-size: 1.1rem;
        color: var(--secondary-text-color);
        overflow: hidden;
        flex-shrink: 0;
        position: relative;
        border: 2px solid var(--presence-color);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .dot {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--presence-color);
        border: 2px solid var(--card-background-color, #fff);
      }
      .presence {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 4px;
        font-size: 0.8rem;
        color: var(--presence-color);
        font-weight: 500;
      }
      .presence ha-icon {
        --mdc-icon-size: 16px;
      }
      .presence .since {
        color: var(--secondary-text-color);
        font-weight: 400;
        white-space: nowrap;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        font-size: 0.78rem;
        color: var(--secondary-text-color);
      }
      .meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
      }
      .meta ha-icon {
        --mdc-icon-size: 16px;
      }
      .meta .low {
        color: var(--error-color, #f44336);
      }
      .location {
        font-size: 0.78rem;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  setConfig(config: PersonCardConfig) {
    if (!config.entity) throw new Error("person-card: 'entity' is required");
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement('custom-person-card-editor');
  }

  static getStubConfig(): Omit<PersonCardConfig, 'type'> {
    return { entity: 'person.me' };
  }

  getCardSize() {
    return 2;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const entity = this.hass.states[c.entity];
    const name = friendlyName(this.hass, c.entity, c.name);
    const picture = entity?.attributes['entity_picture'] as string | undefined;
    const stateRaw = entity?.state ?? 'unknown';
    const home = stateRaw === 'home';
    const away = stateRaw === 'not_home';
    const presenceColor = home
      ? 'var(--state-person-home-color, var(--success-color, #4caf50))'
      : away
        ? 'var(--state-person-not-home-color, var(--secondary-text-color))'
        : 'var(--state-person-zone-color, var(--info-color, #2196f3))';
    const presenceLabel = entity ? formatState(this.hass, entity) : 'Unknown';
    const presenceIcon = home ? 'mdi:home' : away ? 'mdi:home-export-outline' : 'mdi:map-marker';
    const battery = numericState(this.hass, c.battery);
    const chargingRaw = c.battery_state
      ? (this.hass.states[c.battery_state]?.state?.toLowerCase() ?? '')
      : '';
    const charging = chargingRaw.includes('charging') && !chargingRaw.includes('not');
    const activity = c.activity ? this.hass.states[c.activity] : undefined;
    const steps = numericState(this.hass, c.steps);
    const location = c.location ? this.hass.states[c.location]?.state : undefined;
    const since = relativeTime(entity?.last_changed, lang(this.hass));

    return html`
      <ha-card
        @click=${() => fireMoreInfo(this, c.entity)}
        style="--presence-color:${presenceColor}"
      >
        <div class="header">
          <div class="avatar">
            ${picture ? html`<img src=${picture} alt=${name} />` : name.charAt(0).toUpperCase()}
            <div class="dot"></div>
          </div>
          <div style="flex:1;min-width:0">
            <div class="title">${name}</div>
            <div class="presence">
              <ha-icon icon=${presenceIcon}></ha-icon
              >${presenceLabel}${since ? html`<span class="since">· ${since}</span>` : nothing}
            </div>
          </div>
        </div>
        ${
          battery != null || activity || steps != null
            ? html`<div class="meta">
                ${
                  battery != null
                    ? html`<span class=${battery <= 20 && !charging ? 'low' : ''}
                        ><ha-icon icon=${batteryIcon(battery, charging)}></ha-icon
                        >${Math.round(battery)}%</span
                      >`
                    : nothing
                }
                ${activity && activity.state !== 'unknown' ? html`<span><ha-icon icon="mdi:run"></ha-icon>${formatState(this.hass, activity)}</span>` : nothing}
                ${steps != null ? html`<span><ha-icon icon="mdi:shoe-print"></ha-icon>${Math.round(steps).toLocaleString(lang(this.hass))}</span>` : nothing}
              </div>`
            : nothing
        }
        ${
          location && !home && location !== 'unknown' && location !== 'unavailable'
            ? html`<div class="location" title=${location}>
                <ha-icon icon="mdi:map-marker-outline" style="--mdc-icon-size:14px"></ha-icon>
                ${location.split('\n')[0]}
              </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-person-card', PersonCard);
