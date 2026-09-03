import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, PowerMonitorCardConfig } from "../types.js";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
  { name: "name", selector: { text: {} } },
  { name: "unit", selector: { text: {} } },
  { name: "daily_energy", selector: { entity: { domain: "sensor" } } },
  { name: "monthly_energy", selector: { entity: { domain: "sensor" } } },
];

class PowerMonitorCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: PowerMonitorCardConfig;

  set config(config: PowerMonitorCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: PowerMonitorCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-power-monitor-card-editor", PowerMonitorCardEditor);

export class PowerMonitorCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: PowerMonitorCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card { padding: 16px; }
    .card-name { font-size: 0.85rem; font-weight: 500; opacity: 0.7; margin-bottom: 8px; }
    .power-value {
      font-size: 2.4rem;
      font-weight: 700;
      line-height: 1;
      transition: color 0.3s;
    }
    .power-value.low { color: var(--custom-power-low-color, #4caf50); }
    .power-value.medium { color: var(--custom-power-medium-color, #ff9800); }
    .power-value.high { color: var(--custom-power-high-color, #f44336); }
    .power-unit { font-size: 1rem; font-weight: 400; margin-left: 4px; opacity: 0.7; }
    .energy-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      font-size: 0.85rem;
      opacity: 0.8;
      border-top: 1px solid var(--divider-color, rgba(0,0,0,0.1));
      padding-top: 10px;
    }
    .energy-row ha-icon { --mdc-icon-size: 18px; opacity: 0.6; }
    .energy-label { flex: 1; }
    .energy-val { font-weight: 600; }
  `;

  setConfig(config: PowerMonitorCardConfig) {
    if (!config.entity) throw new Error("power-monitor-card: 'entity' is required");
    this._config = { unit: "W", ...config };
  }

  static getConfigElement() {
    return document.createElement("custom-power-monitor-card-editor");
  }

  static getStubConfig(): Omit<PowerMonitorCardConfig, "type"> {
    return { entity: "sensor.socket_power", unit: "W" };
  }

  private _powerClass(watts: number): string {
    if (watts >= 1000) return "high";
    if (watts >= 100) return "medium";
    return "low";
  }

  private _sensorVal(entityId: string | undefined): string {
    if (!entityId) return "—";
    const raw = this.hass?.states[entityId]?.state;
    if (!raw || raw === "unavailable" || raw === "unknown") return "—";
    const n = parseFloat(raw);
    return isNaN(n) ? "—" : n.toFixed(2);
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this.hass.states[this._config.entity];
    const attrs = entity?.attributes as Record<string, unknown> | undefined;
    const name = this._config.name ?? (attrs?.["friendly_name"] as string) ?? this._config.entity;
    const rawVal = entity?.state ?? "0";
    const watts = parseFloat(rawVal);
    const displayVal = isNaN(watts) ? "—" : watts >= 1000 ? `${(watts / 1000).toFixed(2)}` : `${watts.toFixed(1)}`;
    const displayUnit = isNaN(watts) ? this._config.unit : watts >= 1000 ? "kW" : (this._config.unit ?? "W");
    const levelClass = isNaN(watts) ? "low" : this._powerClass(watts);

    const dailyVal = this._sensorVal(this._config.daily_energy);
    const monthlyVal = this._sensorVal(this._config.monthly_energy);

    return html`
      <ha-card>
        <div class="card-name">${name}</div>
        <div>
          <span class="power-value ${levelClass}">${displayVal}</span>
          <span class="power-unit">${displayUnit}</span>
        </div>

        ${this._config.daily_energy ? html`
          <div class="energy-row">
            <ha-icon icon="mdi:calendar-today"></ha-icon>
            <span class="energy-label">Today</span>
            <span class="energy-val">${dailyVal} kWh</span>
          </div>` : nothing}

        ${this._config.monthly_energy ? html`
          <div class="energy-row">
            <ha-icon icon="mdi:calendar-month"></ha-icon>
            <span class="energy-label">This month</span>
            <span class="energy-val">${monthlyVal} kWh</span>
          </div>` : nothing}
      </ha-card>
    `;
  }
}

customElements.define("custom-power-monitor-card", PowerMonitorCard);
