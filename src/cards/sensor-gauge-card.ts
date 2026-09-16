import { LitElement, html, css, svg, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, SensorGaugeCardConfig, SensorGaugeEntityConfig } from '../types.js';
import { prettify } from '../helpers.js';

const DEFAULT_THRESHOLDS = [
  { value: 0, color: '#4caf50' },
  { value: 60, color: '#ff9800' },
  { value: 80, color: '#f44336' },
];

const CARD_SCHEMA = [
  { name: 'name', selector: { text: {} } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'min', selector: { number: { min: -999, max: 999, step: 1, mode: 'box' } } },
      { name: 'max', selector: { number: { min: -999, max: 999, step: 1, mode: 'box' } } },
    ],
  },
  { name: 'unit', selector: { text: {} } },
  { name: 'style', selector: { select: { mode: 'dropdown', options: ['circular', 'linear'] } } },
  { name: 'thresholds', selector: { object: {} } },
];

const ENTITY_SCHEMA = [
  { name: 'entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'name', selector: { text: {} } },
  { name: 'unit', selector: { text: {} } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'min', selector: { number: { min: -999, max: 999, step: 1, mode: 'box' } } },
      { name: 'max', selector: { number: { min: -999, max: 999, step: 1, mode: 'box' } } },
    ],
  },
  { name: 'style', selector: { select: { mode: 'dropdown', options: ['circular', 'linear'] } } },
  { name: 'thresholds', selector: { object: {} } },
];

const CARD_HELPERS: Record<string, string> = {
  thresholds: "Default colour bands for all entities, e.g. - value: 60 / color: '#ff9800'",
  unit: 'Default unit applied to all entities unless overridden.',
  min: 'Default min applied to all entities unless overridden.',
  max: 'Default max applied to all entities unless overridden.',
  style: 'Default gauge style for all entities unless overridden.',
};

const ENTITY_HELPERS: Record<string, string> = {
  thresholds: 'Colour bands for this entity. Overrides card-level thresholds.',
  unit: 'Overrides card-level unit.',
  min: 'Overrides card-level min.',
  max: 'Overrides card-level max.',
  style: 'Overrides card-level style.',
};

class SensorGaugeCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config: SensorGaugeCardConfig = { type: '' };

  static styles = css`
    ha-form {
      display: block;
    }
    .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--secondary-text-color);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 16px 0 8px;
    }
    .section-title:first-child {
      margin-top: 0;
    }
    .entity-block {
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .entity-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .entity-block-title {
      font-size: 0.85rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--error-color, #f44336);
      padding: 4px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      flex-shrink: 0;
    }
    .remove-btn:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .add-btn {
      width: 100%;
      margin-top: 4px;
      background: none;
      border: 1px dashed var(--divider-color, #9e9e9e);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      color: var(--primary-color, #03a9f4);
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .add-btn:hover {
      background: var(--secondary-background-color);
    }
  `;

  setConfig(config: SensorGaugeCardConfig) {
    this._config = config ?? { type: '' };
  }

  private get _entities(): SensorGaugeEntityConfig[] {
    if (Array.isArray(this._config.entities) && this._config.entities.length > 0) {
      return this._config.entities;
    }
    return [{ entity: this._config.entity ?? '' }];
  }

  private get _cardData(): Record<string, unknown> {
    const { entity: _e, entities: _ents, type: _t, ...rest } = this._config;
    return rest as Record<string, unknown>;
  }

  private _clean(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) {
        out[k] = v;
      }
    }
    return out;
  }

  private _emit(entities: SensorGaugeEntityConfig[], cardData: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: {
          config: {
            type: this._config.type,
            ...this._clean(cardData),
            entities: entities.map(
              (ec) =>
                this._clean(
                  ec as unknown as Record<string, unknown>,
                ) as unknown as SensorGaugeEntityConfig,
            ),
          },
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _cardChanged(ev: Event) {
    ev.stopPropagation();
    const value = (ev as CustomEvent<{ value: Record<string, unknown> }>).detail.value;
    this._emit(this._entities, value);
  }

  private _entityChanged(ev: Event, index: number) {
    ev.stopPropagation();
    const value = (ev as CustomEvent<{ value: SensorGaugeEntityConfig }>).detail.value;
    const entities = this._entities.map((e, i) => (i === index ? { ...value } : e));
    this._emit(entities, this._cardData);
  }

  private _addEntity() {
    this._emit([...this._entities, { entity: '' }], this._cardData);
  }

  private _removeEntity(index: number) {
    const remaining = this._entities.filter((_, i) => i !== index);
    this._emit(remaining.length > 0 ? remaining : [{ entity: '' }], this._cardData);
  }

  render() {
    if (!this.hass) return nothing;
    const entities = this._entities;

    return html`
      <div>
        <div class="section-title">Card defaults</div>
        <ha-form
          .hass=${this.hass}
          .data=${this._cardData}
          .schema=${CARD_SCHEMA}
          .computeLabel=${(s: { name: string }) => prettify(s.name)}
          .computeHelper=${(s: { name: string }) => CARD_HELPERS[s.name] ?? ''}
          @value-changed=${this._cardChanged}
        ></ha-form>

        <div class="section-title">Entities</div>
        ${entities.map(
          (ec, i) => html`
            <div class="entity-block">
              <div class="entity-block-header">
                <span class="entity-block-title">
                  ${ec.name || ec.entity ? `${i + 1}. ${ec.name ?? ec.entity}` : `Entity ${i + 1}`}
                </span>
                <button
                  class="remove-btn"
                  ?disabled=${entities.length <= 1}
                  @click=${() => this._removeEntity(i)}
                >
                  <ha-icon icon="mdi:trash-can-outline"></ha-icon>
                  Remove
                </button>
              </div>
              <ha-form
                .hass=${this.hass}
                .data=${ec}
                .schema=${ENTITY_SCHEMA}
                .computeLabel=${(s: { name: string }) => prettify(s.name)}
                .computeHelper=${(s: { name: string }) => ENTITY_HELPERS[s.name] ?? ''}
                @value-changed=${(e: Event) => this._entityChanged(e, i)}
              ></ha-form>
            </div>
          `,
        )}

        <button class="add-btn" @click=${this._addEntity}>
          <ha-icon icon="mdi:plus"></ha-icon>
          Add entity
        </button>
      </div>
    `;
  }
}

if (!customElements.get('custom-sensor-gauge-card-editor')) {
  customElements.define('custom-sensor-gauge-card-editor', SensorGaugeCardEditor);
}

export class SensorGaugeCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SensorGaugeCardConfig;

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .gauges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
      width: 100%;
      justify-items: center;
    }
    .gauges-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .gauge-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .gauge-wrapper {
      position: relative;
      width: 120px;
      height: 120px;
    }
    svg {
      overflow: visible;
    }
    .value-label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .value {
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1;
    }
    .unit {
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .name {
      font-size: 0.9rem;
      font-weight: 500;
    }
    .entity-name {
      font-size: 0.8rem;
      font-weight: 500;
      text-align: center;
    }
    .linear-wrapper {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bar-track {
      width: 100%;
      height: 12px;
      border-radius: 6px;
      background: var(--custom-gauge-track-color, var(--secondary-background-color, #e0e0e0));
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.4s ease;
    }
    .linear-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      opacity: 0.7;
    }
  `;

  setConfig(config: SensorGaugeCardConfig) {
    const hasEntities = Array.isArray(config.entities) && config.entities.length > 0;
    if (!config.entity && !hasEntities) {
      throw new Error("sensor-gauge-card: 'entity' or 'entities' is required");
    }
    this._config = { min: 0, max: 100, style: 'circular', ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-sensor-gauge-card-editor');
  }

  static getStubConfig(hass?: HomeAssistant): Omit<SensorGaugeCardConfig, 'type'> {
    const entity =
      Object.keys(hass?.states ?? {}).find((e) => e.startsWith('sensor.')) ??
      'sensor.living_room_temperature';
    return {
      entity,
      unit:
        (hass?.states[entity]?.attributes?.['unit_of_measurement'] as string | undefined) ?? '°C',
      min: 0,
      max: 100,
      style: 'circular',
    };
  }

  private _resolveEntities(): SensorGaugeEntityConfig[] {
    if (Array.isArray(this._config.entities) && this._config.entities.length > 0) {
      return this._config.entities;
    }
    return [
      {
        entity: this._config.entity!,
        name: this._config.name,
        unit: this._config.unit,
        min: this._config.min,
        max: this._config.max,
        thresholds: this._config.thresholds,
        style: this._config.style,
      },
    ];
  }

  private _numericValueFor(entityId: string): number {
    const raw = this.hass?.states[entityId]?.state;
    return raw != null ? parseFloat(raw) : 0;
  }

  private _colorForValue(value: number, thresholds = this._config.thresholds): string {
    const t = thresholds ?? DEFAULT_THRESHOLDS;
    let color = t[0]?.color ?? '#4caf50';
    for (const band of t) {
      if (value >= band.value) color = band.color;
    }
    return color;
  }

  private _renderCircular(value: number, pct: number, color: string, unit: string) {
    const r = 48;
    const cx = 60,
      cy = 60;
    const circumference = 2 * Math.PI * r;
    const arc = circumference * 0.75;
    const dashOffset = arc - arc * pct;
    const startAngle = 135;
    const endAngle = startAngle + 270;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
    const sw = `var(--custom-gauge-stroke-width, 10)`;

    return html`
      <div class="gauge-wrapper">
        ${svg`
          <svg viewBox="0 0 120 120" width="120" height="120">
            <path d="${d}" fill="none"
              stroke="var(--custom-gauge-track-color,var(--secondary-background-color,#e0e0e0))"
              stroke-width="${sw}" stroke-linecap="round"/>
            <path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
              stroke-dasharray="${arc} ${circumference}"
              stroke-dashoffset="${dashOffset}"
              style="transition: stroke-dashoffset 0.4s ease, stroke 0.4s ease;"
            />
          </svg>
        `}
        <div class="value-label">
          <span class="value">${isNaN(value) ? '—' : value.toFixed(1)}</span>
          <span class="unit">${unit}</span>
        </div>
      </div>
    `;
  }

  private _renderLinear(
    value: number,
    pct: number,
    color: string,
    min: number,
    max: number,
    unit: string,
  ) {
    return html`
      <div class="linear-wrapper">
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct * 100}%;background:${color};"></div>
        </div>
        <div class="linear-row">
          <span>${min}</span>
          <span>${value.toFixed(1)} ${unit}</span>
          <span>${max}</span>
        </div>
      </div>
    `;
  }

  private _renderEntity(ec: SensorGaugeEntityConfig) {
    const min = ec.min ?? this._config.min ?? 0;
    const max = ec.max ?? this._config.max ?? 100;
    const value = this._numericValueFor(ec.entity);
    const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const color = this._colorForValue(value, ec.thresholds ?? this._config.thresholds);
    const style = ec.style ?? this._config.style ?? 'circular';
    const hassEntity = this.hass.states[ec.entity];
    const label =
      ec.name ?? (hassEntity?.attributes?.['friendly_name'] as string | undefined) ?? ec.entity;
    const unit = ec.unit ?? this._config.unit ?? '';

    const gauge =
      style === 'linear'
        ? this._renderLinear(value, pct, color, min, max, unit)
        : this._renderCircular(value, pct, color, unit);

    return html`<div class="gauge-item">${gauge}<span class="entity-name">${label}</span></div>`;
  }

  render() {
    if (!this._config || !this.hass) return nothing;

    const entities = this._resolveEntities();
    const isMulti = entities.length > 1;
    const cardName = this._config.name;

    // For a single entity without an explicit card name, show the entity's friendly name as before.
    const singleName =
      !isMulti && !cardName
        ? ((this.hass.states[entities[0].entity]?.attributes?.['friendly_name'] as
            string | undefined) ?? entities[0].entity)
        : undefined;

    const effectiveStyle = this._config.style ?? 'circular';
    const containerClass = effectiveStyle === 'linear' ? 'gauges-column' : 'gauges-grid';

    return html`
      <ha-card>
        ${cardName || singleName ? html`<div class="name">${cardName ?? singleName}</div>` : nothing}
        <div class="${containerClass}">${entities.map((ec) => this._renderEntity(ec))}</div>
      </ha-card>
    `;
  }
}

customElements.define('custom-sensor-gauge-card', SensorGaugeCard);
