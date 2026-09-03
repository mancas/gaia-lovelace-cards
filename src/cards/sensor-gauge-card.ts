import { LitElement, html, css, svg, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, SensorGaugeCardConfig } from "../types.js";

const DEFAULT_THRESHOLDS = [
  { value: 0, color: "#4caf50" },
  { value: 60, color: "#ff9800" },
  { value: 80, color: "#f44336" },
];

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
  { name: "name", selector: { text: {} } },
  { name: "unit", selector: { text: {} } },
  { name: "min", selector: { number: { min: -999, max: 999, step: 1 } } },
  { name: "max", selector: { number: { min: -999, max: 999, step: 1 } } },
  { name: "style", selector: { select: { options: ["circular", "linear"] } } },
];

class SensorGaugeCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SensorGaugeCardConfig;

  set config(config: SensorGaugeCardConfig) {
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
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: (ev as CustomEvent<{ value: SensorGaugeCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-sensor-gauge-card-editor", SensorGaugeCardEditor);

export class SensorGaugeCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SensorGaugeCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .gauge-wrapper { position: relative; width: 120px; height: 120px; }
    svg { overflow: visible; }
    .value-label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .value { font-size: 1.6rem; font-weight: 700; line-height: 1; }
    .unit { font-size: 0.75rem; opacity: 0.7; }
    .name { font-size: 0.9rem; font-weight: 500; }
    .linear-wrapper { width: 100%; display: flex; flex-direction: column; gap: 4px; }
    .bar-track {
      width: 100%;
      height: 12px;
      border-radius: 6px;
      background: var(--custom-gauge-track-color, var(--secondary-background-color, #e0e0e0));
      overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
    .linear-row { display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.7; }
  `;

  setConfig(config: SensorGaugeCardConfig) {
    if (!config.entity) throw new Error("sensor-gauge-card: 'entity' is required");
    this._config = { min: 0, max: 100, style: "circular", ...config };
  }

  static getConfigElement() {
    return document.createElement("custom-sensor-gauge-card-editor");
  }

  static getStubConfig(): Omit<SensorGaugeCardConfig, "type"> {
    return { entity: "sensor.living_room_temperature", unit: "°C", min: 0, max: 40, style: "circular" };
  }

  private get _numericValue(): number {
    const raw = this.hass?.states[this._config.entity]?.state;
    return raw != null ? parseFloat(raw) : 0;
  }

  private _colorForValue(value: number): string {
    const thresholds = this._config.thresholds ?? DEFAULT_THRESHOLDS;
    let color = thresholds[0]?.color ?? "#4caf50";
    for (const t of thresholds) {
      if (value >= t.value) color = t.color;
    }
    return color;
  }

  private _renderCircular(value: number, pct: number, color: string) {
    const r = 48;
    const cx = 60, cy = 60;
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
          <span class="value">${isNaN(value) ? "—" : value.toFixed(1)}</span>
          <span class="unit">${this._config.unit ?? ""}</span>
        </div>
      </div>
    `;
  }

  private _renderLinear(value: number, pct: number, color: string) {
    return html`
      <div class="linear-wrapper">
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct * 100}%;background:${color};"></div>
        </div>
        <div class="linear-row">
          <span>${this._config.min ?? 0}</span>
          <span>${value.toFixed(1)} ${this._config.unit ?? ""}</span>
          <span>${this._config.max ?? 100}</span>
        </div>
      </div>
    `;
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this.hass.states[this._config.entity];
    const value = this._numericValue;
    const min = this._config.min ?? 0;
    const max = this._config.max ?? 100;
    const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const color = this._colorForValue(value);
    const name = this._config.name ?? (entity?.attributes?.["friendly_name"] as string) ?? this._config.entity;

    return html`
      <ha-card>
        <div class="name">${name}</div>
        ${this._config.style === "linear"
          ? this._renderLinear(value, pct, color)
          : this._renderCircular(value, pct, color)}
      </ha-card>
    `;
  }
}

customElements.define("custom-sensor-gauge-card", SensorGaugeCard);
