import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, MediaPlayerCardConfig } from "../types.js";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "media_player" } } },
  { name: "name", selector: { text: {} } },
  { name: "show_volume", selector: { boolean: {} } },
  { name: "show_source", selector: { boolean: {} } },
  { name: "artwork", selector: { select: { options: ["cover", "none"] } } },
];

class MediaPlayerCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: MediaPlayerCardConfig;

  set config(config: MediaPlayerCardConfig) {
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
      detail: { config: (ev as CustomEvent<{ value: MediaPlayerCardConfig }>).detail.value },
      bubbles: true,
      composed: true,
    }));
  }
}
customElements.define("custom-media-player-card-editor", MediaPlayerCardEditor);

export class MediaPlayerCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: MediaPlayerCardConfig;

  static styles = css`
    :host { display: block; }
    ha-card { padding: 12px 16px; }
    .artwork {
      width: 100%;
      height: var(--custom-media-artwork-height, 160px);
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .artwork-placeholder {
      width: 100%;
      height: var(--custom-media-artwork-height, 160px);
      border-radius: 8px;
      background: var(--secondary-background-color, #e0e0e0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .info { margin-bottom: 12px; }
    .title { font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .artist { font-size: 0.8rem; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .controls { display: flex; align-items: center; justify-content: center; gap: 8px; }
    ha-icon-button { --mdc-icon-button-size: 44px; }
    .volume-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .volume-row ha-icon { opacity: 0.7; }
    input[type="range"] { flex: 1; accent-color: var(--custom-media-accent, var(--primary-color, #03a9f4)); }
    .source-row { margin-top: 8px; font-size: 0.8rem; opacity: 0.7; }
    select { font-size: 0.8rem; border: none; background: transparent; color: inherit; }
  `;

  setConfig(config: MediaPlayerCardConfig) {
    if (!config.entity) throw new Error("media-player-card: 'entity' is required");
    this._config = { show_volume: true, show_source: true, artwork: "cover", ...config };
  }

  static getConfigElement() {
    return document.createElement("custom-media-player-card-editor");
  }

  static getStubConfig(): Omit<MediaPlayerCardConfig, "type"> {
    return { entity: "media_player.living_room", show_volume: true, show_source: true };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _call(service: string, data?: Record<string, unknown>) {
    this.hass.callService("media_player", service, { entity_id: this._config.entity, ...data });
  }

  private _onVolumeChange(e: Event) {
    const volume = parseFloat((e.target as HTMLInputElement).value) / 100;
    this._call("volume_set", { volume_level: volume });
  }

  private _onSourceChange(e: Event) {
    this._call("select_source", { source: (e.target as HTMLSelectElement).value });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    if (!entity) return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;

    const entityState = entity.state;
    const attrs = entity.attributes as Record<string, unknown>;
    const isPlaying = entityState === "playing";
    const isIdle = entityState === "idle" || entityState === "off";
    const name = this._config.name ?? (attrs["friendly_name"] as string) ?? this._config.entity;
    const title = (attrs["media_title"] as string) ?? "";
    const artist = (attrs["media_artist"] as string) ?? "";
    const artworkUrl = (attrs["entity_picture"] as string) ?? "";
    const volume = Math.round(((attrs["volume_level"] as number) ?? 0) * 100);
    const sources = (attrs["source_list"] as string[]) ?? [];
    const currentSource = (attrs["source"] as string) ?? "";

    return html`
      <ha-card>
        ${this._config.artwork === "cover"
          ? artworkUrl
            ? html`<img class="artwork" src="${artworkUrl}" alt="artwork" />`
            : html`<div class="artwork-placeholder"><ha-icon icon="mdi:music"></ha-icon></div>`
          : nothing}

        <div class="info">
          <div class="title">${title || name}</div>
          ${artist ? html`<div class="artist">${artist}</div>` : nothing}
        </div>

        <div class="controls">
          <ha-icon-button
            .label=${"Previous"}
            @click=${() => this._call("media_previous_track")}
            ?disabled=${isIdle}
          ><ha-icon icon="mdi:skip-previous"></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${isPlaying ? "Pause" : "Play"}
            @click=${() => this._call(isPlaying ? "media_pause" : "media_play")}
          ><ha-icon icon=${isPlaying ? "mdi:pause" : "mdi:play"}></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${"Next"}
            @click=${() => this._call("media_next_track")}
            ?disabled=${isIdle}
          ><ha-icon icon="mdi:skip-next"></ha-icon></ha-icon-button>

          <ha-icon-button
            .label=${"Mute"}
            @click=${() => this._call("volume_mute", { is_volume_muted: !(attrs["is_volume_muted"] as boolean) })}
          ><ha-icon icon=${attrs["is_volume_muted"] ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon></ha-icon-button>
        </div>

        ${this._config.show_volume
          ? html`
            <div class="volume-row">
              <ha-icon icon="mdi:volume-low"></ha-icon>
              <input type="range" min="0" max="100" .value=${String(volume)} @change=${this._onVolumeChange} />
              <ha-icon icon="mdi:volume-high"></ha-icon>
            </div>`
          : nothing}

        ${this._config.show_source && sources.length
          ? html`
            <div class="source-row">
              Source:
              <select @change=${this._onSourceChange} .value=${currentSource}>
                ${sources.map(s => html`<option value="${s}" ?selected=${s === currentSource}>${s}</option>`)}
              </select>
            </div>`
          : nothing}
      </ha-card>
    `;
  }
}

customElements.define("custom-media-player-card", MediaPlayerCard);
