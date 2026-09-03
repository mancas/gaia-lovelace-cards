import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, CoverCardConfig } from "../types.js";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "cover" } } },
  { name: "name", selector: { text: {} } },
  { name: "show_position", selector: { boolean: {} } },
];

class CoverCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CoverCardConfig;

  set config(config: CoverCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: CoverCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-cover-card-editor", CoverCardEditor);

export class CoverCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CoverCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .cover-icon { --mdc-icon-size: 48px; }
    .name { font-size: 0.9rem; font-weight: 500; }
    .state-badge {
      font-size: 0.75rem;
      padding: 2px 10px;
      border-radius: 12px;
      background: var(--secondary-background-color, rgba(0,0,0,0.06));
      text-transform: capitalize;
    }
    .state-badge.open { background: var(--custom-cover-accent, var(--primary-color, #03a9f4)); color: var(--text-primary-color, #fff); }
    .controls { display: flex; gap: 8px; }
    ha-icon-button {
      --mdc-icon-button-size: var(--custom-cover-btn-size, 44px);
    }
    .position-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
    }
    .position-row input[type="range"] {
      flex: 1;
      accent-color: var(--custom-cover-accent, var(--primary-color, #03a9f4));
    }
  `;

  setConfig(config: CoverCardConfig) {
    if (!config.entity) throw new Error("cover-card: 'entity' is required");
    this._config = { show_position: true, ...config };
  }

  static getConfigElement() {
    return document.createElement("custom-cover-card-editor");
  }

  static getStubConfig(): Omit<CoverCardConfig, "type"> {
    return { entity: "cover.living_room_blinds", show_position: true };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _call(service: string, data?: Record<string, unknown>) {
    this.hass.callService("cover", service, { entity_id: this._config.entity, ...data });
  }

  private _onPositionChange(e: Event) {
    const position = parseInt((e.target as HTMLInputElement).value, 10);
    this._call("set_cover_position", { position });
  }

  private _icon(entityState: string): string {
    if (this._config.entity.includes("garage")) {
      return entityState === "open" ? "mdi:garage-open" : "mdi:garage";
    }
    return entityState === "open" ? "mdi:window-shutter-open" : "mdi:window-shutter";
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    if (!entity) return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;

    const entityState = entity.state;
    const attrs = entity.attributes as Record<string, unknown>;
    const isOpen = entityState === "open";
    const isMoving = entityState === "opening" || entityState === "closing";
    const name = this._config.name ?? (attrs["friendly_name"] as string) ?? this._config.entity;
    const position = (attrs["current_position"] as number | undefined) ?? (isOpen ? 100 : 0);

    return html`
      <ha-card>
        <ha-icon class="cover-icon" .icon=${this._icon(entityState)}></ha-icon>
        <div class="name">${name}</div>
        <div class="state-badge ${isOpen ? "open" : ""}">${entityState}</div>

        <div class="controls">
          <ha-icon-button .label=${"Open"} @click=${() => this._call("open_cover")}>
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </ha-icon-button>
          <ha-icon-button .label=${"Stop"} @click=${() => this._call("stop_cover")} ?disabled=${!isMoving}>
            <ha-icon icon="mdi:stop"></ha-icon>
          </ha-icon-button>
          <ha-icon-button .label=${"Close"} @click=${() => this._call("close_cover")}>
            <ha-icon icon="mdi:arrow-down"></ha-icon>
          </ha-icon-button>
        </div>

        ${this._config.show_position
          ? html`
            <div class="position-row">
              <ha-icon icon="mdi:window-shutter"></ha-icon>
              <input type="range" min="0" max="100"
                .value=${String(position)}
                @change=${this._onPositionChange}
              />
              <span>${position}%</span>
            </div>`
          : nothing}
      </ha-card>
    `;
  }
}

customElements.define("custom-cover-card", CoverCard);
