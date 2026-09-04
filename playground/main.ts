import '../src/index.js';
import type { HomeAssistant, HassEntity } from '../src/types.js';

/* ------------------------------------------------------------------ */
/*  HA custom element stubs                                            */
/* ------------------------------------------------------------------ */

if (!customElements.get('ha-card')) {
  class HaCard extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const s = this.attachShadow({ mode: 'open' });
      s.innerHTML = `
        <style>
          :host {
            display: block;
            background: var(--card-background-color, #1e293b);
            border-radius: var(--ha-card-border-radius, 12px);
            box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.4));
            overflow: hidden;
          }
        </style>
        <slot></slot>
      `;
    }
  }
  customElements.define('ha-card', HaCard);
}

if (!customElements.get('ha-icon')) {
  class HaIcon extends HTMLElement {
    static get observedAttributes() {
      return ['icon'];
    }
    connectedCallback() {
      this._render();
    }
    attributeChangedCallback() {
      this._render();
    }
    _render() {
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      const icon = this.getAttribute('icon') ?? '';
      shadow.innerHTML = `
        <style>
          :host {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: var(--mdc-icon-size, 24px);
            height: var(--mdc-icon-size, 24px);
            color: inherit;
            flex-shrink: 0;
          }
          svg { width: 100%; height: 100%; fill: currentColor; }
        </style>
        <svg viewBox="0 0 24 24" title="${icon}">
          <circle cx="12" cy="12" r="9" opacity="0.9"/>
        </svg>
      `;
    }
  }
  customElements.define('ha-icon', HaIcon);
}

if (!customElements.get('ha-icon-button')) {
  class HaIconButton extends HTMLElement {
    static get observedAttributes() {
      return ['disabled'];
    }
    connectedCallback() {
      this._render();
    }
    attributeChangedCallback() {
      this._render();
    }
    _render() {
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      const disabled = this.hasAttribute('disabled');
      shadow.innerHTML = `
        <style>
          :host {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: ${disabled ? 'not-allowed' : 'pointer'};
            opacity: ${disabled ? 0.4 : 1};
            transition: background 0.15s;
          }
          :host(:hover) { background: rgba(128,128,128,0.15); }
        </style>
        <slot></slot>
      `;
    }
  }
  customElements.define('ha-icon-button', HaIconButton);
}

/* ------------------------------------------------------------------ */
/*  Mock HomeAssistant object                                          */
/* ------------------------------------------------------------------ */

function entity(
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  const now = new Date().toISOString();
  return { entity_id, state, attributes, last_changed: now, last_updated: now };
}

const mockHass: HomeAssistant = {
  states: {
    'light.living_room': entity('light.living_room', 'on', {
      friendly_name: 'Living Room',
      brightness: 180,
      color_temp: 3500,
      hs_color: [30, 80],
      supported_color_modes: ['color_temp', 'hs'],
    }),
    'sensor.living_room_temperature': entity('sensor.living_room_temperature', '22.5', {
      friendly_name: 'Temperature',
      unit_of_measurement: '°C',
    }),
    'sensor.living_room_humidity': entity('sensor.living_room_humidity', '55', {
      friendly_name: 'Humidity',
      unit_of_measurement: '%',
    }),
    'fan.living_room': entity('fan.living_room', 'on', {
      friendly_name: 'Ceiling Fan',
      percentage: 50,
    }),
    'climate.living_room': entity('climate.living_room', 'cool', {
      friendly_name: 'Air Conditioning',
      current_temperature: 23.5,
      temperature: 22,
      hvac_modes: ['off', 'cool', 'heat', 'auto', 'fan_only'],
      fan_modes: ['auto', 'low', 'medium', 'high'],
      fan_mode: 'auto',
      target_temp_step: 0.5,
    }),
    'media_player.living_room': entity('media_player.living_room', 'playing', {
      friendly_name: 'Living Room TV',
      media_title: 'Bohemian Rhapsody',
      media_artist: 'Queen',
      volume_level: 0.4,
      source: 'Spotify',
      source_list: ['Spotify', 'Netflix', 'HDMI 1', 'HDMI 2'],
    }),
    'cover.living_room_blinds': entity('cover.living_room_blinds', 'open', {
      friendly_name: 'Living Room Blinds',
      current_position: 75,
    }),
    'vacuum.robot': entity('vacuum.robot', 'docked', {
      friendly_name: 'Robot Vacuum',
      battery_level: 85,
      status: 'Docked',
    }),
    'lock.front_door': entity('lock.front_door', 'locked', {
      friendly_name: 'Front Door',
    }),
    'sensor.socket_power': entity('sensor.socket_power', '45.3', {
      friendly_name: 'Socket Power',
      unit_of_measurement: 'W',
    }),
    'weather.home': entity('weather.home', 'sunny', {
      friendly_name: 'Home',
      temperature: 24,
      temperature_unit: '°C',
      humidity: 60,
      wind_speed: 12,
      wind_speed_unit: 'km/h',
      pressure: 1013,
      pressure_unit: 'hPa',
      apparent_temperature: 26,
    }),
    'sensor.co2': entity('sensor.co2', '650', {
      friendly_name: 'CO₂',
      unit_of_measurement: 'ppm',
    }),
    'sensor.pm25': entity('sensor.pm25', '12', {
      friendly_name: 'PM2.5',
      unit_of_measurement: 'μg/m³',
    }),
    'sensor.voc': entity('sensor.voc', '0.4', {
      friendly_name: 'VOC',
      unit_of_measurement: 'mg/m³',
    }),
    'sensor.quality': entity('sensor.quality', 'Good', {
      friendly_name: 'Air Quality',
    }),
    'switch.dishwasher_power': entity('switch.dishwasher_power', 'on', {
      friendly_name: 'Dishwasher Power',
    }),
    'sensor.dishwasher_operation_state': entity('sensor.dishwasher_operation_state', 'run', {
      friendly_name: 'Dishwasher State',
    }),
    'sensor.dishwasher_progress': entity('sensor.dishwasher_progress', '68', {
      friendly_name: 'Progress',
      unit_of_measurement: '%',
    }),
    'person.me': entity('person.me', 'home', {
      friendly_name: 'Alex',
    }),
    'sensor.phone_battery': entity('sensor.phone_battery', '72', {
      friendly_name: 'Phone Battery',
      unit_of_measurement: '%',
    }),
    'sensor.phone_battery_state': entity('sensor.phone_battery_state', 'not_charging', {
      friendly_name: 'Battery State',
    }),
    'sensor.activity': entity('sensor.activity', 'Walking', {
      friendly_name: 'Activity',
    }),
    'sensor.steps': entity('sensor.steps', '4823', {
      friendly_name: 'Steps',
    }),
    'todo.shopping_list': entity('todo.shopping_list', '2', {
      friendly_name: 'Shopping List',
    }),
    'binary_sensor.water_leak': entity('binary_sensor.water_leak', 'off', {
      friendly_name: 'Kitchen Leak',
      device_class: 'moisture',
    }),
    'binary_sensor.front_door': entity('binary_sensor.front_door', 'off', {
      friendly_name: 'Front Door',
      device_class: 'door',
    }),
    'sensor.battery_level': entity('sensor.battery_level', '87', {
      friendly_name: 'Sensor Battery',
      unit_of_measurement: '%',
    }),
    'script.good_night': entity('script.good_night', 'off', {
      friendly_name: 'Good Night',
    }),
    'script.good_morning': entity('script.good_morning', 'off', {
      friendly_name: 'Good Morning',
    }),
    'scene.movie_time': entity('scene.movie_time', 'scening', {
      friendly_name: 'Movie Time',
    }),
    'automation.away_mode': entity('automation.away_mode', 'on', {
      friendly_name: 'Away Mode',
    }),
    'sun.sun': entity('sun.sun', 'above_horizon', {
      elevation: 35,
      azimuth: 180,
    }),
  },

  callService: async (domain, service, data) => {
    console.log(`[playground] ${domain}.${service}`, data);
  },

  formatEntityState: (e) => e.state,

  callWS: async <T = unknown>(msg: Record<string, unknown>): Promise<T> => {
    if (msg['type'] === 'todo/item/list') {
      return {
        items: [
          { uid: '1', summary: 'Milk', status: 'needs_action' },
          { uid: '2', summary: 'Sourdough bread', status: 'needs_action' },
          { uid: '3', summary: 'Orange juice', status: 'needs_action' },
          { uid: '4', summary: 'Eggs', status: 'completed' },
        ],
      } as unknown as T;
    }
    return {} as unknown as T;
  },

  connection: {
    subscribeMessage: async <T = unknown>(
      callback: (msg: T) => void,
      msg: Record<string, unknown>,
    ): Promise<() => Promise<void>> => {
      if (msg['type'] === 'weather/subscribe_forecast') {
        const today = new Date();
        setTimeout(() => {
          const conditions = ['sunny', 'partlycloudy', 'cloudy', 'rainy', 'sunny'];
          const temps = [24, 21, 19, 17, 23];
          callback({
            forecast: [0, 1, 2, 3, 4].map((i) => {
              const d = new Date(today);
              d.setDate(d.getDate() + i);
              return {
                datetime: d.toISOString(),
                temperature: temps[i],
                templow: temps[i] - 7,
                condition: conditions[i],
                precipitation_probability: [5, 15, 35, 70, 10][i],
              };
            }),
          } as unknown as T);
        }, 0);
      }
      return async () => {};
    },
  },

  language: 'en',
  locale: { language: 'en' },
};

/* ------------------------------------------------------------------ */
/*  Card definitions                                                   */
/* ------------------------------------------------------------------ */

interface CardDef {
  tag: string;
  label: string;
  config: Record<string, unknown>;
}

interface Section {
  title: string;
  wide?: boolean;
  cards: CardDef[];
}

const sections: Section[] = [
  {
    title: 'Climate & Environment',
    cards: [
      {
        tag: 'custom-weather-card',
        label: 'custom-weather-card',
        config: {
          entity: 'weather.home',
          name: 'Home',
          forecast: 'daily',
          forecast_items: 5,
          show_details: true,
        },
      },
      {
        tag: 'custom-climate-card',
        label: 'custom-climate-card',
        config: {
          entity: 'climate.living_room',
          name: 'Air Conditioning',
          show_modes: true,
          show_fan_modes: true,
        },
      },
      {
        tag: 'custom-air-quality-card',
        label: 'custom-air-quality-card — scale style',
        config: {
          name: 'Air Quality · Living Room',
          style: 'scale',
          quality: 'sensor.quality',
          co2: 'sensor.co2',
          pm25: 'sensor.pm25',
          voc: 'sensor.voc',
        },
      },
      {
        tag: 'custom-air-quality-card',
        label: 'custom-air-quality-card — hero style',
        config: {
          name: 'Air Quality · Living Room',
          style: 'hero',
          quality: 'sensor.quality',
          co2: 'sensor.co2',
          pm25: 'sensor.pm25',
        },
      },
      {
        tag: 'custom-sensor-gauge-card',
        label: 'custom-sensor-gauge-card — circular',
        config: {
          entity: 'sensor.living_room_temperature',
          name: 'Temperature',
          unit: '°C',
          min: 10,
          max: 40,
          style: 'circular',
          thresholds: [
            { value: 10, color: '#89b4fa' },
            { value: 20, color: '#a6e3a1' },
            { value: 26, color: '#f9e2af' },
            { value: 29, color: '#f38ba8' },
          ],
        },
      },
      {
        tag: 'custom-sensor-gauge-card',
        label: 'custom-sensor-gauge-card — linear',
        config: {
          entity: 'sensor.living_room_humidity',
          name: 'Humidity',
          unit: '%',
          min: 0,
          max: 100,
          style: 'linear',
          thresholds: [
            { value: 0, color: '#f9e2af' },
            { value: 35, color: '#a6e3a1' },
            { value: 65, color: '#89b4fa' },
          ],
        },
      },
    ],
  },
  {
    title: 'Lighting & Controls',
    cards: [
      {
        tag: 'custom-light-card',
        label: 'custom-light-card',
        config: {
          entity: 'light.living_room',
          name: 'Living Room',
          show_brightness: true,
          show_color_temp: true,
          show_color: true,
        },
      },
      {
        tag: 'custom-button-card',
        label: 'custom-button-card — on',
        config: { entity: 'light.living_room', name: 'Living Room', show_state: true },
      },
      {
        tag: 'custom-cover-card',
        label: 'custom-cover-card',
        config: { entity: 'cover.living_room_blinds', name: 'Blinds', show_position: true },
      },
      {
        tag: 'custom-lock-card',
        label: 'custom-lock-card — locked',
        config: { entity: 'lock.front_door', name: 'Front Door', require_confirm: true },
      },
      {
        tag: 'custom-vacuum-card',
        label: 'custom-vacuum-card',
        config: { entity: 'vacuum.robot', name: 'Robot Vacuum' },
      },
    ],
  },
  {
    title: 'Media & Entertainment',
    cards: [
      {
        tag: 'custom-media-player-card',
        label: 'custom-media-player-card',
        config: {
          entity: 'media_player.living_room',
          name: 'Living Room TV',
          show_volume: true,
          show_source: true,
          artwork: 'none',
        },
      },
    ],
  },
  {
    title: 'Power & Appliances',
    cards: [
      {
        tag: 'custom-power-monitor-card',
        label: 'custom-power-monitor-card',
        config: {
          entity: 'sensor.socket_power',
          name: 'Monitor Power',
          unit: 'W',
        },
      },
      {
        tag: 'custom-appliance-card',
        label: 'custom-appliance-card',
        config: {
          name: 'Dishwasher',
          icon: 'mdi:dishwasher',
          power: 'switch.dishwasher_power',
          operation_state: 'sensor.dishwasher_operation_state',
          progress: 'sensor.dishwasher_progress',
          program_labels: {
            eco_50: 'Eco 50°',
            auto_2: 'Auto 45–65°',
            intensiv_70: 'Intensive 70°',
          },
        },
      },
    ],
  },
  {
    title: 'Home Overview',
    wide: true,
    cards: [
      {
        tag: 'custom-room-overview-card',
        label: 'custom-room-overview-card',
        config: {
          name: 'Living Room',
          icon: 'mdi:sofa',
          temperature_sensor: 'sensor.living_room_temperature',
          humidity_sensor: 'sensor.living_room_humidity',
          lights: ['light.living_room'],
          fans: ['fan.living_room'],
          climate: ['climate.living_room'],
        },
      },
      {
        tag: 'custom-person-card',
        label: 'custom-person-card',
        config: {
          entity: 'person.me',
          battery: 'sensor.phone_battery',
          battery_state: 'sensor.phone_battery_state',
          activity: 'sensor.activity',
          steps: 'sensor.steps',
        },
      },
      {
        tag: 'custom-status-card',
        label: 'custom-status-card — list',
        config: {
          name: 'Safety',
          layout: 'list',
          entities: [
            { entity: 'binary_sensor.water_leak', name: 'Kitchen Leak' },
            { entity: 'binary_sensor.front_door', name: 'Front Door', attention_state: 'on' },
            { entity: 'sensor.battery_level', name: 'Sensor Battery' },
            { entity: 'lock.front_door', name: 'Front Door Lock', attention_state: 'unlocked' },
          ],
        },
      },
      {
        tag: 'custom-quick-actions-card',
        label: 'custom-quick-actions-card',
        config: {
          name: 'Quick Actions',
          columns: 4,
          actions: [
            { entity: 'script.good_night', name: 'Good Night', icon: 'mdi:weather-night' },
            { entity: 'script.good_morning', name: 'Good Morning', icon: 'mdi:weather-sunny' },
            { entity: 'scene.movie_time', name: 'Movie Time', icon: 'mdi:movie' },
            { entity: 'automation.away_mode', name: 'Away Mode', icon: 'mdi:home-lock' },
          ],
        },
      },
      {
        tag: 'custom-todo-card',
        label: 'custom-todo-card',
        config: {
          entity: 'todo.shopping_list',
          name: 'Shopping List',
          show_completed: true,
          max_items: 8,
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Rendering                                                          */
/* ------------------------------------------------------------------ */

function createCardElement(def: CardDef): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'pg-card-wrapper';

  const label = document.createElement('div');
  label.className = 'pg-card-label';
  label.textContent = def.label;

  const card = document.createElement(def.tag) as HTMLElement & {
    setConfig(c: Record<string, unknown>): void;
    hass: HomeAssistant;
  };
  try {
    card.setConfig({ type: def.tag, ...def.config });
    card.hass = mockHass;
  } catch (err) {
    console.warn(`[playground] ${def.tag} setConfig error:`, err);
    const msg = document.createElement('div');
    msg.style.cssText =
      'padding:12px;color:#f87171;font-size:0.8rem;background:#1e293b;border-radius:8px;';
    msg.textContent = String(err);
    wrapper.appendChild(label);
    wrapper.appendChild(msg);
    return wrapper;
  }

  wrapper.appendChild(label);
  wrapper.appendChild(card);
  return wrapper;
}

const app = document.getElementById('app')!;

for (const section of sections) {
  const sectionEl = document.createElement('div');
  sectionEl.className = 'pg-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'pg-section-title';
  titleEl.textContent = section.title;

  const gridEl = document.createElement('div');
  gridEl.className = section.wide ? 'pg-grid wide' : 'pg-grid';

  for (const def of section.cards) {
    gridEl.appendChild(createCardElement(def));
  }

  sectionEl.appendChild(titleEl);
  sectionEl.appendChild(gridEl);
  app.appendChild(sectionEl);
}
