export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HassArea {
  area_id: string;
  name: string;
  icon?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<void>;
  formatEntityState(entity: HassEntity): string;
  /** WebSocket request — available on the real hass object, optional here to keep tests/stubs simple */
  callWS?<T = unknown>(msg: Record<string, unknown>): Promise<T>;
  connection?: {
    subscribeMessage<T = unknown>(
      callback: (msg: T) => void,
      msg: Record<string, unknown>,
    ): Promise<() => Promise<void>>;
  };
  language?: string;
  locale?: { language: string };
  areas?: Record<string, HassArea>;
}

/** Card grid sizing hints used by HA "sections" views. */
export interface GridOptions {
  columns?: number | 'full';
  rows?: number | 'auto';
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

export interface ButtonCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  tap_action?: 'toggle' | 'more-info' | 'call-service';
  service?: string;
  service_data?: Record<string, unknown>;
  show_state?: boolean;
}

export interface SensorGaugeCardConfig {
  type: string;
  entity: string;
  name?: string;
  unit?: string;
  min?: number;
  max?: number;
  /** Thresholds for color bands: [{value: 20, color: '#4caf50'}, ...] */
  thresholds?: Array<{ value: number; color: string }>;
  style?: 'circular' | 'linear';
}

export interface MediaPlayerCardConfig {
  type: string;
  entity: string;
  name?: string;
  show_volume?: boolean;
  show_source?: boolean;
  artwork?: 'cover' | 'none';
}

export interface RoomOverviewCardConfig {
  type: string;
  name: string;
  icon?: string;
  /** Light entities. Plain `switch.*` entities wired to lamps are accepted too. */
  lights?: string[];
  /** Plugs / relays shown under their own section */
  switches?: string[];
  temperature_sensor?: string;
  humidity_sensor?: string;
  fans?: string[];
  climate?: string[];
  /** Navigate to this path when the header is tapped (e.g. "/dashboard-gaia/salon") */
  navigation_path?: string;
}

export interface CoverCardConfig {
  type: string;
  entity: string;
  name?: string;
  show_position?: boolean;
}

export interface VacuumCardConfig {
  type: string;
  entity: string;
  name?: string;
}

export interface LockCardConfig {
  type: string;
  entity: string;
  name?: string;
  require_confirm?: boolean;
}

export interface PowerMonitorCardConfig {
  type: string;
  entity: string;
  name?: string;
  unit?: string;
  daily_energy?: string;
  monthly_energy?: string;
}

export interface ClimateCardConfig {
  type: string;
  entity: string;
  name?: string;
  /** Temperature step for the +/- stepper. Defaults to the entity's `target_temp_step` or 0.5 */
  step?: number;
  show_modes?: boolean;
  show_fan_modes?: boolean;
  /** Optional room temperature/humidity sensors shown as pills in the header */
  temperature_sensor?: string;
  humidity_sensor?: string;
}

export interface LightCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  show_brightness?: boolean;
  show_color_temp?: boolean;
  show_color?: boolean;
  /** RGB presets rendered as swatches. Defaults to a small, sane palette */
  color_presets?: Array<{ name?: string; rgb: [number, number, number] }>;
}

export interface WeatherCardConfig {
  type: string;
  entity: string;
  name?: string;
  forecast?: 'daily' | 'hourly' | 'none';
  /** Number of forecast items to show (default 5) */
  forecast_items?: number;
  show_details?: boolean;
}

export interface AirQualityCardConfig {
  type: string;
  name?: string;
  /** Enum sensor with values like good/fair/moderate/poor/very_poor/extremely_poor */
  quality?: string;
  co2?: string;
  pm25?: string;
  voc?: string;
  temperature?: string;
  humidity?: string;
}

export interface ApplianceCardConfig {
  type: string;
  name?: string;
  icon?: string;
  /** switch.* — main power */
  power?: string;
  /** sensor.* enum — inactive/ready/run/pause/finished/… */
  operation_state?: string;
  /** select.* — program to run */
  program?: string;
  /** sensor.* — active program (read only) */
  active_program?: string;
  /** sensor.* percentage */
  progress?: string;
  /** sensor.* timestamp */
  finish_time?: string;
  /** sensor.* or binary_sensor.* — door state */
  door?: string;
  /** binary_sensor.* — remote start allowed */
  remote_start?: string;
  /** button.* entities */
  start_button?: string;
  stop_button?: string;
  pause_button?: string;
  resume_button?: string;
  /** switch.* — program options (extra dry, half load…) */
  options?: string[];
  /** Override the auto‑prettified program labels: { dishcare_dishwasher_program_eco_50: "Eco 50°" } */
  program_labels?: Record<string, string>;
}

export interface PersonCardConfig {
  type: string;
  entity: string;
  name?: string;
  battery?: string;
  battery_state?: string;
  activity?: string;
  location?: string;
  steps?: string;
}

export interface TodoCardConfig {
  type: string;
  entity: string;
  name?: string;
  show_completed?: boolean;
  max_items?: number;
}

export interface StatusCardEntity {
  entity: string;
  name?: string;
  icon?: string;
  /** State(s) that should be highlighted as needing attention. Auto‑derived from device_class if omitted */
  attention_state?: string | string[];
}

export interface StatusCardConfig {
  type: string;
  name?: string;
  entities: Array<string | StatusCardEntity>;
  layout?: 'list' | 'grid';
  show_last_changed?: boolean;
}

export interface QuickAction {
  entity?: string;
  name?: string;
  icon?: string;
  /** "domain.service" — defaults per domain: script/scene → turn_on, automation → trigger, button → press, switch/light/fan → toggle */
  service?: string;
  service_data?: Record<string, unknown>;
  navigation_path?: string;
  confirm?: boolean | string;
}

export interface QuickActionsCardConfig {
  type: string;
  name?: string;
  columns?: number;
  actions: QuickAction[];
}

export interface TodoItem {
  uid: string;
  summary: string;
  status: 'needs_action' | 'completed';
  due?: string;
  description?: string;
}

export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation_probability?: number;
  precipitation?: number;
  wind_speed?: number;
}

declare global {
  interface HTMLElementTagNameMap {
    'ha-form': HTMLElement & {
      hass: unknown;
      data: unknown;
      schema: unknown[];
      computeLabel?: (schema: { name: string }) => string;
    };
  }
}
