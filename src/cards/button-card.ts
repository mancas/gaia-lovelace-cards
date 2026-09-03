import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, ButtonCardConfig } from "../types.js";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "tap_action", selector: { select: { options: ["toggle", "more-info", "call-service"] } } },
  { name: "show_state", selector: { boolean: {} } },
];

class ButtonCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: ButtonCardConfig;

  set config(config: ButtonCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: ButtonCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-button-card-editor", ButtonCardEditor);

export class ButtonCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: ButtonCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card {
      cursor: pointer;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s ease;
    }
    ha-card.active {
      background-color: var(--custom-button-card-active-bg, var(--primary-color, #03a9f4));
      color: var(--custom-button-card-active-color, var(--text-primary-color, #fff));
    }
    ha-card.unavailable {
      opacity: 0.5;
      pointer-events: none;
    }
    .icon-container {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--secondary-background-color, rgba(0,0,0,0.06));
    }
    ha-icon {
      --mdc-icon-size: var(--custom-button-card-icon-size, 28px);
    }
    .name { font-size: 0.9rem; font-weight: 500; text-align: center; }
    .state-label { font-size: 0.75rem; opacity: 0.75; text-align: center; }
    .fan-speed {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
    }
    .fan-speed input[type="range"] {
      flex: 1;
      accent-color: var(--custom-button-card-active-bg, var(--primary-color, #03a9f4));
    }
  `;

  setConfig(config: ButtonCardConfig) {
    if (!config.entity) throw new Error("button-card: 'entity' is required");
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement("custom-button-card-editor");
  }

  static getStubConfig(): Omit<ButtonCardConfig, "type"> {
    return { entity: "light.living_room", name: "Living Room", show_state: true };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _handleClick() {
    const action = this._config.tap_action ?? "toggle";
    if (action === "toggle") {
      const [domain] = this._config.entity.split(".");
      this.hass.callService(domain, "toggle", { entity_id: this._config.entity });
    } else if (action === "more-info") {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        bubbles: true, composed: true,
        detail: { entityId: this._config.entity },
      }));
    } else if (action === "call-service" && this._config.service) {
      const [domain, service] = this._config.service.split(".");
      this.hass.callService(domain, service, this._config.service_data);
    }
  }

  private _onFanSpeed(e: Event) {
    e.stopPropagation();
    const pct = parseInt((e.target as HTMLInputElement).value, 10);
    this.hass.callService("fan", "set_percentage", { entity_id: this._config.entity, percentage: pct });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    const isOn = entity?.state === "on";
    const isUnavailable = entity?.state === "unavailable";
    const [domain] = this._config.entity.split(".");
    const isFan = domain === "fan";
    const fanPct = isFan ? (entity?.attributes?.["percentage"] as number | undefined) ?? 0 : 0;
    const name = this._config.name ?? (entity?.attributes?.["friendly_name"] as string) ?? this._config.entity;
    const icon = this._config.icon ?? this._defaultIcon();

    const stateLabel = isFan && isOn && fanPct
      ? `on • ${fanPct}%`
      : entity?.state ?? "";

    return html`
      <ha-card
        class="${isOn ? "active" : ""} ${isUnavailable ? "unavailable" : ""}"
        @click=${this._handleClick}
      >
        <div class="icon-container">
          <ha-icon .icon=${icon}></ha-icon>
        </div>
        <div class="name">${name}</div>
        ${this._config.show_state && entity
          ? html`<div class="state-label">${stateLabel}</div>`
          : nothing}
        ${isFan && isOn
          ? html`
            <div class="fan-speed" @click=${(e: Event) => e.stopPropagation()}>
              <ha-icon icon="mdi:fan-speed-1"></ha-icon>
              <input type="range" min="0" max="100" step="5"
                .value=${String(fanPct)}
                @change=${this._onFanSpeed}
              />
              <span>${fanPct}%</span>
            </div>`
          : nothing}
      </ha-card>
    `;
  }

  private _defaultIcon(): string {
    const [domain] = (this._config.entity ?? "").split(".");
    const iconMap: Record<string, string> = {
      light: "mdi:lightbulb",
      fan: "mdi:fan",
      climate: "mdi:air-conditioner",
      switch: "mdi:power",
      media_player: "mdi:speaker",
    };
    return iconMap[domain] ?? "mdi:toggle-switch";
  }
}

customElements.define("custom-button-card", ButtonCard);
