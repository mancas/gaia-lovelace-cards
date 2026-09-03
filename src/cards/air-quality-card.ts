import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, AirQualityCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  numericState,
  formatNumber,
  formatState,
} from '../helpers.js';

defineEditor(
  'custom-air-quality-card-editor',
  [
    { name: 'name', selector: { text: {} } },
    { name: 'quality', selector: { entity: { domain: 'sensor' } } },
    { name: 'co2', selector: { entity: { domain: 'sensor', device_class: 'carbon_dioxide' } } },
    { name: 'pm25', selector: { entity: { domain: 'sensor', device_class: 'pm25' } } },
    { name: 'voc', selector: { entity: { domain: 'sensor' } } },
    {
      name: 'temperature',
      selector: { entity: { domain: 'sensor', device_class: 'temperature' } },
    },
    { name: 'humidity', selector: { entity: { domain: 'sensor', device_class: 'humidity' } } },
  ],
  {
    co2: 'CO₂ sensor',
    pm25: 'PM2.5 sensor',
    voc: 'VOC sensor',
    quality: 'Air quality (enum) sensor',
  },
);

type Level = 'good' | 'fair' | 'poor' | 'bad';

const LEVEL_COLOR: Record<Level, string> = {
  good: 'var(--success-color, #4caf50)',
  fair: 'var(--custom-aq-fair-color, #8bc34a)',
  poor: 'var(--warning-color, #ff9800)',
  bad: 'var(--error-color, #f44336)',
};

const QUALITY_LEVEL: Record<string, Level> = {
  good: 'good',
  fair: 'fair',
  moderate: 'poor',
  poor: 'poor',
  very_poor: 'bad',
  extremely_poor: 'bad',
  unhealthy: 'bad',
};

function levelFor(
  value: number | undefined,
  thresholds: [number, number, number],
): Level | undefined {
  if (value == null) return undefined;
  if (value < thresholds[0]) return 'good';
  if (value < thresholds[1]) return 'fair';
  if (value < thresholds[2]) return 'poor';
  return 'bad';
}

export class AirQualityCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: AirQualityCardConfig;

  static styles = [
    sharedStyles,
    css`
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 500;
        background: color-mix(in srgb, var(--level-color) 18%, transparent);
        color: var(--level-color);
        cursor: pointer;
      }
      .badge ha-icon {
        --mdc-icon-size: 18px;
      }
      .sensor-tile {
        border-left: 3px solid var(--tile-border, transparent);
        cursor: pointer;
      }
      .sensor-tile .value {
        color: var(--tile-color, var(--primary-text-color));
      }
      .bar {
        height: 4px;
        border-radius: 2px;
        background: var(--cc-muted-bg);
        margin-top: 8px;
        overflow: hidden;
      }
      .bar div {
        height: 100%;
        background: var(--tile-color, var(--cc-accent));
        border-radius: 2px;
        transition: width 0.4s;
      }
    `,
  ];

  setConfig(config: AirQualityCardConfig) {
    if (
      !config.quality &&
      !config.co2 &&
      !config.pm25 &&
      !config.voc &&
      !config.temperature &&
      !config.humidity
    ) {
      throw new Error('air-quality-card: configure at least one sensor');
    }
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement('custom-air-quality-card-editor');
  }

  static getStubConfig(): Omit<AirQualityCardConfig, 'type'> {
    return { name: 'Air quality', co2: 'sensor.co2', pm25: 'sensor.pm25' };
  }

  getCardSize() {
    return 3;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private _tile(
    entityId: string | undefined,
    label: string,
    level: Level | undefined,
    unit: string,
    decimals = 0,
    max?: number,
  ) {
    if (!entityId) return nothing;
    const v = numericState(this.hass, entityId);
    const color = level ? LEVEL_COLOR[level] : 'var(--primary-text-color)';
    const border = level ? LEVEL_COLOR[level] : 'transparent';
    const pct = max != null && v != null ? Math.min(100, (v / max) * 100) : undefined;
    return html`<div
      class="sensor-tile"
      style="--tile-color:${color};--tile-border:${border}"
      @click=${() => fireMoreInfo(this, entityId)}
    >
      <div class="label">${label}</div>
      <div class="value">${formatNumber(v, decimals)}<small>${unit}</small></div>
      ${pct != null ? html`<div class="bar"><div style="width:${pct}%"></div></div>` : nothing}
    </div>`;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const co2 = numericState(this.hass, c.co2);
    const pm25 = numericState(this.hass, c.pm25);
    const voc = numericState(this.hass, c.voc);
    const qualityEntity = c.quality ? this.hass.states[c.quality] : undefined;
    const qualityLevel = qualityEntity ? QUALITY_LEVEL[qualityEntity.state] : undefined;
    const co2Level = levelFor(co2, [800, 1000, 1500]);
    const pmLevel = levelFor(pm25, [12, 35, 55]);
    const vocLevel = levelFor(voc, [100, 250, 400]);
    const overall: Level =
      qualityLevel ??
      ([co2Level, pmLevel, vocLevel].filter(Boolean) as Level[]).sort(
        (a, b) =>
          ['good', 'fair', 'poor', 'bad'].indexOf(b) - ['good', 'fair', 'poor', 'bad'].indexOf(a),
      )[0] ??
      'good';
    const overallLabel = qualityEntity
      ? formatState(this.hass, qualityEntity)
      : { good: 'Good', fair: 'Fair', poor: 'Poor', bad: 'Bad' }[overall];
    const overallIcon = {
      good: 'mdi:leaf',
      fair: 'mdi:leaf',
      poor: 'mdi:alert-circle-outline',
      bad: 'mdi:alert',
    }[overall];
    const tapEntity = c.quality ?? c.co2 ?? c.pm25 ?? c.voc;

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${c.name ?? 'Air quality'}</div>
          <div
            class="badge"
            style="--level-color:${LEVEL_COLOR[overall]}"
            @click=${() => tapEntity && fireMoreInfo(this, tapEntity)}
          >
            <ha-icon icon=${overallIcon}></ha-icon>${overallLabel}
          </div>
        </div>
        <div class="sensor-grid">
          ${this._tile(c.co2, 'CO₂', co2Level, ' ppm', 0, 2000)}
          ${this._tile(c.pm25, 'PM2.5', pmLevel, ' µg/m³', 0, 75)}
          ${this._tile(c.voc, 'VOC', vocLevel, '', 0, 500)}
          ${this._tile(c.temperature, 'Temperature', undefined, '°', 1)}
          ${this._tile(c.humidity, 'Humidity', undefined, '%', 0)}
        </div>
      </ha-card>
    `;
  }
}

customElements.define('custom-air-quality-card', AirQualityCard);
