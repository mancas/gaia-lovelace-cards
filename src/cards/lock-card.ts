import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, LockCardConfig } from "../types.js";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "lock" } } },
  { name: "name", selector: { text: {} } },
  { name: "require_confirm", selector: { boolean: {} } },
];

class LockCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: LockCardConfig;

  set config(config: LockCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: LockCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-lock-card-editor", LockCardEditor);

export class LockCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: LockCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card {
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      border: 2px solid transparent;
      transition: border-color 0.2s;
    }
    ha-card.unlocked { border-color: var(--custom-lock-unlocked-color, var(--warning-color, #ff9800)); }
    ha-card.jammed { border-color: var(--custom-lock-jammed-color, var(--error-color, #f44336)); }
    ha-card.unavailable { opacity: 0.5; pointer-events: none; }
    .lock-icon { --mdc-icon-size: 52px; }
    .lock-icon.locked { color: var(--custom-lock-locked-color, var(--primary-color, #03a9f4)); }
    .lock-icon.unlocked { color: var(--custom-lock-unlocked-color, var(--warning-color, #ff9800)); }
    .lock-icon.jammed { color: var(--custom-lock-jammed-color, var(--error-color, #f44336)); }
    .name { font-size: 0.9rem; font-weight: 500; }
    .state-label { font-size: 0.8rem; opacity: 0.7; text-transform: capitalize; }
    .action-btn {
      margin-top: 4px;
      padding: 8px 24px;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .action-btn.lock-btn {
      background: var(--custom-lock-locked-color, var(--primary-color, #03a9f4));
      color: var(--text-primary-color, #fff);
    }
    .action-btn.unlock-btn {
      background: var(--custom-lock-unlocked-color, var(--warning-color, #ff9800));
      color: var(--text-primary-color, #fff);
    }
    .action-btn:disabled { opacity: 0.4; pointer-events: none; }
  `;

  setConfig(config: LockCardConfig) {
    if (!config.entity) throw new Error("lock-card: 'entity' is required");
    this._config = { require_confirm: true, ...config };
  }

  static getConfigElement() {
    return document.createElement("custom-lock-card-editor");
  }

  static getStubConfig(): Omit<LockCardConfig, "type"> {
    return { entity: "lock.front_door", require_confirm: true };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _call(service: string) {
    this.hass.callService("lock", service, { entity_id: this._config.entity });
  }

  private _handleAction() {
    const entityState = this._entity?.state;
    if (entityState === "unlocked") {
      this._call("lock");
    } else if (entityState === "locked") {
      const name = this._config.name ?? (this._entity?.attributes?.["friendly_name"] as string) ?? this._config.entity;
      if (this._config.require_confirm && !window.confirm(`Unlock ${name}?`)) return;
      this._call("unlock");
    }
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    if (!entity) return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;

    const entityState = entity.state;
    const attrs = entity.attributes as Record<string, unknown>;
    const isLocked = entityState === "locked";
    const isUnlocked = entityState === "unlocked";
    const isJammed = entityState === "jammed";
    const isTransitioning = entityState === "locking" || entityState === "unlocking";
    const isUnavailable = entityState === "unavailable";
    const name = this._config.name ?? (attrs["friendly_name"] as string) ?? this._config.entity;

    const iconMap: Record<string, string> = {
      locked: "mdi:lock",
      unlocked: "mdi:lock-open",
      locking: "mdi:lock-clock",
      unlocking: "mdi:lock-open-alert",
      jammed: "mdi:alert",
    };
    const icon = iconMap[entityState] ?? "mdi:lock";
    const iconClass = isLocked ? "locked" : isUnlocked ? "unlocked" : isJammed ? "jammed" : "";
    const cardClass = isUnlocked ? "unlocked" : isJammed ? "jammed" : isUnavailable ? "unavailable" : "";

    return html`
      <ha-card class="${cardClass}">
        <ha-icon class="lock-icon ${iconClass}" .icon=${icon}></ha-icon>
        <div class="name">${name}</div>
        <div class="state-label">${entityState}</div>
        <button
          class="action-btn ${isUnlocked ? "lock-btn" : "unlock-btn"}"
          ?disabled=${isJammed || isTransitioning || isUnavailable}
          @click=${this._handleAction}
        >
          ${isUnlocked ? "Lock" : "Unlock"}
        </button>
      </ha-card>
    `;
  }
}

customElements.define("custom-lock-card", LockCard);
