import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, TodoCardConfig, TodoItem, GridOptions } from '../types.js';
import { defineEditor, sharedStyles, fireMoreInfo, friendlyName, haptic } from '../helpers.js';

defineEditor('custom-todo-card-editor', [
  { name: 'entity', required: true, selector: { entity: { domain: 'todo' } } },
  { name: 'name', selector: { text: {} } },
  { name: 'show_completed', selector: { boolean: {} } },
  { name: 'max_items', selector: { number: { min: 1, max: 50, mode: 'box' } } },
]);

export class TodoCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: TodoCardConfig;
  @state() private _items: TodoItem[] = [];
  @state() private _draft = '';
  private _lastUpdated?: string;

  static styles = [
    sharedStyles,
    css`
      .count {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--cc-accent-soft);
        color: var(--cc-accent);
        font-weight: 500;
      }
      .add {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .add input {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: 0.88rem;
        padding: 9px 12px;
        border-radius: var(--cc-radius);
        border: none;
        background: var(--cc-muted-bg);
        color: var(--primary-text-color);
        outline: none;
      }
      .add input:focus {
        box-shadow: 0 0 0 2px var(--cc-accent-soft);
      }
      .add button {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        background: var(--cc-accent);
        color: var(--cc-on-accent);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .add button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        font-size: 0.88rem;
        cursor: pointer;
      }
      li:last-child {
        border-bottom: none;
      }
      li .check {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--secondary-text-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
          background 0.15s,
          border-color 0.15s;
      }
      li .check ha-icon {
        --mdc-icon-size: 14px;
        color: var(--cc-on-accent);
      }
      li.done .check {
        background: var(--cc-accent);
        border-color: var(--cc-accent);
      }
      li.done .text {
        text-decoration: line-through;
        color: var(--secondary-text-color);
      }
      li .text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      li .remove {
        opacity: 0;
        border: none;
        background: none;
        color: var(--secondary-text-color);
        cursor: pointer;
        padding: 0;
        display: flex;
      }
      li:hover .remove {
        opacity: 1;
      }
      li .remove ha-icon {
        --mdc-icon-size: 18px;
      }
      .empty {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        text-align: center;
        padding: 12px 0;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--secondary-text-color);
      }
      .footer button {
        border: none;
        background: none;
        color: var(--cc-accent);
        cursor: pointer;
        font: inherit;
        font-size: 0.75rem;
        padding: 0;
      }
    `,
  ];

  setConfig(config: TodoCardConfig) {
    if (!config.entity) throw new Error("todo-card: 'entity' is required");
    this._config = { show_completed: true, max_items: 12, ...config };
  }

  static getConfigElement() {
    return document.createElement('custom-todo-card-editor');
  }

  static getStubConfig(): Omit<TodoCardConfig, 'type'> {
    return { entity: 'todo.shopping_list', show_completed: true };
  }

  getCardSize() {
    return 4;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected updated(changed: PropertyValues) {
    if (!changed.has('hass') && !changed.has('_config')) return;
    const entity = this.hass?.states[this._config?.entity];
    // Refetch whenever the list entity changes (item count / last_updated)
    const stamp = entity ? `${entity.state}|${entity.last_updated}` : undefined;
    if (stamp !== this._lastUpdated) {
      this._lastUpdated = stamp;
      this._fetch();
    }
  }

  private async _fetch() {
    if (!this.hass?.callWS || !this._config) return;
    try {
      const res = await this.hass.callWS<{ items: TodoItem[] }>({
        type: 'todo/item/list',
        entity_id: this._config.entity,
      });
      this._items = res.items ?? [];
    } catch {
      /* keep previous items */
    }
  }

  private async _add() {
    const text = this._draft.trim();
    if (!text) return;
    this._draft = '';
    haptic(this, 'success');
    // optimistic
    this._items = [
      ...this._items,
      { uid: `tmp-${Date.now()}`, summary: text, status: 'needs_action' },
    ];
    await this.hass.callService('todo', 'add_item', { entity_id: this._config.entity, item: text });
    this._fetch();
  }

  private async _toggleItem(item: TodoItem) {
    haptic(this);
    const status = item.status === 'completed' ? 'needs_action' : 'completed';
    this._items = this._items.map((i) => (i.uid === item.uid ? { ...i, status } : i));
    await this.hass.callService('todo', 'update_item', {
      entity_id: this._config.entity,
      item: item.uid,
      status,
    });
    this._fetch();
  }

  private async _remove(item: TodoItem, e: Event) {
    e.stopPropagation();
    haptic(this);
    this._items = this._items.filter((i) => i.uid !== item.uid);
    await this.hass.callService('todo', 'remove_item', {
      entity_id: this._config.entity,
      item: item.uid,
    });
    this._fetch();
  }

  private async _clearCompleted() {
    haptic(this);
    await this.hass.callService('todo', 'remove_completed_items', {
      entity_id: this._config.entity,
    });
    this._fetch();
  }

  render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const name = friendlyName(this.hass, c.entity, c.name);
    const pending = this._items.filter((i) => i.status !== 'completed');
    const done = this._items.filter((i) => i.status === 'completed');
    const visible = [...pending, ...(c.show_completed ? done : [])].slice(0, c.max_items ?? 12);
    const hidden = pending.length + (c.show_completed ? done.length : 0) - visible.length;

    return html`
      <ha-card>
        <div class="header">
          <div
            class="icon-bubble ${pending.length ? 'active' : ''}"
            @click=${() => fireMoreInfo(this, c.entity)}
          >
            <ha-icon icon="mdi:cart-outline"></ha-icon>
          </div>
          <div class="title">${name}</div>
          <span class="count">${pending.length}</span>
        </div>

        <div class="add">
          <input
            type="text"
            placeholder="Add item…"
            .value=${this._draft}
            @input=${(e: Event) => (this._draft = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._add()}
          />
          <button ?disabled=${!this._draft.trim()} @click=${this._add} aria-label="Add">
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>

        ${
          visible.length
            ? html`<ul>
                ${visible.map(
                  (item) =>
                    html`<li
                      class=${item.status === 'completed' ? 'done' : ''}
                      @click=${() => this._toggleItem(item)}
                    >
                      <div class="check">
                        ${item.status === 'completed' ? html`<ha-icon icon="mdi:check"></ha-icon>` : nothing}
                      </div>
                      <span class="text">${item.summary}</span>
                      <button
                        class="remove"
                        aria-label="Remove"
                        @click=${(e: Event) => this._remove(item, e)}
                      >
                        <ha-icon icon="mdi:close"></ha-icon>
                      </button>
                    </li>`,
                )}
              </ul>`
            : html`<div class="empty">Nothing to do 🎉</div>`
        }
        ${
          hidden > 0 || done.length
            ? html`<div class="footer">
                <span>${hidden > 0 ? `+${hidden} more` : ''}</span>
                ${done.length ? html`<button @click=${this._clearCompleted}>Clear ${done.length} completed</button>` : nothing}
              </div>`
            : nothing
        }
      </ha-card>
    `;
  }
}

customElements.define('custom-todo-card', TodoCard);
