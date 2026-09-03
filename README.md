# Custom HA Cards

Custom Home Assistant Lovelace cards built with Lit and Vite. Every card ships with a visual editor
(`ha-form`), follows the active HA theme (light/dark, Catppuccin, …) and declares `getGridOptions()`
so it sizes itself sensibly inside **sections** views.

## Cards

| Card | Element | Purpose |
|------|---------|---------|
| Climate Card | `custom-climate-card` | Hero thermostat: big target, +/- stepper, HVAC mode and fan mode pills, mode‑tinted background |
| Light Card | `custom-light-card` | Toggle, brightness slider (debounced), white temperature swatches and colour presets |
| Weather Card | `custom-weather-card` | Current conditions + daily/hourly forecast (uses the live forecast subscription) |
| Air Quality Card | `custom-air-quality-card` | CO₂, PM2.5, VOC, temperature, humidity with health thresholds and an overall badge |
| Appliance Card | `custom-appliance-card` | Home Connect style: power, operation state, program picker, progress/ETA, options, start/stop |
| Person Card | `custom-person-card` | Presence with zone colour, phone battery, activity, steps and last known location |
| To‑do Card | `custom-todo-card` | Shopping/to‑do list: add inline, tick, remove, clear completed |
| Status Card | `custom-status-card` | Safety & status sensors (leak, door, motion, battery…) — anything needing attention is highlighted |
| Quick Actions Card | `custom-quick-actions-card` | Icon grid of scripts, scenes, automations, buttons; optional tap‑twice confirmation |
| Room Overview Card | `custom-room-overview-card` | Room summary: temperature/humidity pills, lights (or switches), plugs, fans, climate; header can navigate to the room view |
| Button Card | `custom-button-card` | Toggle lights, fans, AC, or any entity with state-based styling |
| Sensor Gauge Card | `custom-sensor-gauge-card` | Circular or linear gauge for temperature, humidity, and numeric sensors |
| Media Player Card | `custom-media-player-card` | Full media player controls — artwork, play/pause, volume, source selection |
| Cover Card | `custom-cover-card` | Blinds, shutters and garage doors with position slider |
| Vacuum Card | `custom-vacuum-card` | Robot vacuum controls with battery and status |
| Lock Card | `custom-lock-card` | Smart lock with optional unlock confirmation |
| Power Monitor Card | `custom-power-monitor-card` | Current power draw with optional daily and monthly energy |

## Responsive behaviour

Cards adapt to **their own width**, not the viewport, using CSS container queries
(`container-type: inline-size` on `ha-card`). That means the same card behaves well whether it is a
narrow 3‑column card on a desktop sections view or a full‑width card on a phone:

- ≤ 380 px: tighter padding, sensor tiles collapse to two columns, icon tiles get denser, the room
  overview drops its temperature/humidity pills under the title, the climate hero shrinks.
- ≤ 260 px: pill labels hide (icons only), sensor tiles go single column, headers wrap.
- Titles clamp to two lines instead of truncating; forecast rows scroll horizontally.

`npm run shots` renders every card at 160/240/343/520 px in headless Chromium against a mock `hass`
(`test/harness.html`) and reports any element that overflows its card — run it after style changes.

## Development

```bash
npm install
npm run build          # produces dist/custom-ha-cards.js
npm run dev            # watch mode with HMR
npm run typecheck      # TypeScript type checking
npm run format         # prettier
npm run shots          # responsive screenshots + overflow check (needs playwright + chromium)
```

Shared building blocks live in `src/helpers.ts` (`defineEditor()` for ha-form editors, `sharedStyles`
with the header / pill / toggle / tile / sensor‑tile patterns, entity and time helpers). New cards
should compose those instead of re‑inventing them so the whole dashboard reads as one system.

## Installation via HACS

1. In Home Assistant go to **HACS → Frontend → Custom repositories**.
2. Add `https://github.com/mancas/gaia-lovelace-cards` with category **Dashboard**.
3. Install **Custom HA Cards** and pick the latest release.
4. HACS registers the resource automatically:
   ```
   /hacsfiles/gaia-lovelace-cards/custom-ha-cards.js
   ```
5. Releases are built by GitHub Actions when a `v*.*.*` tag is pushed.

## Card configuration examples

### Climate Card
```yaml
type: custom:custom-climate-card
entity: climate.aire
name: Aire acondicionado
step: 0.5
show_modes: true
show_fan_modes: true
temperature_sensor: sensor.salon_temperatura
humidity_sensor: sensor.salon_humedad
```

### Light Card
```yaml
type: custom:custom-light-card
entity: light.led_sofa
show_brightness: true
show_color_temp: true
show_color: true
color_presets:            # optional, overrides the default palette
  - { name: Warm, rgb: [255, 160, 60] }
  - { name: Blue, rgb: [64, 128, 255] }
```

### Weather Card
```yaml
type: custom:custom-weather-card
entity: weather.forecast_casa
forecast: daily           # daily | hourly | none
forecast_items: 5
show_details: true
```

### Air Quality Card
```yaml
type: custom:custom-air-quality-card
name: Salón
quality: sensor.monitor_aire_calidad_del_aire
co2: sensor.monitor_aire_dioxido_de_carbono
pm25: sensor.monitor_aire_pm2_5
temperature: sensor.monitor_aire_temperatura
humidity: sensor.monitor_aire_humedad
```

### Appliance Card
```yaml
type: custom:custom-appliance-card
name: Lavavajillas
icon: mdi:dishwasher
power: switch.lavavajillas_power
operation_state: sensor.lavavajillas_operation_state
program: select.lavavajillas_selected_program
progress: sensor.lavavajillas_program_progress
finish_time: sensor.lavavajillas_program_finish_time
door: sensor.lavavajillas_door
remote_start: binary_sensor.lavavajillas_remote_start
stop_button: button.lavavajillas_stop_program
options:
  - switch.lavavajillas_half_load
  - switch.lavavajillas_extra_dry
program_labels:           # optional
  dishcare_dishwasher_program_eco_50: "Eco 50°"
```

### Person Card
```yaml
type: custom:custom-person-card
entity: person.manu
battery: sensor.phone_battery_level
battery_state: sensor.phone_battery_state
activity: sensor.phone_activity
steps: sensor.phone_steps
location: sensor.phone_geocoded_location
```

### To‑do Card
```yaml
type: custom:custom-todo-card
entity: todo.shopping_list
name: Lista de la compra
show_completed: true
max_items: 10
```

### Status Card
```yaml
type: custom:custom-status-card
name: Seguridad
layout: list              # list | grid
entities:
  - binary_sensor.sensor_humedad_cocina_water_leak
  - entity: sensor.lavavajillas_door
    name: Puerta lavavajillas
    attention_state: open
  - entity: sensor.phone_battery_level
```

### Quick Actions Card
```yaml
type: custom:custom-quick-actions-card
name: Acciones
columns: 4
actions:
  - entity: automation.luz_ambiente_entrada       # automation → trigger
  - entity: button.zigbee2mqtt_bridge_restart     # button → press
    name: Restart Z2M
    confirm: true                                 # tap twice within 3 s
  - entity: switch.zigbee2mqtt_bridge_permit_join # switch → toggle, shows active state
  - name: Salón
    icon: mdi:sofa
    navigation_path: /dashboard-gaia/salon
```

### Room Overview Card
```yaml
type: custom:custom-room-overview-card
name: Salón
icon: mdi:sofa
navigation_path: /dashboard-gaia/salon
temperature_sensor: sensor.salon_temperatura
humidity_sensor: sensor.salon_humedad
lights:                   # light.* or switch.* wired to lamps
  - light.led_sofa
  - switch.pasillo_luz
switches:
  - switch.enchufe_monitor
fans:
  - fan.dormitorio_ventilador_techo
climate:
  - climate.aire
```

### Button Card
```yaml
type: custom:custom-button-card
entity: light.living_room
name: Living Room
show_state: true
```

### Sensor Gauge Card
```yaml
type: custom:custom-sensor-gauge-card
entity: sensor.living_room_temperature
unit: "°C"
min: 0
max: 40
style: circular
thresholds:
  - value: 0
    color: "#4caf50"
  - value: 27
    color: "#ff9800"
  - value: 35
    color: "#f44336"
```

### Media Player Card
```yaml
type: custom:custom-media-player-card
entity: media_player.living_room
show_volume: true
show_source: true
artwork: cover
```

### Power Monitor Card
```yaml
type: custom:custom-power-monitor-card
entity: sensor.enchufe_monitor_potencia
daily_energy: sensor.enchufe_monitor_energia
```

## Theming hooks

All cards use HA theme variables (`--primary-color`, `--secondary-background-color`,
`--success-color`, `--warning-color`, `--error-color`, `--state-climate-*-color`,
`--state-person-*-color`). The shared layer also exposes `--cc-accent`, `--cc-muted-bg` and
`--cc-radius` which you can override per card with `card-mod` or a theme.
