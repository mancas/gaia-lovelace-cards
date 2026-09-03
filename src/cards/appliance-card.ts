import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, ApplianceCardConfig, GridOptions } from '../types.js';
import {
  defineEditor,
  sharedStyles,
  fireMoreInfo,
  friendlyName,
  numericState,
  formatState,
  durationUntil,
  haptic,
  isUnavailable,
} from '../helpers.js';

defineEditor('custom-appliance-card-editor', [
  { name: 'name', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'power', selector: { entity: { domain: 'switch' } } },
  { name: 'operation_state', selector: { entity: { domain: 'sensor' } } },
  { name: 'program', selector: { entity: { domain: 'select' } } },
  { name: 'progress', selector: { entity: { domain: 'sensor' } } },
  { name: 'finish_time', selector: { entity: { domain: 'sensor', device_class: 'timestamp' } } },
  { name: 'door', selector: { entity: { domain: ['sensor', 'binary_sensor'] } } },
  { name: 'remote_start', selector: { entity: { domain: 'binary_sensor' } } },
  { name: 'start_button', selector: { entity: { domain: 'button' } } },
  { name: 'stop_button', selector: { entity: { domain: 'button' } } },
  { name: 'pause_button', selector: { entity: { domain: 'button' } } },
  { name: 'resume_button', selector: { entity: { domain: 'button' } } },
  { name: 'options', selector: { entity: { domain: 'switch', multiple: true } } },
]);

const STATE_META: Record<string, { icon: string; color: string; active?: boolean }> = {
  inactive: { icon: 'mdi:power-sleep', color: 'var(--secondary-text-color)' },
  ready: { icon: 'mdi:check-circle-outline', color: 'var(--success-color, #4caf50)' },
  delayedstart: { icon: 'mdi:timer-sand', color: 'var(--info-color, #2196f3)', active: true },
  run: { icon: 'mdi:play-circle', color: 'var(--cc-accent)', active: true },
  pause: { icon: 'mdi:pause-circle', color: 'var(--warning-color, #ff9800)', active: true },
  actionrequired: { icon: 'mdi:hand-back-left', color: 'var(--warning-color, #ff9800)' },
  finished: { icon: 'mdi:check-decagram', color: 'var(--success-color, #4caf50)' },
  error: { icon: 'mdi:alert-circle', color: 'var(--error-color, #f44336)' },
  aborting: { icon: 'mdi:stop-circle', color: 'var(--error-color, #f44336)', active: true },
};

/** "dishcare_dishwasher_program_eco_50" → "Eco 50" */
function prettyProgram(raw: string, labels?: Record<string, string>): string {
  if (labels?.[raw]) return labels[raw];
  const tail = raw.includes('program_') ? raw.split('program_').pop()! : raw;
  return tail.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export class ApplianceCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: ApplianceCardConfig;
  private _tick?: number;

  static styles = [
    sharedStyles,
    css`
      .icon-bubble.active {
        background: color-mix(in srgb, var(--state-color) 18%, transparent);
        color: var(--state-color);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
      }
      .status ha-icon {
        --mdc-icon-size: 18px;
        color: var(--state-color);
      }
      .status .eta {
        margin-left: auto;
        color: var(--secondary-text-color);
        font-size: 0.78rem;
        white-space: nowrap;
      }
      .progress {
        height: 6px;
        border-radius: 3px;
        background: var(--cc-muted-bg);
        overflow: hidden;
      }
      .progress div {
        height: 100%;
        background: var(--state-color);
        border-radius: 3px;
        transition: width 0.6s;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .row .label {
        font-size: 0.78rem;
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }
      select {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: 0.85rem;
        padding: 8px 32px 8px 12px;
        border-radius: var(--cc-radius);
        border: none;
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        appearance: none;
        -webkit-appearance: none;
        background-image:
          linear-gradient(45deg, transparent 50%, currentColor 50%),
          linear-gradient(135deg, currentColor 50%, transparent 50%);
        background-position:
          calc(100% - 18px) 50%,
          calc(100% - 13px) 50%;
        background-size: 5px 5px;
        background-repeat: no-repeat;
        cursor: pointer;
      }
      select:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .options {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .actions button {
        flex: 1;
        border: none;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 500;
        padding: 10px 12px;
        border-radius: var(--cc-radius);
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.15s;
      }
      .actions button.primary {
        background: var(--cc-accent);
        color: var(--cc-on-accent);
      }
      .actions button.danger {
        color: var(--error-color, #f44336);
      }
      .actions button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .actions button ha-icon {
        --mdc-icon-size: 18px;
      }
      .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 0.72rem;
        color: var(--secondary-text-color);
      }
      .chips span {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--cc-muted-bg);
      }
      .chips span.warn {
        color: var(--warning-color, #ff9800);
      }
      .chips ha-icon {
        --mdc-icon-size: 14px;
      }
      @container card (max-width: 300px) {
        .row {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
        }
        .actions {
          flex-wrap: wrap;
        }
      }
    `,
  ];

  setConfig(config: ApplianceCardConfig) {
    if (!config.power && !config.operation_state && !config.program) {
      throw new Error("appliance-card: configure at least 'power', 'operation_state' or 'program'");
    }
    this._config = config;
  }

  static getConfigElement() {
    return document.createElement('custom-appliance-card-editor');
  }

  static getStubConfig(): Omit<ApplianceCardConfig, 'type'> {
    return {
      name: 'Dishwasher',
      icon: 'mdi:dishwasher',
      power: 'switch.dishwasher_power',
      operation_state: 'sensor.dishwasher_operation_state',
    };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  connectedCallback() {
    super.connectedCallback();
    // Refresh the ETA countdown once a minute
    this._tick = window.setInterval(() => this.requestUpdate(), 60_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this._tick);
  }

  private _toggle(entityId: string) {
    haptic(this);
    const [domain] = entityId.split('.');
    this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  private _press(entityId: string) {
    haptic(this, 'medium');
    this.hass.callService('button', 'press', { entity_id: entityId });
  }

  /** "Lavavajillas Extra seco" → "Extra seco" (strips the card name or its first word) */
  private _optionLabel(id: string, cardName: string): string {
    const raw = friendlyName(this.hass, id);
    const first = cardName.split(/\s+/)[0];
    for (const prefix of [cardName, first]) {
      if (prefix && raw.toLowerCase().startsWith(prefix.toLowerCase())) {
        return raw.slice(prefix.length).trim() || raw;
      }
    }
    return raw;
  }

  private _selectProgram(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    if (!this._config.program) return;
    this.hass.callService('select', 'select_option', {
      entity_id: this._config.program,
      option: value,
    });
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const power = c.power ? s[c.power] : undefined;
    const isOn = power ? power.state === 'on' : true;
    const opState = c.operation_state ? s[c.operation_state] : undefined;
    const opKey = opState?.state ?? (isOn ? 'ready' : 'inactive');
    const meta = STATE_META[opKey] ?? {
      icon: 'mdi:help-circle-outline',
      color: 'var(--secondary-text-color)',
    };
    const running = !!meta.active;
    const progress = numericState(this.hass, c.progress);
    const finishIso = c.finish_time ? s[c.finish_time]?.state : undefined;
    const eta =
      finishIso && finishIso !== 'unavailable' && finishIso !== 'unknown'
        ? durationUntil(finishIso)
        : '';
    const program = c.program ? s[c.program] : undefined;
    const programOptions = (program?.attributes['options'] as string[] | undefined) ?? [];
    const activeProgram = c.active_program ? s[c.active_program] : undefined;
    const door = c.door ? s[c.door] : undefined;
    const doorOpen = door ? door.state === 'open' || door.state === 'on' : false;
    const remoteStart = c.remote_start ? s[c.remote_start] : undefined;
    const remoteOk = remoteStart ? remoteStart.state === 'on' : true;
    const name = c.name ?? friendlyName(this.hass, c.power ?? c.operation_state ?? c.program);
    const unavailable = power ? isUnavailable(power) : opState ? isUnavailable(opState) : false;
    const stateLabel = unavailable
      ? 'Unavailable'
      : opState
        ? formatState(this.hass, opState)
        : isOn
          ? 'On'
          : 'Off';
    const canAct = isOn && !unavailable;
    const options = (c.options ?? []).filter((id) => s[id] && !isUnavailable(s[id]));

    return html`
      <ha-card style="--state-color:${meta.color}">
        <div class="header">
          <div
            class="icon-bubble ${isOn && !unavailable ? 'active' : ''}"
            @click=${() => c.power && fireMoreInfo(this, c.power)}
          >
            <ha-icon icon=${c.icon ?? 'mdi:washing-machine'}></ha-icon>
          </div>
          <div style="flex:1;min-width:0">
            <div class="title">${name}</div>
            <div class="subtitle">
              ${
                running && activeProgram && !isUnavailable(activeProgram)
                  ? prettyProgram(activeProgram.state, c.program_labels)
                  : running && program
                    ? prettyProgram(program.state, c.program_labels)
                    : stateLabel
              }
            </div>
          </div>
          ${
            power
              ? html`<div
                  class="toggle ${isOn ? 'on' : ''}"
                  role="switch"
                  aria-checked=${isOn}
                  @click=${() => this._toggle(c.power!)}
                >
                  <div class="knob"></div>
                </div>`
              : nothing
          }
        </div>

        ${
          opState || door || remoteStart
            ? html`<div class="status">
                <ha-icon icon=${meta.icon}></ha-icon>
                <span>${stateLabel}</span>
                ${eta ? html`<span class="eta">${eta} left</span>` : progress != null && running ? html`<span class="eta">${Math.round(progress)}%</span>` : nothing}
              </div>`
            : nothing
        }
        ${running && progress != null ? html`<div class="progress"><div style="width:${Math.min(100, progress)}%"></div></div>` : nothing}
        ${
          door || (remoteStart && !remoteOk)
            ? html`<div class="chips">
                ${door ? html`<span class=${doorOpen ? 'warn' : ''}><ha-icon icon=${doorOpen ? 'mdi:door-open' : 'mdi:door-closed'}></ha-icon>Door ${doorOpen ? 'open' : 'closed'}</span>` : nothing}
                ${remoteStart && !remoteOk ? html`<span class="warn"><ha-icon icon="mdi:remote-off"></ha-icon>Remote start off</span>` : nothing}
              </div>`
            : nothing
        }
        ${
          program && programOptions.length
            ? html`<div class="row">
                <span class="label">Program</span>
                <select ?disabled=${!canAct || running} @change=${this._selectProgram}>
                  ${programOptions.map(
                    (o) =>
                      html`<option value=${o} ?selected=${o === program.state}>
                        ${prettyProgram(o, c.program_labels)}
                      </option>`,
                  )}
                </select>
              </div>`
            : nothing
        }
        ${
          options.length
            ? html`<div class="options">
                ${options.map((id) => {
                  const e = s[id];
                  const on = e.state === 'on';
                  return html`<button
                    class="pill ${on ? 'active' : ''}"
                    ?disabled=${!canAct}
                    @click=${() => this._toggle(id)}
                  >
                    <ha-icon icon=${on ? 'mdi:check' : 'mdi:plus'}></ha-icon
                    >${this._optionLabel(id, name)}
                  </button>`;
                })}
              </div>`
            : nothing
        }
        ${
          c.start_button || c.stop_button || c.pause_button || c.resume_button
            ? html`<div class="actions">
                ${
                  c.start_button && !running
                    ? html`<button
                        class="primary"
                        ?disabled=${!canAct || !remoteOk}
                        @click=${() => this._press(c.start_button!)}
                      >
                        <ha-icon icon="mdi:play"></ha-icon>Start
                      </button>`
                    : nothing
                }
                ${
                  c.pause_button && opKey === 'run'
                    ? html`<button
                        ?disabled=${!canAct}
                        @click=${() => this._press(c.pause_button!)}
                      >
                        <ha-icon icon="mdi:pause"></ha-icon>Pause
                      </button>`
                    : nothing
                }
                ${
                  c.resume_button && opKey === 'pause'
                    ? html`<button
                        class="primary"
                        ?disabled=${!canAct}
                        @click=${() => this._press(c.resume_button!)}
                      >
                        <ha-icon icon="mdi:play"></ha-icon>Resume
                      </button>`
                    : nothing
                }
                ${
                  c.stop_button && running
                    ? html`<button
                        class="danger"
                        ?disabled=${!canAct}
                        @click=${() => this._press(c.stop_button!)}
                      >
                        <ha-icon icon="mdi:stop"></ha-icon>Stop
                      </button>`
                    : nothing
                }
              </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-appliance-card', ApplianceCard);
