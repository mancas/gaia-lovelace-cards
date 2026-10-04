import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type {
  HomeAssistant,
  HassEntity,
  PlayStationCardConfig,
  PlayStationEntities,
  GridOptions,
} from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  formatState,
  isUnavailable,
  numericState,
  prettify,
  relativeTime,
  lang,
} from '../helpers.js';

const PLATFORM = 'playstation_network';

const psnEntity = (domain: string) => ({
  entity: { filter: { integration: PLATFORM, domain } },
});

defineEditor(
  'custom-playstation-card-editor',
  [
    { name: 'entity', required: true, selector: psnEntity('sensor') },
    { name: 'name', selector: { text: {} } },
    {
      type: 'grid',
      name: '',
      schema: [
        { name: 'show_level', selector: { boolean: {} } },
        { name: 'show_trophies', selector: { boolean: {} } },
        { name: 'show_now_playing', selector: { boolean: {} } },
      ],
    },
    {
      type: 'expandable',
      name: 'overrides',
      title: 'Entity overrides',
      flatten: true,
      schema: [
        { name: 'online_status', selector: psnEntity('sensor') },
        { name: 'last_online', selector: psnEntity('sensor') },
        { name: 'trophy_level', selector: psnEntity('sensor') },
        { name: 'next_level', selector: psnEntity('sensor') },
        { name: 'platinum', selector: psnEntity('sensor') },
        { name: 'gold', selector: psnEntity('sensor') },
        { name: 'silver', selector: psnEntity('sensor') },
        { name: 'bronze', selector: psnEntity('sensor') },
        { name: 'now_playing', selector: psnEntity('sensor') },
        { name: 'now_playing_image', selector: psnEntity('image') },
        { name: 'avatar', selector: psnEntity('image') },
        { name: 'ps_plus', selector: psnEntity('binary_sensor') },
        { name: 'media_player', selector: psnEntity('media_player') },
      ],
    },
  ],
  {
    labels: {
      entity: 'Online ID sensor',
      overrides: 'Entity overrides',
      next_level: 'Next level (progress)',
      now_playing_image: 'Now playing image',
      ps_plus: 'PlayStation Plus',
      media_player: 'Console (media player)',
    },
    helpers: {
      entity:
        "The account's (or a friend's) Online ID sensor — trophies, status and the current game are found from the same device",
      overrides: 'Only needed when an entity was moved to another device',
    },
  },
);

type EntityKey = keyof PlayStationEntities;

/**
 * How each entity is found next to the Online ID sensor: its domain, the integration's
 * `translation_key` (stable whatever language the entity ids were generated in) and the English
 * entity id suffix, used when the entity registry is not available.
 */
const LOOKUP: Record<Exclude<EntityKey, 'media_player'>, [string, string, string]> = {
  online_status: ['sensor', 'online_status', 'online_status'],
  last_online: ['sensor', 'last_online', 'last_online'],
  trophy_level: ['sensor', 'trophy_level', 'trophy_level'],
  next_level: ['sensor', 'trophy_level_progress', 'next_level'],
  platinum: ['sensor', 'earned_trophies_platinum', 'platinum_trophies'],
  gold: ['sensor', 'earned_trophies_gold', 'gold_trophies'],
  silver: ['sensor', 'earned_trophies_silver', 'silver_trophies'],
  bronze: ['sensor', 'earned_trophies_bronze', 'bronze_trophies'],
  now_playing: ['sensor', 'now_playing', 'now_playing'],
  now_playing_image: ['image', 'now_playing_image', 'now_playing'],
  avatar: ['image', 'avatar', 'avatar'],
  ps_plus: ['binary_sensor', 'ps_plus_status', 'subscribed_to_playstation_plus'],
};

const BY_TRANSLATION_KEY = new Map(
  Object.entries(LOOKUP).map(([key, [domain, tk]]) => [`${domain}.${tk}`, key as EntityKey]),
);

const ENTITY_KEYS = [...Object.keys(LOOKUP), 'media_player'] as EntityKey[];

interface Discovered {
  entities: PlayStationEntities;
  /** Console media players linked to this account */
  consoles: string[];
}

/** Finds the entities of the PSN account that `entityId` (its Online ID sensor) belongs to. */
function discover(hass: HomeAssistant, entityId: string): Discovered {
  const entities: PlayStationEntities = {};
  const consoles: string[] = [];
  const registry = hass.entities;
  const deviceId = registry?.[entityId]?.device_id;

  if (registry && deviceId) {
    for (const entry of Object.values(registry)) {
      if (entry.platform !== PLATFORM) continue;
      const domain = entry.entity_id.split('.')[0];
      if (entry.device_id === deviceId) {
        const key = BY_TRANSLATION_KEY.get(`${domain}.${entry.translation_key}`);
        if (key && !entities[key]) entities[key] = entry.entity_id;
      } else if (
        domain === 'media_player' &&
        entry.device_id &&
        hass.devices?.[entry.device_id]?.via_device_id === deviceId
      ) {
        consoles.push(entry.entity_id);
      }
    }
    return { entities, consoles };
  }

  // No registry (or the sensor is not registered): fall back to the English entity ids.
  const prefix = entityId.match(/^sensor\.(.+)_online_id$/)?.[1];
  if (prefix) {
    for (const [key, [domain, , suffix]] of Object.entries(LOOKUP)) {
      const id = `${domain}.${prefix}_${suffix}`;
      if (hass.states[id]) entities[key as EntityKey] = id;
    }
  }
  return { entities, consoles };
}

interface StatusMeta {
  label: string;
  color: string;
}

const STATUS: Record<string, StatusMeta> = {
  availabletoplay: {
    label: 'Online',
    color: 'var(--custom-psn-online-color, var(--success-color, #4caf50))',
  },
  availabletocommunicate: {
    label: 'Online on PS App',
    color: 'var(--custom-psn-app-color, var(--info-color, #2196f3))',
  },
  busy: { label: 'Away', color: 'var(--custom-psn-away-color, var(--warning-color, #ff9800))' },
  offline: {
    label: 'Offline',
    color: 'var(--custom-psn-offline-color, var(--disabled-text-color, #9e9e9e))',
  },
};

const GRADES = [
  { key: 'platinum', label: 'Platinum', icon: 'mdi:trophy', color: '#a9c4e4' },
  { key: 'gold', label: 'Gold', icon: 'mdi:trophy-variant', color: '#e3b23c' },
  { key: 'silver', label: 'Silver', icon: 'mdi:trophy-variant', color: '#b1b8c0' },
  { key: 'bronze', label: 'Bronze', icon: 'mdi:trophy-variant', color: '#c47c48' },
] as const;

const gradeColor = (grade: (typeof GRADES)[number]) =>
  `var(--custom-psn-${grade.key}-color, ${grade.color})`;

/** PS5 trophy level tiers: bronze 1–299, silver 300–599, gold 600–998, platinum 999. */
function levelGrade(level: number | undefined) {
  if (level == null) return GRADES[3];
  if (level >= 999) return GRADES[0];
  if (level >= 600) return GRADES[1];
  if (level >= 300) return GRADES[2];
  return GRADES[3];
}

const ACTIVE_CONSOLE = ['playing', 'on'];

/**
 * URL of an `image.*` entity. The proxy URL stays the same when the picture changes, so the
 * entity's state (the time the image last changed) is appended to bust the browser cache.
 */
function imageEntityUrl(entity: HassEntity | undefined): string | undefined {
  if (!entity || isUnavailable(entity)) return undefined;
  const url = entity.attributes['entity_picture'] as string | undefined;
  if (!url || !url.startsWith('/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}state=${encodeURIComponent(entity.state)}`;
}

export class PlayStationCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: PlayStationCardConfig;
  /** Image URLs that failed to load (e.g. the now-playing image after the game closed) */
  @state() private _broken = new Set<string>();
  private _cache?: {
    entityId: string;
    registry: HomeAssistant['entities'];
    devices: HomeAssistant['devices'];
    result: Discovered;
  };

  static styles = [
    sharedStyles,
    css`
      .clickable {
        cursor: pointer;
      }
      .avatar {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--cc-muted-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        font-size: 1.2rem;
        color: var(--secondary-text-color);
        flex-shrink: 0;
        position: relative;
        box-shadow: 0 0 0 2px var(--status-color, transparent);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }
      .avatar .dot {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--status-color);
        border: 2px solid var(--card-background-color, #fff);
      }
      .who {
        flex: 1;
        min-width: 0;
      }
      .title {
        overflow-wrap: anywhere;
      }
      .status {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 6px;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--status-color, var(--secondary-text-color));
        margin-top: 2px;
      }
      .status .since {
        color: var(--secondary-text-color);
        font-weight: 400;
      }
      .plus {
        --plus-color: var(--custom-psn-plus-color, #f5b301);
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
        color: var(--plus-color);
        background: color-mix(in srgb, var(--plus-color) 16%, transparent);
        flex-shrink: 0;
        align-self: flex-start;
      }
      .plus ha-icon {
        --mdc-icon-size: 14px;
      }

      /* ---- Now playing ---- */
      .now-playing {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: var(--cc-radius);
        background: var(--cc-accent-soft);
        overflow: hidden;
        isolation: isolate;
      }
      /* Blurred cover art behind the row; a pseudo-element so it can bleed past the clip. */
      .now-playing.has-cover::before {
        content: '';
        position: absolute;
        inset: -20px;
        background-image: var(--cover);
        background-size: cover;
        background-position: center;
        filter: blur(18px) saturate(1.4);
        opacity: 0.35;
        z-index: -1;
      }
      .cover {
        width: 56px;
        height: 56px;
        border-radius: calc(var(--cc-radius) * 0.75);
        background: var(--cc-muted-bg);
        color: var(--cc-accent);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cover ha-icon {
        --mdc-icon-size: 28px;
      }
      .np-body {
        flex: 1;
        min-width: 0;
      }
      .np-label {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--cc-accent);
      }
      .np-title {
        font-size: 0.95rem;
        font-weight: 500;
        line-height: 1.25;
        margin-top: 2px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow-wrap: anywhere;
      }
      .np-console {
        font-size: 0.75rem;
        color: var(--secondary-text-color);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ---- Trophy level ---- */
      .level {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .level-badge {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--grade-color);
        background: color-mix(in srgb, var(--grade-color) 18%, transparent);
      }
      .level-badge ha-icon {
        --mdc-icon-size: 22px;
      }
      .level-body {
        flex: 1;
        min-width: 0;
      }
      .level-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
      }
      .level-label {
        font-size: 0.75rem;
        color: var(--secondary-text-color);
      }
      .level-value {
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1.1;
      }
      .level-next {
        margin-left: auto;
        font-size: 0.72rem;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }
      .bar {
        height: 6px;
        border-radius: 3px;
        background: var(--cc-muted-bg);
        overflow: hidden;
        margin-top: 6px;
      }
      .bar .fill {
        height: 100%;
        border-radius: inherit;
        background: var(--custom-psn-progress-color, var(--cc-accent));
        transition: width 0.4s ease;
      }

      /* ---- Trophies ---- */
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 0.72rem;
        font-weight: 500;
        color: var(--secondary-text-color);
        margin-bottom: -4px;
      }
      .trophies {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .trophy {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 10px 4px;
        min-width: 0;
        border: none;
        font: inherit;
        color: inherit;
        border-radius: var(--cc-radius);
        background: var(--cc-muted-bg);
        cursor: pointer;
        transition: transform 0.15s;
      }
      .trophy:hover {
        transform: scale(1.04);
      }
      .trophy:active {
        transform: scale(0.95);
      }
      .trophy ha-icon {
        --mdc-icon-size: 22px;
        color: var(--grade-color);
      }
      .trophy .count {
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.2;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .trophy .grade {
        font-size: 0.68rem;
        color: var(--secondary-text-color);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @container card (max-width: 380px) {
        .avatar {
          width: 46px;
          height: 46px;
        }
        .cover {
          width: 48px;
          height: 48px;
        }
        .trophies {
          gap: 6px;
        }
      }
      @container card (max-width: 260px) {
        .trophies {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .level-next {
          margin-left: 0;
        }
        .cover {
          width: 40px;
          height: 40px;
        }
        .plus span {
          display: none;
        }
      }
    `,
  ];

  setConfig(config: PlayStationCardConfig) {
    if (!config.entity)
      throw new Error("playstation-card: 'entity' (Online ID sensor) is required");
    this._config = config;
    this._cache = undefined;
  }

  static getConfigElement() {
    return document.createElement('custom-playstation-card-editor');
  }

  static getStubConfig(hass?: HomeAssistant): Omit<PlayStationCardConfig, 'type'> {
    const registered = Object.values(hass?.entities ?? {}).find(
      (e) =>
        e.platform === PLATFORM &&
        e.translation_key === 'online_id' &&
        e.entity_id.startsWith('sensor.'),
    )?.entity_id;
    const entity =
      registered ??
      Object.keys(hass?.states ?? {}).find(
        (e) => e.startsWith('sensor.') && e.endsWith('_online_id'),
      ) ??
      'sensor.psn_online_id';
    return { entity };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** Discovered entities, with any configured override taking precedence. */
  private _entities(): Discovered {
    const c = this._config;
    const { entities: registry, devices } = this.hass;
    let result: Discovered;
    if (
      registry &&
      this._cache?.entityId === c.entity &&
      this._cache.registry === registry &&
      this._cache.devices === devices
    ) {
      result = this._cache.result;
    } else {
      result = discover(this.hass, c.entity);
      this._cache = registry ? { entityId: c.entity, registry, devices, result } : undefined;
    }
    const entities = { ...result.entities };
    for (const key of ENTITY_KEYS) if (c[key]) entities[key] = c[key];
    return { entities, consoles: result.consoles };
  }

  private _state(id?: string): HassEntity | undefined {
    return id ? this.hass.states[id] : undefined;
  }

  /** The console that is currently in use, if any. */
  private _activeConsole(e: PlayStationEntities, consoles: string[]): HassEntity | undefined {
    const candidates = e.media_player ? [e.media_player] : consoles;
    const states = candidates
      .map((id) => this._state(id))
      .filter((s): s is HassEntity => !!s && ACTIVE_CONSOLE.includes(s.state));
    return states.find((s) => s.state === 'playing') ?? states[0];
  }

  private _image(url: string | undefined): string | undefined {
    return url && !this._broken.has(url) ? url : undefined;
  }

  private _onImageError(url: string) {
    this._broken = new Set(this._broken).add(url);
  }

  private _more(entityId?: string) {
    return (ev: Event) => {
      ev.stopPropagation();
      if (entityId) fireMoreInfo(this, entityId);
    };
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const { entities: e, consoles } = this._entities();
    const idEntity = this._state(c.entity);

    if (!idEntity) {
      return html`<ha-card>
        <div class="unavailable-banner">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>Entity not found: ${c.entity}
        </div>
      </ha-card>`;
    }

    const name =
      c.name ??
      (isUnavailable(idEntity) ? prettify(c.entity.replace(/_online_id$/, '')) : idEntity.state);

    return html`
      <ha-card>
        ${this._renderHeader(c, e, idEntity, name)}
        ${c.show_now_playing !== false ? this._renderNowPlaying(e, consoles) : nothing}
        ${c.show_level !== false ? this._renderLevel(e) : nothing}
        ${c.show_trophies !== false ? this._renderTrophies(e) : nothing}
      </ha-card>
    `;
  }

  private _renderHeader(
    c: PlayStationCardConfig,
    e: PlayStationEntities,
    idEntity: HassEntity,
    name: string,
  ) {
    const picture =
      this._image(idEntity.attributes['entity_picture'] as string | undefined) ??
      this._image(imageEntityUrl(this._state(e.avatar)));

    const statusEntity = this._state(e.online_status);
    const statusKey = isUnavailable(statusEntity) ? undefined : statusEntity!.state;
    const status = statusKey ? STATUS[statusKey] : undefined;
    // HA translates the enum state; fall back to our English labels when it did not.
    const formatted = statusEntity ? formatState(this.hass, statusEntity) : '';
    const statusLabel =
      formatted && formatted.toLowerCase() !== statusKey ? formatted : (status?.label ?? statusKey);

    const lastOnline = this._state(e.last_online);
    const since =
      statusKey === 'offline' && !isUnavailable(lastOnline)
        ? relativeTime(lastOnline!.state, lang(this.hass))
        : '';
    const plus = this._state(e.ps_plus)?.state === 'on';

    return html`
      <div
        class="header clickable"
        style=${styleMap({ '--status-color': status?.color ?? null })}
        @click=${this._more(c.entity)}
      >
        <div class="avatar">
          ${
            picture
              ? html`<img src=${picture} alt="" @error=${() => this._onImageError(picture)} />`
              : name.charAt(0).toUpperCase()
          }
          ${status ? html`<div class="dot"></div>` : nothing}
        </div>
        <div class="who">
          <div class="title">${name}</div>
          ${
            statusLabel
              ? html`<div class="status">
                  <span>${statusLabel}</span>
                  ${since ? html`<span class="since">· ${since}</span>` : nothing}
                </div>`
              : nothing
          }
        </div>
        ${
          plus
            ? html`<div class="plus" title="PlayStation Plus">
                <ha-icon icon="mdi:plus-box"></ha-icon><span>PS Plus</span>
              </div>`
            : nothing
        }
      </div>
    `;
  }

  private _renderNowPlaying(e: PlayStationEntities, consoles: string[]) {
    const sensor = this._state(e.now_playing);
    const active = this._activeConsole(e, consoles);
    const title =
      (!isUnavailable(sensor) && sensor!.state.trim()) ||
      (active?.attributes['media_title'] as string | undefined);
    if (!title) return nothing;

    const cover =
      this._image(imageEntityUrl(this._state(e.now_playing_image))) ??
      this._image(active?.attributes['entity_picture'] as string | undefined);
    const consoleName = active?.attributes['friendly_name'] as string | undefined;

    return html`
      <div
        class="now-playing clickable ${cover ? 'has-cover' : ''}"
        style=${styleMap({ '--cover': cover ? `url(${JSON.stringify(cover)})` : null })}
        @click=${this._more(active?.entity_id ?? e.now_playing)}
      >
        <div class="cover">
          ${
            cover
              ? html`<img src=${cover} alt="" @error=${() => this._onImageError(cover)} />`
              : html`<ha-icon icon="mdi:controller"></ha-icon>`
          }
        </div>
        <div class="np-body">
          <div class="np-label">Now playing</div>
          <div class="np-title">${title}</div>
          ${consoleName ? html`<div class="np-console">${consoleName}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderLevel(e: PlayStationEntities) {
    const level = numericState(this.hass, e.trophy_level);
    if (level == null) return nothing;
    const progress = numericState(this.hass, e.next_level);
    const pct = progress == null ? undefined : Math.max(0, Math.min(100, progress));
    const grade = levelGrade(level);
    const locale = lang(this.hass);

    return html`
      <div
        class="level clickable"
        style=${styleMap({ '--grade-color': gradeColor(grade) })}
        @click=${this._more(e.trophy_level)}
      >
        <div class="level-badge"><ha-icon icon="mdi:trophy-award"></ha-icon></div>
        <div class="level-body">
          <div class="level-row">
            <span class="level-label">Level</span>
            <span class="level-value">${Math.round(level).toLocaleString(locale)}</span>
            ${
              pct != null && level < 999
                ? html`<span class="level-next"
                    >${Math.round(pct)}% to ${(Math.round(level) + 1).toLocaleString(locale)}</span
                  >`
                : nothing
            }
          </div>
          ${
            pct != null
              ? html`<div
                  class="bar"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow=${Math.round(pct)}
                >
                  <div class="fill" style=${styleMap({ width: `${pct}%` })}></div>
                </div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderTrophies(e: PlayStationEntities) {
    const counts = GRADES.map((g) => ({
      ...g,
      id: e[g.key],
      value: numericState(this.hass, e[g.key]),
    }));
    if (counts.every((t) => t.value == null)) return nothing;
    const locale = lang(this.hass);
    const total = counts.reduce((sum, t) => sum + (t.value ?? 0), 0);

    return html`
      <div class="section-head">
        <span>Trophies</span><span>${Math.round(total).toLocaleString(locale)}</span>
      </div>
      <div class="trophies">
        ${counts.map(
          (t) => html`
            <button
              class="trophy"
              style=${styleMap({ '--grade-color': gradeColor(t) })}
              title=${`${t.label} trophies`}
              @click=${this._more(t.id)}
            >
              <ha-icon icon=${t.icon}></ha-icon>
              <span class="count"
                >${t.value == null ? '—' : Math.round(t.value).toLocaleString(locale)}</span
              >
              <span class="grade">${t.label}</span>
            </button>
          `,
        )}
      </div>
    `;
  }
}

customElements.define('custom-playstation-card', PlayStationCard);
