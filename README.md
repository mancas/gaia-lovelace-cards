# Custom HA Cards

Custom Home Assistant Lovelace cards built with Lit and Vite.

## Cards

| Card | Element | Purpose |
|------|---------|---------|
| Button Card | `custom-button-card` | Toggle lights, fans, AC, or any entity with state-based styling |
| Sensor Gauge Card | `custom-sensor-gauge-card` | Circular or linear gauge for temperature, humidity, and numeric sensors |
| Media Player Card | `custom-media-player-card` | Full media player controls — artwork, play/pause, volume, source selection |
| Room Overview Card | `custom-room-overview-card` | Multi-entity room summary with lights, fans, climate, and sensor pills |

## Development

```bash
npm install
npm run build          # produces dist/custom-ha-cards.js
npm run dev            # watch mode with HMR
npm run typecheck      # TypeScript type checking
```

## Installation via HACS

1. Push this repository to GitHub.
2. In Home Assistant go to **HACS → Frontend → Custom repositories**.
3. Add the repository URL and set category to **Lovelace**.
4. Install **Custom HA Cards** from HACS.
5. Add the resource in **Settings → Dashboards → Resources**:
   ```
   /hacsfiles/custom-ha-cards/custom-ha-cards.js
   ```

## Card Configuration Examples

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

### Room Overview Card
```yaml
type: custom:custom-room-overview-card
name: Living Room
temperature_sensor: sensor.living_room_temperature
humidity_sensor: sensor.living_room_humidity
lights:
  - light.ceiling
  - light.floor_lamp
fans:
  - fan.living_room
climate:
  - climate.living_room_ac
```
