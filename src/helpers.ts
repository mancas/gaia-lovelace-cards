import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, HassEntity } from './types.js';

/* ------------------------------------------------------------------ */
/*  Editor factory — every card gets a `ha-form` based visual editor   */
/* ------------------------------------------------------------------ */

export type FormSchema = Array<Record<string, unknown>>;

/**
 * Registers `<tagName>` as a simple ha-form editor bound to the given schema.
 * Complex list configs (actions, entities…) stay YAML‑only, which the schema
 * simply omits — HA keeps unknown keys untouched while editing.
 */
export function defineEditor(tagName: string, schema: FormSchema, labels?: Record<string, string>) {
  if (customElements.get(tagName)) return;

  class GenericEditor extends LitElement {
    @property({ attribute: false }) hass!: HomeAssistant;
    @state() private _config: Record<string, unknown> = {};

    set config(config: Record<string, unknown>) {
      this._config = config;
    }

    render() {
      return html`<ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${(s: { name: string }) => labels?.[s.name] ?? prettify(s.name)}
        @value-changed=${this._valueChanged}
      ></ha-form>`;
    }

    private _valueChanged(ev: Event) {
      const value = (ev as CustomEvent<{ value: Record<string, unknown> }>).detail.value;
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
    text-overflow: ellipsis;
    white-space: nowrap;
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
      color 0.15s;
    white-space: nowrap;
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
      color 0.2s;
    color: var(--secondary-text-color);
    border: none;
    font: inherit;
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
`;
