import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, AirQualityCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  numericState,
  formatNumber,
  formatState,
  lang,
} from '../helpers.js';

defineEditor(
  'custom-air-quality-card-editor',
  [
    { name: 'name', selector: { text: {} } },
    {
      name: 'style',
      selector: { select: { mode: 'dropdown', options: ['scale', 'hero', 'tiles'] } },
    },
    { name: 'quality', selector: { entity: { domain: 'sensor' } } },
    { name: 'co2', selector: { entity: { domain: 'sensor', device_class: 'carbon_dioxide' } } },
    { name: 'pm25', selector: { entity: { domain: 'sensor', device_class: 'pm25' } } },
    { name: 'voc', selector: { entity: { domain: 'sensor' } } },
    {
      name: 'temperature',
      selector: { entity: { domain: 'sensor', device_class: 'temperature' } },
    },
    { name: 'humidity', selector: { entity: { domain: 'sensor', device_class: 'humidity' } } },
    { name: 'show_comfort', selector: { boolean: {} } },
  ],
  {
    labels: {
      style: 'Visual style',
      co2: 'CO₂ sensor',
      pm25: 'PM2.5 sensor',
      voc: 'VOC sensor',
      quality: 'Air quality (enum) sensor',
      show_comfort: 'Show temperature & humidity',
    },
    helpers: {
      style: 'scale: one bar per pollutant · hero: single verdict · tiles: value grid',
      thresholds: 'Custom thresholds stay editable in YAML',
    },
  },
);

type Level = 'good' | 'fair' | 'poor' | 'bad';

const LEVEL_ORDER: Level[] = ['good', 'fair', 'poor', 'bad'];

const LEVEL_COLOR: Record<Level, string> = {
  good: 'var(--custom-aq-good-color, var(--success-color, #4caf50))',
  fair: 'var(--custom-aq-fair-color, #9ccc65)',
  poor: 'var(--custom-aq-poor-color, var(--warning-color, #ff9800))',
  bad: 'var(--custom-aq-bad-color, var(--error-color, #f44336))',
};

const LEVEL_LABEL: Record<Level, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  bad: 'Unhealthy',
};

const LEVEL_ICON: Record<Level, string> = {
  good: 'mdi:leaf',
  fair: 'mdi:leaf',
  poor: 'mdi:window-open-variant',
  bad: 'mdi:alert-circle',
};

/** Maps the state of an enum air-quality sensor onto our four levels. */
const QUALITY_LEVEL: Record<string, Level> = {
  excellent: 'good',
  good: 'good',
  fair: 'fair',
  moderate: 'poor',
  poor: 'poor',
  very_poor: 'bad',
  extremely_poor: 'bad',
  unhealthy: 'bad',
  severe: 'bad',
  hazardous: 'bad',
};

type MetricKey = 'co2' | 'pm25' | 'voc';

interface MetricSpec {
  label: string;
  icon: string;
  unit: string;
  /** [fair, poor, unhealthy] */
  thresholds: [number, number, number];
  /** Range the scale bar spans */
  min: number;
  max: number;
  decimals: number;
  /** What to do about it, per level */
  advice: Partial<Record<Level, string>>;
}

const SPECS: Record<MetricKey, MetricSpec> = {
  co2: {
    label: 'CO₂',
    icon: 'mdi:molecule-co2',
    unit: 'ppm',
    thresholds: [800, 1000, 1500],
    min: 400,
    max: 2000,
    decimals: 0,
    advice: { fair: 'slightly stuffy', poor: 'ventilate soon', bad: 'ventilate now' },
  },
  pm25: {
    label: 'PM2.5',
    icon: 'mdi:grain',
    unit: 'µg/m³',
    thresholds: [12, 35, 55],
    min: 0,
    max: 75,
    decimals: 0,
    advice: { fair: 'slightly hazy', poor: 'consider filtering', bad: 'avoid opening windows' },
  },
  voc: {
    label: 'VOC',
    icon: 'mdi:flask-outline',
    unit: '',
    thresholds: [100, 250, 400],
    min: 0,
    max: 500,
    decimals: 0,
    advice: { fair: 'slightly elevated', poor: 'ventilate soon', bad: 'ventilate now' },
  },
};

interface Metric extends MetricSpec {
  key: MetricKey;
  entity: string;
  value?: number;
  level?: Level;
  /** 0–100 position of the value along min…max */
  pos: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export class AirQualityCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: AirQualityCardConfig;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        --lvl: var(--secondary-text-color);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 500;
        background: color-mix(in srgb, var(--lvl) 18%, transparent);
        color: var(--lvl);
        white-space: nowrap;
        cursor: pointer;
        flex-shrink: 0;
      }
      .badge ha-icon {
        --mdc-icon-size: 17px;
      }

      /* ---------- comfort strip (all styles) ---------- */
      .comfort {
        display: flex;
        gap: 18px;
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        padding-top: 11px;
        margin-top: auto;
      }
      .comfort .item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        cursor: pointer;
        min-width: 0;
      }
      .comfort .item ha-icon {
        --mdc-icon-size: 18px;
      }
      .comfort .item b {
        font-weight: 500;
        color: var(--primary-text-color);
        font-size: 0.95rem;
        font-variant-numeric: tabular-nums;
      }

      /* ---------- style: scale ---------- */
      .rows {
        display: flex;
        flex-direction: column;
        gap: 13px;
      }
      .prow {
        display: flex;
        flex-direction: column;
        gap: 6px;
        cursor: pointer;
      }
      .plabel {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-size: 0.8rem;
        color: var(--secondary-text-color);
      }
      .plabel .nm {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .plabel .v {
        font-size: 1.05rem;
        font-weight: 500;
        color: var(--primary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .plabel .u {
        font-size: 0.72rem;
      }
      .track {
        position: relative;
        height: 7px;
        border-radius: 4px;
        opacity: 0.55;
      }
      .track .mk {
        position: absolute;
        top: -3px;
        left: clamp(3px, var(--pos), calc(100% - 3px));
        transform: translateX(-50%);
        width: 5px;
        height: 13px;
        border-radius: 3px;
        background: var(--primary-text-color);
        box-shadow: 0 0 0 2px var(--card-background-color, #fff);
      }
      .hint {
        font-size: 0.72rem;
        color: var(--row-color);
      }

      /* ---------- style: hero ---------- */
      .hero {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .ringwrap {
        position: relative;
        width: 64px;
        height: 64px;
        flex-shrink: 0;
        cursor: pointer;
      }
      .ringwrap svg {
        display: block;
        transform: rotate(-90deg);
      }
      .ringwrap circle {
        fill: none;
        stroke-width: 6;
        stroke-linecap: round;
      }
      .ringwrap .bg {
        stroke: var(--cc-muted-bg);
      }
      .ringwrap .fg {
        stroke: var(--lvl);
        transition: stroke-dasharray 0.5s ease;
      }
      .ringwrap ha-icon {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 24px;
        height: 24px;
        --mdc-icon-size: 24px;
        color: var(--lvl);
      }
      .hmeta {
        min-width: 0;
        flex: 1;
      }
      .hstat {
        font-size: 1.5rem;
        font-weight: 500;
        line-height: 1.1;
        color: var(--lvl);
      }
      .hsub {
        font-size: 0.82rem;
        color: var(--secondary-text-color);
        margin-top: 3px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border-radius: 10px;
        background: var(--cc-muted-bg);
        font-size: 0.8rem;
        min-width: 0;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .chip:hover {
        transform: scale(1.04);
      }
      .chip .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--row-color);
        flex-shrink: 0;
      }
      .chip ha-icon {
        --mdc-icon-size: 16px;
        color: var(--secondary-text-color);
      }
      .chip .k {
        color: var(--secondary-text-color);
      }
      .chip .v {
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }

      /* ---------- style: tiles ---------- */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
        gap: 9px;
      }
      .qtile {
        background: var(--cc-muted-bg);
        border-radius: 11px;
        padding: 11px 12px;
        min-width: 0;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .qtile:hover {
        transform: scale(1.04);
      }
      .qtile .k {
        font-size: 0.72rem;
        color: var(--secondary-text-color);
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .qtile .k ha-icon {
        --mdc-icon-size: 15px;
      }
      .qtile .v {
        font-size: 1.3rem;
        font-weight: 500;
        margin-top: 3px;
        line-height: 1.15;
        color: var(--row-color);
        font-variant-numeric: tabular-nums;
      }
      .qtile .v small {
        font-size: 0.68rem;
        font-weight: 400;
        color: var(--secondary-text-color);
        margin-left: 3px;
      }
      .segs {
        display: flex;
        gap: 3px;
        margin-top: 9px;
      }
      .segs i {
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: var(--divider-color, rgba(0, 0, 0, 0.15));
      }
      .segs i.on {
        background: var(--row-color);
      }

      .empty {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }

      @container card (max-width: 300px) {
        .hero {
          gap: 10px;
        }
        .hstat {
          font-size: 1.25rem;
        }
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
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
    this._config = { style: 'scale', show_comfort: true, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-air-quality-card-editor');
  }

  static getStubConfig(): Omit<AirQualityCardConfig, 'type'> {
    return { name: 'Air quality', style: 'scale', co2: 'sensor.co2', pm25: 'sensor.pm25' };
  }

  getCardSize() {
    const n = this._metrics().length;
    if (this._config?.style === 'hero') return 3;
    if (this._config?.style === 'tiles') return 2 + Math.ceil(n / 2);
    return 2 + n;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ------------------------------------------------------------------ */

  private _metrics(): Metric[] {
    const c = this._config;
    if (!c) return [];
    return (['co2', 'pm25', 'voc'] as MetricKey[])
      .filter((k) => !!c[k])
      .map((key) => {
        const spec = { ...SPECS[key], thresholds: c.thresholds?.[key] ?? SPECS[key].thresholds };
        const entity = c[key] as string;
        const value = numericState(this.hass, entity);
        const [t1, t2, t3] = spec.thresholds;
        const level: Level | undefined =
          value == null
            ? undefined
            : value < t1
              ? 'good'
              : value < t2
                ? 'fair'
                : value < t3
                  ? 'poor'
                  : 'bad';
        const pos = value == null ? 0 : clamp(((value - spec.min) / (spec.max - spec.min)) * 100);
        return { ...spec, key, entity, value, level, pos };
      });
  }

  /** Worst level across the pollutants, or the enum sensor when one is configured. */
  private _overall(metrics: Metric[]): Level {
    const q = this._config.quality ? this.hass?.states[this._config.quality] : undefined;
    const fromEnum = q ? QUALITY_LEVEL[q.state] : undefined;
    if (fromEnum) return fromEnum;
    let worst: Level = 'good';
    for (const m of metrics) {
      if (m.level && LEVEL_ORDER.indexOf(m.level) > LEVEL_ORDER.indexOf(worst)) worst = m.level;
    }
    return worst;
  }

  /** The pollutant that sits furthest along its own scale — the reason for the verdict. */
  private _dominant(metrics: Metric[]): Metric | undefined {
    const withValue = metrics.filter((m) => m.value != null);
    if (!withValue.length) return undefined;
    return withValue.reduce((a, b) =>
      LEVEL_ORDER.indexOf(b.level ?? 'good') > LEVEL_ORDER.indexOf(a.level ?? 'good') ||
      (b.level === a.level && b.pos > a.pos)
        ? b
        : a,
    );
  }

  private _fmt(m: Metric): string {
    if (m.value == null) return '—';
    return m.value.toLocaleString(lang(this.hass), { maximumFractionDigits: m.decimals });
  }

  private _gradient(m: Metric): string {
    const stop = (v: number) => clamp(((v - m.min) / (m.max - m.min)) * 100).toFixed(1) + '%';
    const [t1, t2, t3] = m.thresholds;
    return `linear-gradient(90deg, ${LEVEL_COLOR.good} 0%, ${LEVEL_COLOR.good} ${stop(t1)}, ${LEVEL_COLOR.fair} ${stop(t1)}, ${LEVEL_COLOR.poor} ${stop(t2)}, ${LEVEL_COLOR.bad} ${stop(t3)}, ${LEVEL_COLOR.bad} 100%)`;
  }

  /* ------------------------------------------------------------------ */

  private _renderHeader(overall: Level, withBadge: boolean) {
    const c = this._config;
    const tap = c.quality ?? c.co2 ?? c.pm25 ?? c.voc;
    if (!c.name && !withBadge) return nothing;
    const q = c.quality ? this.hass.states[c.quality] : undefined;
    const label = q ? formatState(this.hass, q) : LEVEL_LABEL[overall];
    return html`<div class="header">
      <div class="title">${c.name ?? 'Air quality'}</div>
      ${
        withBadge
          ? html`<div class="badge" @click=${() => tap && fireMoreInfo(this, tap)}>
              <ha-icon icon=${LEVEL_ICON[overall]}></ha-icon>${label}
            </div>`
          : nothing
      }
    </div>`;
  }

  private _renderComfort() {
    const c = this._config;
    if (c.show_comfort === false || (!c.temperature && !c.humidity)) return nothing;
    const item = (entity: string | undefined, icon: string, unit: string, decimals: number) => {
      if (!entity) return nothing;
      const v = numericState(this.hass, entity);
      return html`<div class="item" @click=${() => fireMoreInfo(this, entity)}>
        <ha-icon icon=${icon}></ha-icon><b>${formatNumber(v, decimals)}${unit}</b>
      </div>`;
    };
    return html`<div class="comfort">
      ${item(c.temperature, 'mdi:thermometer', '°', 1)}
      ${item(c.humidity, 'mdi:water-percent', '%', 0)}
    </div>`;
  }

  private _renderScale(metrics: Metric[], overall: Level): TemplateResult {
    return html`
      ${this._renderHeader(overall, true)}
      ${
        metrics.length
          ? html`<div class="rows">
              ${metrics.map((m) => {
                const color = LEVEL_COLOR[m.level ?? 'good'];
                const advice =
                  m.level === 'poor' || m.level === 'bad' ? m.advice[m.level] : undefined;
                return html`<div
                  class="prow"
                  style="--row-color:${color}"
                  @click=${() => fireMoreInfo(this, m.entity)}
                >
                  <div class="plabel">
                    <span class="nm">${m.label}</span>
                    <span class="v">${this._fmt(m)}</span>
                    <span class="u">${m.unit}</span>
                  </div>
                  <div class="track" style="background:${this._gradient(m)}">
                    <div class="mk" style="--pos:${m.pos.toFixed(1)}%"></div>
                  </div>
                  ${advice ? html`<div class="hint">${advice}</div>` : nothing}
                </div>`;
              })}
            </div>`
          : html`<div class="empty">No pollutant sensors configured</div>`
      }
      ${this._renderComfort()}
    `;
  }

  private _renderHero(metrics: Metric[], overall: Level): TemplateResult {
    const c = this._config;
    const dominant = this._dominant(metrics);
    const q = c.quality ? this.hass.states[c.quality] : undefined;
    const verdict = q ? formatState(this.hass, q) : LEVEL_LABEL[overall];
    const advice = dominant?.level
      ? (dominant.advice[dominant.level] ?? 'air is fresh')
      : undefined;
    const sub = dominant
      ? `${dominant.label} ${this._fmt(dominant)}${dominant.unit ? ' ' + dominant.unit : ''}${advice ? ' · ' + advice : ''}`
      : '';
    const R = 27;
    const C = 2 * Math.PI * R;
    const pct = dominant ? dominant.pos : 0;
    const tap = c.quality ?? dominant?.entity;

    return html`
      ${this._renderHeader(overall, false)}
      <div class="hero">
        <div class="ringwrap" @click=${() => tap && fireMoreInfo(this, tap)}>
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle class="bg" cx="32" cy="32" r=${R}></circle>
            <circle
              class="fg"
              cx="32"
              cy="32"
              r=${R}
              style="stroke-dasharray:${((pct / 100) * C).toFixed(1)} ${C.toFixed(1)}"
            ></circle>
          </svg>
          <ha-icon icon=${LEVEL_ICON[overall]}></ha-icon>
        </div>
        <div class="hmeta">
          <div class="hstat">${verdict}</div>
          ${sub ? html`<div class="hsub">${sub}</div>` : nothing}
        </div>
      </div>
      ${
        metrics.length || c.temperature || c.humidity
          ? html`<div class="chips">
              ${metrics.map(
                (m) =>
                  html`<div
                    class="chip"
                    style="--row-color:${LEVEL_COLOR[m.level ?? 'good']}"
                    @click=${() => fireMoreInfo(this, m.entity)}
                  >
                    <span class="dot"></span><span class="k">${m.label}</span>
                    <span class="v">${this._fmt(m)}</span>
                  </div>`,
              )}
              ${
                c.show_comfort !== false && c.temperature
                  ? html`<div class="chip" @click=${() => fireMoreInfo(this, c.temperature!)}>
                      <ha-icon icon="mdi:thermometer"></ha-icon>
                      <span class="v"
                        >${formatNumber(numericState(this.hass, c.temperature), 1)}°</span
                      >
                    </div>`
                  : nothing
              }
              ${
                c.show_comfort !== false && c.humidity
                  ? html`<div class="chip" @click=${() => fireMoreInfo(this, c.humidity!)}>
                      <ha-icon icon="mdi:water-percent"></ha-icon>
                      <span class="v"
                        >${formatNumber(numericState(this.hass, c.humidity), 0)}%</span
                      >
                    </div>`
                  : nothing
              }
            </div>`
          : nothing
      }
    `;
  }

  private _renderTiles(metrics: Metric[], overall: Level): TemplateResult {
    return html`
      ${this._renderHeader(overall, true)}
      ${
        metrics.length
          ? html`<div class="grid">
              ${metrics.map((m) => {
                const filled = m.level ? LEVEL_ORDER.indexOf(m.level) + 1 : 0;
                return html`<div
                  class="qtile"
                  style="--row-color:${LEVEL_COLOR[m.level ?? 'good']}"
                  @click=${() => fireMoreInfo(this, m.entity)}
                >
                  <div class="k"><ha-icon icon=${m.icon}></ha-icon>${m.label}</div>
                  <div class="v">
                    ${this._fmt(m)}${m.unit ? html`<small>${m.unit}</small>` : nothing}
                  </div>
                  <div class="segs">
                    ${LEVEL_ORDER.map((_, i) => html`<i class=${i < filled ? 'on' : ''}></i>`)}
                  </div>
                </div>`;
              })}
            </div>`
          : html`<div class="empty">No pollutant sensors configured</div>`
      }
      ${this._renderComfort()}
    `;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const metrics = this._metrics();
    const overall = this._overall(metrics);
    const body =
      this._config.style === 'hero'
        ? this._renderHero(metrics, overall)
        : this._config.style === 'tiles'
          ? this._renderTiles(metrics, overall)
          : this._renderScale(metrics, overall);
    return html`<ha-card style="--lvl:${LEVEL_COLOR[overall]}">${body}</ha-card>`;
  }
}

customElements.define('custom-air-quality-card', AirQualityCard);
