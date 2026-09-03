import './cards/button-card.js';
import './cards/sensor-gauge-card.js';
import './cards/media-player-card.js';
import './cards/room-overview-card.js';
import './cards/cover-card.js';
import './cards/vacuum-card.js';
import './cards/lock-card.js';
import './cards/power-monitor-card.js';
import './cards/climate-card.js';
import './cards/light-card.js';
import './cards/weather-card.js';
import './cards/air-quality-card.js';
import './cards/appliance-card.js';
import './cards/person-card.js';
import './cards/todo-card.js';
import './cards/status-card.js';
import './cards/quick-actions-card.js';

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

const DOCS = 'https://github.com/mancas/gaia-lovelace-cards';

window.customCards ??= [];
window.customCards.push(
  {
    type: 'custom-button-card',
    name: 'Button Card',
    description: 'Toggle lights, fans, AC, or any entity',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-sensor-gauge-card',
    name: 'Sensor Gauge Card',
    description: 'Circular or linear gauge for temperature, humidity, and other sensors',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-media-player-card',
    name: 'Media Player Card',
    description: 'Full media player controls with artwork, volume, and source selection',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-room-overview-card',
    name: 'Room Overview Card',
    description:
      'Multi-entity room summary with lights, switches, fans, climate, temperature, and humidity',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-cover-card',
    name: 'Cover Card',
    description: 'Control blinds, shutters, and garage doors with position slider',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-vacuum-card',
    name: 'Vacuum Card',
    description: 'Robot vacuum controls with battery, status, and action buttons',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-lock-card',
    name: 'Lock Card',
    description: 'Smart lock with optional unlock confirmation',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-power-monitor-card',
    name: 'Power Monitor Card',
    description: 'Current power consumption with optional daily and monthly energy tracking',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-climate-card',
    name: 'Climate Card',
    description: 'Hero thermostat with target stepper, HVAC mode and fan mode pills',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-light-card',
    name: 'Light Card',
    description: 'Light with brightness slider, white temperature and colour swatches',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-weather-card',
    name: 'Weather Card',
    description: 'Current conditions with daily or hourly forecast',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-air-quality-card',
    name: 'Air Quality Card',
    description:
      'CO₂, PM2.5, VOC and comfort sensors — scale, hero or tile visualisation with health colouring',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-appliance-card',
    name: 'Appliance Card',
    description: 'Home Connect style appliance: power, program, progress, options and actions',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-person-card',
    name: 'Person Card',
    description: 'Presence, phone battery, activity and location for a person',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-todo-card',
    name: 'To-do Card',
    description: 'Shopping or to-do list with inline add, check and clear',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-status-card',
    name: 'Status Card',
    description:
      'Safety and status sensors (leaks, doors, motion, batteries) with attention highlighting',
    preview: true,
    documentationURL: DOCS,
  },
  {
    type: 'custom-quick-actions-card',
    name: 'Quick Actions Card',
    description: 'Icon grid of scripts, scenes, automations and buttons with optional confirmation',
    preview: true,
    documentationURL: DOCS,
  },
);
