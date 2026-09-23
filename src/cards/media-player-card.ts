import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, MediaPlayerCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  friendlyName,
  fireMoreInfo,
  haptic,
  isUnavailable,
} from '../helpers.js';

defineEditor('custom-media-player-card-editor', [
  { name: 'entity', required: true, selector: { entity: { domain: 'media_player' } } },
  { name: 'name', selector: { text: {} } },
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'show_volume', selector: { boolean: {} } },
      { name: 'show_source', selector: { boolean: {} } },
      { name: 'show_progress', selector: { boolean: {} } },
    ],
  },
  { name: 'volume_step', selector: { number: { min: 1, max: 25, step: 1, mode: 'box' } } },
  { name: 'artwork', selector: { select: { mode: 'dropdown', options: ['cover', 'none'] } } },
]);

/** Bit flags from Home Assistant's `MediaPlayerEntityFeature`. */
const FEAT = {
  SEEK: 2,
  VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  SELECT_SOURCE: 2048,
} as const;

/** Above this many entries a `<select>` beats a row of pills. */
const MAX_SOURCE_PILLS = 5;

function formatTime(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export class MediaPlayerCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: MediaPlayerCardConfig;
  /** Optimistic volume while the debounced service call is in flight */
  @state() private _pendingVolume?: number;
  private _volumeDebounce?: number;
  private _holdDelay?: number;
  private _holdRepeat?: number;
  private _ticker?: number;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        --media-accent: var(--custom-media-accent, var(--cc-accent));
      }
      .icon-bubble.active {
        background: color-mix(in srgb, var(--media-accent) 20%, transparent);
        color: var(--media-accent);
      }
      .power {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--cc-muted-bg);
        color: var(--secondary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font: inherit;
        transition:
          background 0.15s,
          color 0.15s,
          transform 0.1s;
      }
      .power.on {
        background: color-mix(in srgb, var(--media-accent) 18%, transparent);
        color: var(--media-accent);
      }
      .power:hover {
        background: color-mix(in srgb, var(--media-accent) 24%, var(--cc-muted-bg));
      }
      .power:active {
        transform: scale(0.92);
      }
      .power:disabled {
        opacity: 0.35;
        cursor: default;
        transform: none;
      }
      .power ha-icon {
        --mdc-icon-size: 20px;
      }
      .artwork {
        width: 100%;
        height: var(--custom-media-artwork-height, 160px);
        object-fit: cover;
        border-radius: var(--cc-radius);
        display: block;
      }
      .artwork-placeholder {
        width: 100%;
        height: var(--custom-media-artwork-height, 160px);
        border-radius: var(--cc-radius);
        background: var(--cc-muted-bg);
        color: var(--secondary-text-color);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .artwork-placeholder ha-icon {
        --mdc-icon-size: 40px;
      }
      .now {
        min-width: 0;
      }
      .now .track {
        font-size: 1rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .now .artist {
        font-size: 0.82rem;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .progress {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .progress .bar {
        height: 6px;
        border-radius: 999px;
        background: var(--cc-muted-bg);
        overflow: hidden;
        cursor: pointer;
        outline: none;
      }
      .progress .bar:focus-visible {
        box-shadow: 0 0 0 2px var(--media-accent);
      }
      .progress .fill {
        height: 100%;
        border-radius: 999px;
        background: var(--media-accent);
        transition: width 0.25s linear;
      }
      .progress .times {
        display: flex;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--secondary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .transport {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .transport button {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font: inherit;
        transition:
          background 0.15s,
          transform 0.1s;
      }
      .transport button:hover {
        background: color-mix(in srgb, var(--media-accent) 20%, var(--cc-muted-bg));
      }
      .transport button:active {
        transform: scale(0.94);
      }
      .transport button:disabled {
        opacity: 0.35;
        cursor: default;
        transform: none;
      }
      .transport button.primary {
        width: 60px;
        height: 60px;
        background: var(--media-accent);
        color: var(--cc-on-accent);
      }
      .transport button.primary:hover {
        background: color-mix(in srgb, var(--media-accent) 85%, #000);
      }
      .transport ha-icon {
        --mdc-icon-size: 26px;
      }
      .transport button.primary ha-icon {
        --mdc-icon-size: 30px;
      }
      .volume {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .volume .vbtn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font: inherit;
        touch-action: none;
        transition:
          background 0.15s,
          transform 0.1s;
      }
      .volume .vbtn:hover {
        background: color-mix(in srgb, var(--media-accent) 20%, var(--cc-muted-bg));
      }
      .volume .vbtn:active {
        transform: scale(0.9);
      }
      .volume .vbtn:disabled {
        opacity: 0.35;
        cursor: default;
        transform: none;
      }
      .volume .vbtn ha-icon {
        --mdc-icon-size: 18px;
      }
      .volume input[type='range'] {
        flex: 1;
        min-width: 0;
      }
      .volume .out {
        font-size: 0.78rem;
        min-width: 38px;
        text-align: right;
        color: var(--secondary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .source-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .source-row > ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }
      .source-row .pills {
        flex: 1;
        min-width: 0;
      }
      .source-row select {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: 0.82rem;
        border: none;
        border-radius: var(--cc-radius);
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        padding: 6px 8px;
      }
      @container card (max-width: 380px) {
        .transport {
          gap: 8px;
        }
        .transport button {
          width: 44px;
          height: 44px;
        }
        .transport button.primary {
          width: 54px;
          height: 54px;
        }
        .volume {
          gap: 6px;
        }
        .volume .out {
          display: none;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    // Advance the progress bar once a second while something is playing.
    this._ticker = window.setInterval(() => {
      if (this._entity?.state === 'playing') this.requestUpdate();
    }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this._ticker);
    window.clearTimeout(this._volumeDebounce);
    this._stopHold();
  }

  setConfig(config: MediaPlayerCardConfig) {
    if (!config.entity) throw new Error("media-player-card: 'entity' is required");
    this._config = {
      show_volume: true,
      show_source: true,
      show_progress: true,
      volume_step: 5,
      artwork: 'cover',
      ...config,
    };
  }

  static getConfigElement() {
    return document.createElement('custom-media-player-card-editor');
  }

  static getStubConfig(hass?: HomeAssistant): Omit<MediaPlayerCardConfig, 'type'> {
    const entity =
      Object.keys(hass?.states ?? {}).find((e) => e.startsWith('media_player.')) ??
      'media_player.living_room';
    return { entity, show_volume: true, show_source: true, show_progress: true };
  }

  getCardSize() {
    return 5;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get _entity() {
    return this._config ? this.hass?.states[this._config.entity] : undefined;
  }

  /** `supported_features` is absent on some integrations — assume support then. */
  private _supports(flag: number): boolean {
    const features = this._entity?.attributes['supported_features'] as number | undefined;
    return features == null || (features & flag) === flag;
  }

  private _call(service: string, data?: Record<string, unknown>) {
    this.hass.callService('media_player', service, { entity_id: this._config.entity, ...data });
  }

  /** Live playback position in seconds, extrapolated while playing. */
  private _position(): number | undefined {
    const attrs = this._entity?.attributes ?? {};
    const position = attrs['media_position'] as number | undefined;
    if (position == null) return undefined;
    if (this._entity?.state === 'playing') {
      const updatedAt = attrs['media_position_updated_at'] as string | undefined;
      if (updatedAt) {
        const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
        if (Number.isFinite(elapsed) && elapsed > 0) return position + elapsed;
      }
    }
    return position;
  }

  private get _volumeLevel(): number {
    const level =
      this._pendingVolume ?? (this._entity?.attributes['volume_level'] as number | undefined) ?? 0;
    return Math.min(1, Math.max(0, level));
  }

  private _applyVolume(level: number) {
    this._pendingVolume = Math.round(level * 100) / 100;
    window.clearTimeout(this._volumeDebounce);
    this._volumeDebounce = window.setTimeout(() => {
      const value = this._pendingVolume;
      this._call('volume_set', { volume_level: value });
      window.setTimeout(() => {
        if (this._pendingVolume === value) this._pendingVolume = undefined;
      }, 2000);
    }, 200);
  }

  private _bumpVolume(direction: 1 | -1) {
    const step = Math.max(1, this._config.volume_step ?? 5) / 100;
    const next = Math.min(1, Math.max(0, this._volumeLevel + direction * step));
    if (next === this._volumeLevel) return;
    this._applyVolume(next);
    haptic(this);
  }

  /** Press-and-hold: step once, then keep stepping after a short delay. */
  private _holdStart(e: PointerEvent, direction: 1 | -1) {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this._bumpVolume(direction);
    window.clearTimeout(this._holdDelay);
    window.clearInterval(this._holdRepeat);
    this._holdDelay = window.setTimeout(() => {
      this._holdRepeat = window.setInterval(() => this._bumpVolume(direction), 160);
    }, 400);
  }

  private _stopHold = () => {
    window.clearTimeout(this._holdDelay);
    window.clearInterval(this._holdRepeat);
    this._holdDelay = undefined;
    this._holdRepeat = undefined;
  };

  /** Keyboard activation reports `detail === 0`; pointer taps are handled above. */
  private _keyboardStep(e: Event, direction: 1 | -1) {
    if ((e as MouseEvent).detail === 0) this._bumpVolume(direction);
  }

  private _onVolumeInput(e: Event) {
    const pct = parseInt((e.target as HTMLInputElement).value, 10);
    this._applyVolume(pct / 100);
  }

  private _toggleMute() {
    haptic(this);
    this._call('volume_mute', {
      is_volume_muted: !(this._entity?.attributes['is_volume_muted'] as boolean),
    });
  }

  private _togglePlay() {
    const state = this._entity?.state;
    haptic(this);
    if (state === 'playing') {
      this._call('media_pause');
    } else if ((state === 'off' || state === 'standby') && this._supports(FEAT.TURN_ON)) {
      this._call('turn_on');
    } else {
      this._call('media_play');
    }
  }

  private _togglePower() {
    haptic(this);
    const isOff = this._entity?.state === 'off' || this._entity?.state === 'standby';
    this._call(isOff ? 'turn_on' : 'turn_off');
  }

  private _selectSource(source: string) {
    haptic(this);
    this._call('select_source', { source });
  }

  private _onSourceChange(e: Event) {
    this._selectSource((e.target as HTMLSelectElement).value);
  }

  private _seekTo(seconds: number) {
    const duration = this._entity?.attributes['media_duration'] as number | undefined;
    if (!duration || !this._supports(FEAT.SEEK)) return;
    haptic(this);
    this._call('media_seek', { seek_position: Math.min(duration, Math.max(0, seconds)) });
  }

  private _onSeek(e: MouseEvent) {
    const duration = this._entity?.attributes['media_duration'] as number | undefined;
    if (!duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    this._seekTo(fraction * duration);
  }

  private _onSeekKey(e: KeyboardEvent) {
    const duration = this._entity?.attributes['media_duration'] as number | undefined;
    if (!duration) return;
    const delta =
      e.key === 'ArrowLeft'
        ? -10
        : e.key === 'ArrowRight'
          ? 10
          : e.key === 'Home'
            ? -duration
            : e.key === 'End'
              ? duration
              : 0;
    if (!delta) return;
    e.preventDefault();
    this._seekTo((this._position() ?? 0) + delta);
  }

  private _deviceIcon(deviceClass: string): string {
    switch (deviceClass) {
      case 'tv':
        return 'mdi:television';
      case 'speaker':
        return 'mdi:speaker';
      case 'receiver':
        return 'mdi:audio-video';
      case 'projector':
        return 'mdi:projector';
      case 'set_top_box':
        return 'mdi:set-top-box';
      default:
        return 'mdi:music';
    }
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const entity = this._entity;
    if (!entity)
      return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;

    const entityState = entity.state;
    const attrs = entity.attributes as Record<string, unknown>;
    const unavailable = isUnavailable(entity);
    const isPlaying = entityState === 'playing';
    const isOff = entityState === 'off' || entityState === 'standby';
    const name = friendlyName(this.hass, this._config.entity, this._config.name);
    const mediaTitle = (attrs['media_title'] as string) ?? '';
    const artist = (attrs['media_artist'] as string) ?? (attrs['media_album_name'] as string) ?? '';
    const artworkUrl = (attrs['entity_picture'] as string) ?? '';
    const icon =
      (attrs['icon'] as string) ?? this._deviceIcon((attrs['device_class'] as string) ?? '');
    const volumePct = Math.round(this._volumeLevel * 100);
    const muted = !!attrs['is_volume_muted'];
    const sources = (attrs['source_list'] as string[]) ?? [];
    const currentSource = (attrs['source'] as string) ?? '';

    const duration = attrs['media_duration'] as number | undefined;
    const rawPosition = this._position();
    const position =
      rawPosition != null && duration != null ? Math.min(rawPosition, duration) : rawPosition;
    const showProgress =
      this._config.show_progress !== false && duration != null && duration > 0 && position != null;
    const progressPct =
      showProgress && position != null
        ? Math.min(100, Math.max(0, (position / duration!) * 100))
        : 0;

    const stateLabel = unavailable
      ? 'Unavailable'
      : entityState === 'playing'
        ? 'Playing'
        : entityState === 'paused'
          ? 'Paused'
          : entityState === 'buffering'
            ? 'Buffering'
            : entityState.charAt(0).toUpperCase() + entityState.slice(1);

    const canPrev = this._supports(FEAT.PREVIOUS_TRACK);
    const canNext = this._supports(FEAT.NEXT_TRACK);
    const canMute = this._supports(FEAT.VOLUME_MUTE);
    const canTurnOn = this._supports(FEAT.TURN_ON);
    const canTurnOff = this._supports(FEAT.TURN_OFF);
    const showPower = !unavailable && (canTurnOn || canTurnOff);
    const powerDisabled = isOff ? !canTurnOn : !canTurnOff;
    const sourceAsPills = sources.length > 0 && sources.length <= MAX_SOURCE_PILLS;

    return html`
      <ha-card>
        <div class="header">
          <div
            class="icon-bubble ${isPlaying ? 'active' : ''}"
            @click=${() => fireMoreInfo(this, this._config.entity)}
          >
            <ha-icon icon=${icon}></ha-icon>
          </div>
          <div style="flex:1;min-width:0">
            <div class="title">${name}</div>
            <div class="subtitle">${stateLabel}${muted ? ' · Muted' : ''}</div>
          </div>
          ${
            showPower
              ? html`<button
                  class="power ${isOff ? '' : 'on'}"
                  aria-label=${isOff ? 'Turn on' : 'Turn off'}
                  ?disabled=${powerDisabled}
                  @click=${this._togglePower}
                >
                  <ha-icon icon="mdi:power"></ha-icon>
                </button>`
              : nothing
          }
        </div>

        ${
          this._config.artwork === 'cover'
            ? artworkUrl
              ? html`<img class="artwork" src="${artworkUrl}" alt="" />`
              : html`<div class="artwork-placeholder"><ha-icon icon=${icon}></ha-icon></div>`
            : nothing
        }
        ${
          mediaTitle
            ? html`<div class="now">
                <div class="track">${mediaTitle}</div>
                ${artist ? html`<div class="artist">${artist}</div>` : nothing}
              </div>`
            : nothing
        }
        ${
          showProgress
            ? html`<div class="progress">
                <div
                  class="bar"
                  role="slider"
                  tabindex="0"
                  aria-label="Seek"
                  aria-orientation="horizontal"
                  aria-valuemin="0"
                  aria-valuemax=${Math.round(duration!)}
                  aria-valuenow=${Math.round(position!)}
                  @click=${this._onSeek}
                  @keydown=${this._onSeekKey}
                >
                  <div class="fill" style="width:${progressPct}%"></div>
                </div>
                <div class="times">
                  <span>${formatTime(position)}</span>
                  <span>${formatTime(duration)}</span>
                </div>
              </div>`
            : nothing
        }

        <div class="transport">
          ${
            canPrev
              ? html`<button
                  aria-label="Previous"
                  ?disabled=${unavailable}
                  @click=${() => this._call('media_previous_track')}
                >
                  <ha-icon icon="mdi:skip-previous"></ha-icon>
                </button>`
              : nothing
          }
          <button
            class="primary"
            aria-label=${isPlaying ? 'Pause' : 'Play'}
            ?disabled=${unavailable}
            @click=${this._togglePlay}
          >
            <ha-icon icon=${isPlaying ? 'mdi:pause' : 'mdi:play'}></ha-icon>
          </button>
          ${
            canNext
              ? html`<button
                  aria-label="Next"
                  ?disabled=${unavailable}
                  @click=${() => this._call('media_next_track')}
                >
                  <ha-icon icon="mdi:skip-next"></ha-icon>
                </button>`
              : nothing
          }
        </div>

        ${
          this._config.show_volume
            ? html`<div class="volume">
                ${
                  canMute
                    ? html`<button
                        class="vbtn"
                        aria-label=${muted ? 'Unmute' : 'Mute'}
                        ?disabled=${unavailable}
                        @click=${this._toggleMute}
                      >
                        <ha-icon icon=${muted ? 'mdi:volume-off' : 'mdi:volume-high'}></ha-icon>
                      </button>`
                    : nothing
                }
                <button
                  class="vbtn"
                  aria-label="Volume down"
                  ?disabled=${unavailable}
                  @pointerdown=${(e: PointerEvent) => this._holdStart(e, -1)}
                  @pointerup=${this._stopHold}
                  @pointercancel=${this._stopHold}
                  @contextmenu=${(e: Event) => e.preventDefault()}
                  @click=${(e: Event) => this._keyboardStep(e, -1)}
                >
                  <ha-icon icon="mdi:volume-minus"></ha-icon>
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  .value=${String(volumePct)}
                  aria-label="Volume"
                  @input=${this._onVolumeInput}
                />
                <button
                  class="vbtn"
                  aria-label="Volume up"
                  ?disabled=${unavailable}
                  @pointerdown=${(e: PointerEvent) => this._holdStart(e, 1)}
                  @pointerup=${this._stopHold}
                  @pointercancel=${this._stopHold}
                  @contextmenu=${(e: Event) => e.preventDefault()}
                  @click=${(e: Event) => this._keyboardStep(e, 1)}
                >
                  <ha-icon icon="mdi:volume-plus"></ha-icon>
                </button>
                <span class="out">${volumePct}%</span>
              </div>`
            : nothing
        }
        ${
          this._config.show_source && sources.length
            ? sourceAsPills
              ? html`<div class="source-row">
                  <ha-icon icon="mdi:video-input-hdmi"></ha-icon>
                  <div class="pills">
                    ${sources.map(
                      (s) =>
                        html`<button
                          class="pill ${s === currentSource ? 'active' : ''}"
                          ?disabled=${unavailable}
                          @click=${() => this._selectSource(s)}
                        >
                          ${s}
                        </button>`,
                    )}
                  </div>
                </div>`
              : html`<div class="source-row">
                  <ha-icon icon="mdi:video-input-hdmi"></ha-icon>
                  <select
                    aria-label="Source"
                    ?disabled=${unavailable}
                    @change=${this._onSourceChange}
                    .value=${currentSource}
                  >
                    ${sources.map(
                      (s) =>
                        html`<option value="${s}" ?selected=${s === currentSource}>${s}</option>`,
                    )}
                  </select>
                </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-media-player-card', MediaPlayerCard);
