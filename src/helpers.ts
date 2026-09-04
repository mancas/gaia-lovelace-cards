import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, HassEntity } from './types.js';

/* ------------------------------------------------------------------ */
/*  Editor factory — every card gets a `ha-form` based visual editor   */
/* ------------------------------------------------------------------ */

export type FormSchema = Array<Record<string, unknown>>;

export interface EditorOptions {
  /** Overrides for the auto-prettified field labels */
  labels?: Record<string, string>;
  /** Helper text shown under a field */
  helpers?: Record<string, string>;
  /**
   * Throw from here to tell Home Assistant this particular config cannot be
   * represented by the form — HA then falls back to the YAML editor instead of
   * silently rewriting keys the schema does not model.
   */
  guard?: (config: Record<string, unknown>) => void;
}

/**
 * Registers `<tagName>` as a simple ha-form editor bound to the given schema.
 *
 * The element implements the contract Home Assistant expects of a card editor:
 * a `setConfig(config)` method, a `hass` property, and a bubbling
 * `config-changed` event. Keys the schema does not model are preserved,
 * because ha-form emits the whole data object it was given.
 */
export function defineEditor(tagName: string, schema: FormSchema, options: EditorOptions = {}) {
  if (customElements.get(tagName)) return;
  const { labels, helpers, guard } = options;

  class GenericEditor extends LitElement {
    @property({ attribute: false }) hass!: HomeAssistant;
    @state() private _config: Record<string, unknown> = {};

    static styles = css`
      ha-form {
        display: block;
      }
    `;

    /** Called by HA's `hui-element-editor` every time the config changes. */
    setConfig(config: Record<string, unknown>) {
      guard?.(config);
      this._config = config ?? {};
    }

    render() {
      if (!this.hass) return nothing;
      return html`<ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${(s: { name: string }) => labels?.[s.name] ?? prettify(s.name)}
        .computeHelper=${(s: { name: string }) => helpers?.[s.name] ?? ''}
        @value-changed=${this._valueChanged}
      ></ha-form>`;
    }

    private _valueChanged(ev: Event) {
      // Keep the raw ha-form event inside the editor; HA listens for `config-changed`.
      ev.stopPropagation();
      const value = { ...(ev as CustomEvent<{ value: Record<string, unknown> }>).detail.value };
      // Clearing a field leaves an empty string / empty list behind. Drop those
      // so the stored config stays as terse as a hand-written one.
      for (const [key, v] of Object.entries(value)) {
        if (v === '' || v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
          delete value[key];
        }
      }
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: value },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
  customElements.define(tagName, GenericEditor);
}

/* ------------------------------------------------------------------ */
/*  Entity helpers                                                     */
/* ------------------------------------------------------------------ */

export function prettify(id: string): string {
  const s = id.includes('.') ? id.split('.')[1] : id;
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function friendlyName(
  hass: HomeAssistant | undefined,
  entityId: string | undefined,
  fallback?: string,
) {
  if (!entityId) return fallback ?? '';
  const e = hass?.states[entityId];
  return fallback ?? (e?.attributes?.['friendly_name'] as string | undefined) ?? prettify(entityId);
}

export function isUnavailable(entity?: HassEntity): boolean {
  return !entity || entity.state === 'unavailable' || entity.state === 'unknown';
}

export function numericState(
  hass: HomeAssistant | undefined,
  entityId?: string,
): number | undefined {
  if (!entityId) return undefined;
  const raw = hass?.states[entityId]?.state;
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function formatNumber(n: number | undefined, decimals = 1, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return n.toFixed(decimals).replace(/\.0+$/, '');
}

export function formatState(hass: HomeAssistant | undefined, entity?: HassEntity): string {
  if (!entity) return '—';
  try {
    return hass?.formatEntityState ? hass.formatEntityState(entity) : entity.state;
  } catch {
    return entity.state;
  }
}

/** "3 min ago", "2 h ago", "yesterday" */
export function relativeTime(iso: string | undefined, lang = 'en'): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (Math.abs(sec) < 60) return rtf.format(-sec, 'second');
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, 'hour');
  return rtf.format(-Math.round(hr / 24), 'day');
}

/** Time until an ISO timestamp, e.g. "1 h 20 min" */
export function durationUntil(iso: string | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`;
}

export function lang(hass?: HomeAssistant): string {
  return hass?.locale?.language ?? hass?.language ?? navigator.language ?? 'en';
}

/* ------------------------------------------------------------------ */
/*  Events                                                             */
/* ------------------------------------------------------------------ */

export function fireMoreInfo(el: HTMLElement, entityId: string) {
  el.dispatchEvent(
    new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId } }),
  );
}

export function navigate(el: HTMLElement, path: string) {
  history.pushState(null, '', path);
  el.dispatchEvent(
    new CustomEvent('location-changed', {
      bubbles: true,
      composed: true,
      detail: { replace: false },
    }),
  );
}

/** Tiny haptic hint, ignored on desktop. */
export function haptic(
  el: HTMLElement,
  type: 'light' | 'medium' | 'success' | 'failure' = 'light',
) {
  el.dispatchEvent(new CustomEvent('haptic', { bubbles: true, composed: true, detail: type }));
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

/** Common building blocks: card header, pills, tile grid, toggle switch. */
export const sharedStyles = css`
  :host {
    display: block;
    --cc-radius: var(--ha-card-border-radius, 12px);
    --cc-muted-bg: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    --cc-accent: var(--primary-color, #03a9f4);
    --cc-on-accent: var(--text-primary-color, #fff);
    --cc-accent-soft: color-mix(in srgb, var(--cc-accent) 16%, transparent);
  }
  ha-card {
    padding: 16px;
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    container-type: inline-size;
    container-name: card;
    overflow: hidden;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .header .title {
    font-size: 1rem;
    font-weight: 500;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.25;
  }
  .header .subtitle {
    font-size: 0.78rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-bubble {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cc-muted-bg);
    color: var(--secondary-text-color);
    flex-shrink: 0;
    transition:
      background 0.2s,
      color 0.2s;
  }
  .icon-bubble.active {
    background: var(--cc-accent-soft);
    color: var(--cc-accent);
  }
  .icon-bubble ha-icon {
    --mdc-icon-size: 22px;
  }
  .pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pill {
    border: none;
    font: inherit;
    font-size: 0.78rem;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--cc-muted-bg);
    color: var(--secondary-text-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition:
      background 0.15s,
      color 0.15s,
      transform 0.1s;
    white-space: nowrap;
  }
  .pill:hover {
    transform: scale(1.04);
  }
  .pill:active {
    transform: scale(0.95);
  }
  .pill ha-icon {
    --mdc-icon-size: 16px;
  }
  .pill.active {
    background: var(--cc-accent);
    color: var(--cc-on-accent);
  }
  .toggle {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    position: relative;
    cursor: pointer;
    background: var(--disabled-text-color, #9e9e9e);
    transition: background 0.15s ease;
    flex-shrink: 0;
  }
  .toggle.on {
    background: var(--cc-accent);
  }
  .toggle .knob {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .toggle.on .knob {
    left: 20px;
  }
  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border-radius: var(--cc-radius);
    background: var(--cc-muted-bg);
    cursor: pointer;
    min-width: 0;
    transition:
      background 0.2s,
      color 0.2s,
      transform 0.15s;
    color: var(--secondary-text-color);
    border: none;
    font: inherit;
  }
  .tile:hover {
    transform: scale(1.04);
  }
  .tile:active {
    transform: scale(0.95);
  }
  .tile.active {
    background: var(--cc-accent-soft);
    color: var(--cc-accent);
  }
  .tile.unavailable {
    opacity: 0.4;
    pointer-events: none;
  }
  .tile ha-icon {
    --mdc-icon-size: 22px;
  }
  .tile .tile-name {
    font-size: 0.7rem;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--primary-text-color);
  }
  .tile .tile-state {
    font-size: 0.65rem;
    opacity: 0.8;
  }
  .sensor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 8px;
  }
  .sensor-tile {
    background: var(--cc-muted-bg);
    border-radius: var(--cc-radius);
    padding: 10px 12px;
    min-width: 0;
  }
  .sensor-tile .label {
    font-size: 0.72rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sensor-tile .value {
    font-size: 1.15rem;
    font-weight: 500;
    margin-top: 2px;
  }
  .sensor-tile .value small {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--secondary-text-color);
    margin-left: 2px;
  }
  .section-label {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin: 2px 0 -6px;
  }
  .unavailable-banner {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--cc-accent);
    cursor: pointer;
    margin: 0;
  }

  /* ---- Narrow card (phone, or a 3–4 column card on desktop) ---- */
  @container card (max-width: 380px) {
    ha-card {
      padding: 14px;
      gap: 10px;
    }
    .sensor-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tile-grid {
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    }
    .pill {
      padding: 5px 10px;
      font-size: 0.74rem;
    }
    .icon-bubble {
      width: 36px;
      height: 36px;
    }
  }
  @container card (max-width: 260px) {
    .header {
      flex-wrap: wrap;
    }
    .sensor-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .pill span,
    .pill-label {
      display: none;
    }
  }
`;
