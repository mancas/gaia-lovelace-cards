import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, VacuumCardConfig } from "../types.js";

const STATE_ICONS: Record<string, string> = {
  docked: "mdi:robot-vacuum",
  cleaning: "mdi:robot-vacuum",
  idle: "mdi:robot-vacuum-alert",
  paused: "mdi:pause-circle",
  error: "mdi:alert-circle",
  returning: "mdi:robot-vacuum",
};

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "vacuum" } } },
  { name: "name", selector: { text: {} } },
];

class VacuumCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: VacuumCardConfig;

  set config(config: VacuumCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: VacuumCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-vacuum-card-editor", VacuumCardEditor);

export class VacuumCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: VacuumCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .icon-wrapper { position: relative; display: inline-flex; }
    .vacuum-icon {
      --mdc-icon-size: var(--custom-vacuum-icon-size, 56px);
      color: var(--custom-vacuum-accent, var(--primary-color, #03a9f4));
    }
    .vacuum-icon.error { color: var(--error-color, #f44336); }
    .battery-badge {
      position: absolute;
      bottom: -4px;
      right: -8px;
      font-size: 0.65rem;
      background: var(--secondary-background-color, rgba(0,0,0,0.06));
      padding: 1px 5px;
      border-radius: 8px;
      white-space: nowrap;
    }
    .name { font-size: 0.9rem; font-weight: 500; }
    .state-label { font-size: 0.8rem; opacity: 0.7; text-transform: capitalize; }
    .controls { display: flex; gap: 4px; }
    ha-icon-button { --mdc-icon-button-size: 44px; }
    ha-icon-button[disabled] { opacity: 0.35; pointer-events: none; }
  `;

  setConfig(config: VacuumCardConfig) {
    if (!config.entity) throw new Error("vacuum-card: 'entity' is required");
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement("custom-vacuum-card-editor");
  }

  static getStubConfig(): Omit<VacuumCardConfig, "type"> {
    return { entity: "vacuum.robot" };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _call(service: string) {
    this.hass.callService("vacuum", service, { entity_id: this._config.entity });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    if (!entity) return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;

    const entityState = entity.state;
    const attrs = entity.attributes as Record<string, unknown>;
    const name = this._config.name ?? (attrs["friendly_name"] as string) ?? this._config.entity;
    const icon = STATE_ICONS[entityState] ?? "mdi:robot-vacuum";
    const battery = attrs["battery_level"] as number | undefined;
    const isCleaning = entityState === "cleaning";
    const isPaused = entityState === "paused";
    const canStart = entityState === "idle" || entityState === "docked";
    const isError = entityState === "error";

    return html`
      <ha-card>
        <div class="icon-wrapper">
          <ha-icon class="vacuum-icon ${isError ? "error" : ""}" .icon=${icon}></ha-icon>
          ${battery != null
            ? html`<span class="battery-badge"><ha-icon icon="mdi:battery" style="--mdc-icon-size:10px"></ha-icon>${battery}%</span>`
            : nothing}
        </div>

        <div class="name">${name}</div>
        <div class="state-label">${entityState}</div>

        <div class="controls">
          <ha-icon-button
            .label=${isPaused ? "Resume" : "Start"}
            ?disabled=${!canStart && !isPaused}
            @click=${() => this._call(isPaused ? "resume" : "start")}
          ><ha-icon icon="mdi:play"></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${"Pause"}
            ?disabled=${!isCleaning}
            @click=${() => this._call("pause")}
          ><ha-icon icon="mdi:pause"></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${"Return to base"}
            @click=${() => this._call("return_to_base")}
          ><ha-icon icon="mdi:home-map-marker"></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${"Locate"}
            @click=${() => this._call("locate")}
          ><ha-icon icon="mdi:map-marker"></ha-icon></ha-icon-button>
        </div>
      </ha-card>
    `;
  }
}

customElements.define("custom-vacuum-card", VacuumCard);
