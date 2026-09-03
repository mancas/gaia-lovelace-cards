import "./cards/button-card.js";
import "./cards/sensor-gauge-card.js";
import "./cards/media-player-card.js";
import "./cards/room-overview-card.js";
import "./cards/cover-card.js";
import "./cards/vacuum-card.js";
import "./cards/lock-card.js";
import "./cards/power-monitor-card.js";

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards ??= [];
window.customCards.push(
  { type: "custom-button-card", name: "Button Card", description: "Toggle lights, fans, AC, or any entity", preview: true },
  { type: "custom-sensor-gauge-card", name: "Sensor Gauge Card", description: "Circular or linear gauge for temperature, humidity, and other sensors", preview: true },
  { type: "custom-media-player-card", name: "Media Player Card", description: "Full media player controls with artwork, volume, and source selection", preview: true },
  { type: "custom-room-overview-card", name: "Room Overview Card", description: "Multi-entity room summary with lights, fans, climate, temperature, and humidity", preview: true },
  { type: "custom-cover-card", name: "Cover Card", description: "Control blinds, shutters, and garage doors with position slider", preview: true },
  { type: "custom-vacuum-card", name: "Vacuum Card", description: "Robot vacuum controls with battery, status, and action buttons", preview: true },
  { type: "custom-lock-card", name: "Lock Card", description: "Smart lock with optional unlock confirmation", preview: true },
  { type: "custom-power-monitor-card", name: "Power Monitor Card", description: "Current power consumption with optional daily and monthly energy tracking", preview: true },
);
