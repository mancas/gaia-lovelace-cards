import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, SwitchCardConfig, GridOptions } from '../types.js';
import { defineEditor, isUnavailable, haptic, sharedStyles } from '../helpers.js';

defineEditor(
  'custom-switch-card-editor',
  [
    {
      name: 'entity',
      required: true,
      selector: { entity: { domain: ['switch', 'input_boolean'] } },
    },
    { name: 'name', selector: { text: {} } },
    { name: 'icon', selector: { icon: {} } },
    { name: 'show_state', selector: { boolean: {} } },
    {
      name: 'switch_layout',
      selector: { select: { options: ['below', 'inline'] } },
    },
  ],
  {
    helpers: {
      show_state: 'Show ON / OFF label below the toggle',
      switch_layout: 'Place the toggle below the name (below) or next to it (inline)',
    },
  },
);

const DOMAIN_ICONS: Record<string, [string, string]> = {
  switch: ['mdi:toggle-switch', 'mdi:toggle-switch-off-outline'],
  input_boolean: ['mdi:check-circle', 'mdi:circle-outline'],
  light: ['mdi:lightbulb', 'mdi:lightbulb-off-outline'],
  fan: ['mdi:fan', 'mdi:fan-off'],
};

export class SwitchCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SwitchCardConfig;

  static styles = [
    sharedStyles,
    css`
      ha-card {
        padding: 20px 16px;
        align-items: center;
        transition: background 0.4s ease;
      }
      ha-card.on {
        background: color-mix(in srgb, var(--cc-accent) 8%, var(--card-background-color, #1e293b));
      }
      ha-card.unavailable {
        opacity: 0.5;
        pointer-events: none;
      }
      .header {
        width: 100%;
      }
      .switch-body {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px 0;
      }
      .switch-track {
        width: 88px;
        height: 50px;
        border-radius: 25px;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        background: color-mix(in srgb, var(--disabled-text-color, #9e9e9e) 45%, transparent);
        box-shadow:
          inset 0 2px 5px rgba(0, 0, 0, 0.3),
          inset 0 -1px 2px rgba(255, 255, 255, 0.04);
        transition:
          background 0.35s ease,
          box-shadow 0.35s ease,
          transform 0.08s ease;
        outline: none;
      }
      .switch-track:active {
        transform: scale(0.94);
      }
      .switch-track:focus-visible {
        outline: 2px solid var(--cc-accent);
        outline-offset: 4px;
      }
      .switch-track.on {
        background: var(--cc-accent);
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.18);
      }
      /* Knob — positioned absolutely inside the track */
      .switch-knob {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        position: absolute;
        top: 4px;
        left: 4px;
        background: radial-gradient(circle at 38% 32%, #ffffff 0%, #d5d5d5 100%);
        box-shadow:
          0 3px 10px rgba(0, 0, 0, 0.45),
          0 1px 3px rgba(0, 0, 0, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        /* Spring overshoot cubic-bezier gives the physical "snap" feel */
        transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      /* 88 − 42 − 4 − 4 = 38px travel distance */
      .switch-track.on .switch-knob {
        transform: translateX(38px);
        box-shadow:
          0 3px 10px rgba(0, 0, 0, 0.4),
          0 1px 3px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      /* Small LED dot on the knob surface */
      .knob-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.1);
        transition: background 0.3s ease;
      }
      .switch-track.on .knob-dot {
        background: color-mix(in srgb, var(--cc-accent) 80%, black);
      }
      /* Inline layout: switch sits in the header row, to the right */
      .header.inline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .header.inline .title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* State label */
      .state-label {
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        transition: color 0.35s ease;
      }
      .state-label.on {
        color: var(--cc-accent);
      }
    `,
  ];

  setConfig(config: SwitchCardConfig) {
    if (!config.entity) throw new Error("switch-card: 'entity' is required");
    this._config = { show_state: true, switch_layout: 'below', ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-switch-card-editor');
  }

  static getStubConfig(): Omit<SwitchCardConfig, 'type'> {
    return { entity: 'switch.example', show_state: true };
  }

  getCardSize() {
    return 3;
  }

  getGridOptions(): GridOptions {
    return { columns: 2, rows: 3, min_columns: 2, min_rows: 2 };
  }

  private get _entity() {
    return this.hass?.states[this._config.entity];
  }

  private _toggle() {
    const entity = this._entity;
    if (!entity || isUnavailable(entity)) return;
    haptic(this, 'medium');
    const domain = this._config.entity.split('.')[0];
    this.hass.callService(domain, 'toggle', { entity_id: this._config.entity });
  }

  render() {
    if (!this._config || !this.hass) return nothing;

    const entity = this._entity;
    if (!entity) {
      return html`<ha-card><p style="padding:16px;opacity:.6">Entity not found</p></ha-card>`;
    }

    const unavailable = isUnavailable(entity);
    const isOn = entity.state === 'on';
    const name =
      this._config.name ??
      (entity.attributes['friendly_name'] as string | undefined) ??
      this._config.entity;

    const domain = this._config.entity.split('.')[0];
    const [iconOn, iconOff] = DOMAIN_ICONS[domain] ?? [
      'mdi:toggle-switch',
      'mdi:toggle-switch-off-outline',
    ];
    const icon = this._config.icon ?? (isOn ? iconOn : iconOff);

    const trackClass = isOn ? 'on' : '';
    const inline = this._config.switch_layout === 'inline';

    const switchToggle = html`
      <div
        class="switch-track ${trackClass}"
        role="switch"
        tabindex="0"
        aria-checked="${isOn ? 'true' : 'false'}"
        aria-label="${name}"
        @click=${this._toggle}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._toggle();
          }
        }}
      >
        <div class="switch-knob">
          <div class="knob-dot"></div>
        </div>
      </div>
    `;

    return html`
      <ha-card class="${isOn ? 'on' : ''} ${unavailable ? 'unavailable' : ''}">
        <div class="header ${inline ? 'inline' : ''}">
          <div class="icon-bubble ${isOn ? 'active' : ''}">
            <ha-icon .icon=${icon}></ha-icon>
          </div>
          <div class="title">${name}</div>
          ${inline ? switchToggle : nothing}
        </div>

        ${!inline ? html`<div class="switch-body">${switchToggle}</div>` : nothing}
        ${
          this._config.show_state !== false
            ? html`<div class="state-label ${isOn ? 'on' : ''}">${isOn ? 'On' : 'Off'}</div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-switch-card', SwitchCard);
