import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, QuickActionsCardConfig, QuickAction, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  friendlyName,
  haptic,
  navigate,
  isUnavailable,
} from '../helpers.js';

defineEditor('custom-quick-actions-card-editor', [
  { name: 'name', selector: { text: {} } },
  { name: 'columns', selector: { number: { min: 2, max: 8, mode: 'box' } } },
]);

const DOMAIN_DEFAULTS: Record<string, { service: string; icon: string }> = {
  script: { service: 'script.turn_on', icon: 'mdi:script-text-play' },
  scene: { service: 'scene.turn_on', icon: 'mdi:palette' },
  automation: { service: 'automation.trigger', icon: 'mdi:robot' },
  button: { service: 'button.press', icon: 'mdi:gesture-tap-button' },
  input_button: { service: 'input_button.press', icon: 'mdi:gesture-tap-button' },
  input_boolean: { service: 'input_boolean.toggle', icon: 'mdi:toggle-switch' },
  switch: { service: 'switch.toggle', icon: 'mdi:power' },
  light: { service: 'light.toggle', icon: 'mdi:lightbulb' },
  fan: { service: 'fan.toggle', icon: 'mdi:fan' },
  lock: { service: 'lock.lock', icon: 'mdi:lock' },
  cover: { service: 'cover.toggle', icon: 'mdi:window-shutter' },
  media_player: { service: 'media_player.toggle', icon: 'mdi:play-pause' },
  vacuum: { service: 'vacuum.start', icon: 'mdi:robot-vacuum' },
};

export class QuickActionsCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: QuickActionsCardConfig;
  @state() private _pressed = new Set<number>();

  static styles = [
    sharedStyles,
    css`
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 4), 1fr);
        gap: 8px;
      }
      .tile {
        padding: 12px 6px;
        position: relative;
      }
      .tile.pressed {
        background: var(--cc-accent);
        color: var(--cc-on-accent);
      }
      .tile.pressed .tile-name {
        color: var(--cc-on-accent);
      }
      .tile ha-icon {
        --mdc-icon-size: 24px;
      }
      .tile.arm::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        border: 2px dashed var(--warning-color, #ff9800);
      }
    `,
  ];

  setConfig(config: QuickActionsCardConfig) {
    if (!config.actions?.length) throw new Error("quick-actions-card: 'actions' is required");
    this._config = { columns: 4, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-quick-actions-card-editor');
  }

  static getStubConfig(): Omit<QuickActionsCardConfig, 'type'> {
    return {
      name: 'Quick actions',
      columns: 4,
      actions: [{ entity: 'script.good_night', name: 'Good night', icon: 'mdi:weather-night' }],
    };
  }

  getCardSize() {
    return 1 + Math.ceil((this._config?.actions.length ?? 0) / (this._config?.columns ?? 4)) * 1.5;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private _armed = new Map<number, number>();

  private _run(action: QuickAction, index: number) {
    if (action.navigation_path) {
      navigate(this, action.navigation_path);
      return;
    }
    // Confirmation: first tap arms the tile for 3 s, second tap fires
    if (action.confirm) {
      const armedAt = this._armed.get(index);
      if (!armedAt || Date.now() - armedAt > 3000) {
        this._armed.set(index, Date.now());
        haptic(this, 'medium');
        this.requestUpdate();
        window.setTimeout(() => {
          this._armed.delete(index);
          this.requestUpdate();
        }, 3000);
        return;
      }
      this._armed.delete(index);
    }
    const domain = action.entity?.split('.')[0];
    const service = action.service ?? (domain ? DOMAIN_DEFAULTS[domain]?.service : undefined);
    if (!service) return;
    const [sDomain, sName] = service.split('.');
    const data: Record<string, unknown> = { ...(action.service_data ?? {}) };
    if (action.entity && !('entity_id' in data)) data['entity_id'] = action.entity;
    haptic(this, 'success');
    this.hass.callService(sDomain, sName, data);
    this._pressed = new Set([...this._pressed, index]);
    window.setTimeout(() => {
      const next = new Set(this._pressed);
      next.delete(index);
      this._pressed = next;
    }, 600);
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    return html`
      <ha-card>
        ${c.name ? html`<div class="header"><div class="title">${c.name}</div></div>` : nothing}
        <div class="grid" style="--cols:${c.columns ?? 4}">
          ${c.actions.map((a, i) => {
            const entity = a.entity ? this.hass.states[a.entity] : undefined;
            const domain = a.entity?.split('.')[0] ?? '';
            const icon =
              a.icon ??
              (entity?.attributes['icon'] as string | undefined) ??
              DOMAIN_DEFAULTS[domain]?.icon ??
              'mdi:flash';
            const name = a.name ?? (a.entity ? friendlyName(this.hass, a.entity) : 'Action');
            const stateful = [
              'switch',
              'light',
              'fan',
              'input_boolean',
              'automation',
              'media_player',
            ].includes(domain);
            const active =
              stateful && entity ? entity.state === 'on' || entity.state === 'playing' : false;
            const unavailable = a.entity ? !!entity && isUnavailable(entity) : false;
            const armed = this._armed.has(i);
            return html`<button
              class="tile ${active ? 'active' : ''} ${this._pressed.has(i) ? 'pressed' : ''} ${unavailable ? 'unavailable' : ''} ${armed ? 'arm' : ''}"
              title=${a.entity ?? name}
              @click=${() => this._run(a, i)}
            >
              <ha-icon icon=${armed ? 'mdi:help-circle-outline' : icon}></ha-icon>
              <span class="tile-name">${armed ? 'Tap again' : name}</span>
            </button>`;
          })}
        </div>
      </ha-card>
    `;
  }
}

customElements.define('custom-quick-actions-card', QuickActionsCard);
