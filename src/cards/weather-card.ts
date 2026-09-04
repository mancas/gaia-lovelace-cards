import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, WeatherCardConfig, GridOptions, ForecastEntry } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  friendlyName,
  fireMoreInfo,
  formatNumber,
  isUnavailable,
  lang,
} from '../helpers.js';

defineEditor('custom-weather-card-editor', [
  { name: 'entity', required: true, selector: { entity: { domain: 'weather' } } },
  { name: 'name', selector: { text: {} } },
  {
    name: 'forecast',
    selector: { select: { mode: 'dropdown', options: ['daily', 'hourly', 'none'] } },
  },
  { name: 'forecast_items', selector: { number: { min: 1, max: 10, mode: 'box' } } },
  { name: 'show_details', selector: { boolean: {} } },
]);

const CONDITION_META: Record<string, { icon: string; label: string; night?: string }> = {
  'clear-night': { icon: 'mdi:weather-night', label: 'Clear' },
  cloudy: { icon: 'mdi:weather-cloudy', label: 'Cloudy' },
  exceptional: { icon: 'mdi:alert-circle-outline', label: 'Exceptional' },
  fog: { icon: 'mdi:weather-fog', label: 'Fog' },
  hail: { icon: 'mdi:weather-hail', label: 'Hail' },
  lightning: { icon: 'mdi:weather-lightning', label: 'Thunder' },
  'lightning-rainy': { icon: 'mdi:weather-lightning-rainy', label: 'Storm' },
  partlycloudy: {
    icon: 'mdi:weather-partly-cloudy',
    label: 'Partly cloudy',
    night: 'mdi:weather-night-partly-cloudy',
  },
  pouring: { icon: 'mdi:weather-pouring', label: 'Pouring' },
  rainy: { icon: 'mdi:weather-rainy', label: 'Rain' },
  snowy: { icon: 'mdi:weather-snowy', label: 'Snow' },
  'snowy-rainy': { icon: 'mdi:weather-snowy-rainy', label: 'Sleet' },
  sunny: { icon: 'mdi:weather-sunny', label: 'Sunny', night: 'mdi:weather-night' },
  windy: { icon: 'mdi:weather-windy', label: 'Windy' },
  'windy-variant': { icon: 'mdi:weather-windy-variant', label: 'Windy' },
};

export class WeatherCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: WeatherCardConfig;
  @state() private _forecast: ForecastEntry[] = [];
  private _unsub?: () => Promise<void>;
  private _subscribedFor?: string;

  static styles = [
    sharedStyles,
    css`
      .hero {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .hero ha-icon.big {
        --mdc-icon-size: 56px;
        color: var(--cc-accent);
      }
      .temp {
        font-size: 2.4rem;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .temp small {
        font-size: 1rem;
        font-weight: 400;
        color: var(--secondary-text-color);
      }
      .condition {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }
      .details {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        font-size: 0.78rem;
        color: var(--secondary-text-color);
      }
      .details span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .details ha-icon {
        --mdc-icon-size: 16px;
      }
      .forecast {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin: 0 -4px;
        padding: 0 4px;
        scrollbar-width: none;
      }
      .forecast::-webkit-scrollbar {
        display: none;
      }
      .day {
        flex: 1 0 56px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 4px;
        border-radius: var(--cc-radius);
        background: var(--cc-muted-bg);
        font-size: 0.72rem;
      }
      .day .name {
        color: var(--secondary-text-color);
        text-transform: capitalize;
      }
      .day ha-icon {
        --mdc-icon-size: 22px;
        color: var(--cc-accent);
      }
      .day .hi {
        font-weight: 500;
      }
      .day .lo {
        color: var(--secondary-text-color);
      }
      .day .rain {
        color: var(--info-color, #2196f3);
        font-size: 0.65rem;
      }
      @container card (max-width: 380px) {
        .hero ha-icon.big {
          --mdc-icon-size: 44px;
        }
        .temp {
          font-size: 2rem;
        }
        .day {
          flex-basis: 52px;
        }
      }
    `,
  ];

  setConfig(config: WeatherCardConfig) {
    if (!config.entity) throw new Error("weather-card: 'entity' is required");
    this._config = { forecast: 'daily', forecast_items: 5, show_details: true, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-weather-card-editor');
  }

  static getStubConfig(): Omit<WeatherCardConfig, 'type'> {
    return { entity: 'weather.home', forecast: 'daily', forecast_items: 5, show_details: true };
  }

  getCardSize() {
    return this._config?.forecast === 'none' ? 2 : 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('hass') || changed.has('_config')) this._subscribe();
  }

  private _unsubscribe() {
    this._unsub?.().catch(() => undefined);
    this._unsub = undefined;
    this._subscribedFor = undefined;
  }

  private async _subscribe() {
    if (!this.hass?.connection || !this._config || !this.isConnected) return;
    const type = this._config.forecast ?? 'daily';
    const key = `${this._config.entity}|${type}`;
    if (type === 'none') {
      this._unsubscribe();
      this._forecast = [];
      return;
    }
    if (this._subscribedFor === key) return;
    this._unsubscribe();
    this._subscribedFor = key;
    try {
      this._unsub = await this.hass.connection.subscribeMessage<{ forecast: ForecastEntry[] }>(
        (msg) => {
          this._forecast = msg.forecast ?? [];
        },
        { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: this._config.entity },
      );
    } catch {
      this._subscribedFor = undefined;
    }
  }

  private _isNight(): boolean {
    const sun = this.hass?.states['sun.sun'];
    return sun?.state === 'below_horizon';
  }

  private _icon(condition: string | undefined, night = false) {
    const meta = condition ? CONDITION_META[condition] : undefined;
    if (!meta) return 'mdi:weather-cloudy';
    return night && meta.night ? meta.night : meta.icon;
  }

  private _dayLabel(iso: string, hourly: boolean) {
    const d = new Date(iso);
    const l = lang(this.hass);
    if (hourly) return d.toLocaleTimeString(l, { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString(l, { weekday: 'short' });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this.hass.states[this._config.entity];
    const attrs = entity?.attributes ?? {};
    const unavailable = isUnavailable(entity);
    const condition = entity?.state;
    const current = this._forecast.find((f) => f.datetime === attrs['forecast_time']);
    const meta = condition ? CONDITION_META[condition] : undefined;
    const name = friendlyName(this.hass, this._config.entity, this._config.name);
    const temp = current?.temperature ?? (attrs['temperature'] as number | undefined);
    const unit = (attrs['temperature_unit'] as string | undefined) ?? '°C';
    const apparent = attrs['apparent_temperature'] as number | undefined;
    const humidity = attrs['humidity'] as number | undefined;
    const wind = attrs['wind_speed'] as number | undefined;
    const windUnit = (attrs['wind_speed_unit'] as string | undefined) ?? 'km/h';
    const pressure = attrs['pressure'] as number | undefined;
    const pressureUnit = (attrs['pressure_unit'] as string | undefined) ?? 'hPa';
    const uv = attrs['uv_index'] as number | undefined;
    const hourly = this._config.forecast === 'hourly';
    const items = this._forecast.slice(0, this._config.forecast_items ?? 5);

    return html`
      <ha-card>
        <div
          class="header"
          @click=${() => fireMoreInfo(this, this._config.entity)}
          style="cursor:pointer"
        >
          <div class="title">${name}</div>
          <div class="subtitle">
            ${unavailable ? 'Unavailable' : (meta?.label ?? condition ?? '')}
          </div>
        </div>

        <div class="hero">
          <ha-icon class="big" icon=${this._icon(condition, this._isNight())}></ha-icon>
          <div>
            <div class="temp">${formatNumber(temp)}<small>${unit}</small></div>
            ${
              apparent != null && this._config.show_details
                ? html`<div class="condition">Feels like ${formatNumber(apparent)}${unit}</div>`
                : nothing
            }
          </div>
        </div>

        ${
          this._config.show_details
            ? html`<div class="details">
                ${humidity != null ? html`<span><ha-icon icon="mdi:water-percent"></ha-icon>${formatNumber(humidity, 0)}%</span>` : nothing}
                ${wind != null ? html`<span><ha-icon icon="mdi:weather-windy"></ha-icon>${formatNumber(wind, 0)} ${windUnit}</span>` : nothing}
                ${pressure != null ? html`<span><ha-icon icon="mdi:gauge"></ha-icon>${formatNumber(pressure, 0)} ${pressureUnit}</span>` : nothing}
                ${uv != null ? html`<span><ha-icon icon="mdi:sun-wireless-outline"></ha-icon>UV ${formatNumber(uv, 0)}</span>` : nothing}
              </div>`
            : nothing
        }
        ${
          items.length
            ? html`<div class="forecast">
                ${items.map(
                  (f) =>
                    html`<div class="day">
                      <span class="name">${this._dayLabel(f.datetime, hourly)}</span>
                      <ha-icon
                        icon=${this._icon(f.condition, hourly && new Date(f.datetime).getHours() >= 21)}
                      ></ha-icon>
                      <span class="hi">${formatNumber(f.temperature, 0)}°</span>
                      ${!hourly && f.templow != null ? html`<span class="lo">${formatNumber(f.templow, 0)}°</span>` : nothing}
                      ${
                        f.precipitation_probability != null && f.precipitation_probability > 0
                          ? html`<span class="rain"
                              >${Math.round(f.precipitation_probability)}%</span
                            >`
                          : nothing
                      }
                    </div>`,
                )}
              </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-weather-card', WeatherCard);
