export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<void>;
  formatEntityState(entity: HassEntity): string;
}

export interface ButtonCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  tap_action?: "toggle" | "more-info" | "call-service";
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
  style?: "circular" | "linear";
}

export interface MediaPlayerCardConfig {
  type: string;
  entity: string;
  name?: string;
  show_volume?: boolean;
  show_source?: boolean;
  artwork?: "cover" | "none";
}

export interface RoomOverviewCardConfig {
  type: string;
  name: string;
  lights?: string[];
  temperature_sensor?: string;
  humidity_sensor?: string;
  fans?: string[];
  climate?: string[];
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

declare global {
  interface HTMLElementTagNameMap {
    "ha-form": HTMLElement & {
      hass: unknown;
      data: unknown;
      schema: unknown[];
      computeLabel?: (schema: { name: string }) => string;
    };
  }
}
