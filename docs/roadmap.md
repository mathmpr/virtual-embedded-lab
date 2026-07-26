# Technical Roadmap

## Completed

### Foundation

- Project structure for app, schemas, components, examples, docs, and tests.
- Node.js 24 native test runner.
- Project and component JSON schemas.
- Official component catalog loaded by API.
- Example catalog loaded by API.

### Web editor

- Visual board with pan/zoom.
- Component palette.
- Component placement by click and drag-and-drop.
- Visual terminals and SVG wires.
- Orthogonal wire routing.
- Net model with merge/removal behavior.
- Inspector, console, serial monitor, problems panel, and CodeMirror editor.
- Import/export JSON and `localStorage` persistence.

### Catalog and examples

- Arduino UNO, ESP32, ESP8266, ESP32-C3, ESP32-S3, Arduino Nano, BBC micro:bit V2.
- Passive parts: resistors, capacitors, LEDs, RGB LED.
- Sensors: HC-SR04, FC-37, LDR, BMP280, DHT, LM35, PIR, TTP223, Hall, reed, tilt, vibration, IR obstacle, soil moisture.
- ADCs: ADS1015, ADS1115, MCP3008.
- Displays and drivers: LCD 16x2 I2C, seven-segment, HUB75, 74HC595, 74AHCT245.
- Actuators and switching: buzzer, servo, pump, relays, SSRs, MOSFETs, BJTs, PC817, ULN2003A/ULN2803A.
- Environment components: distance, rain, light, climate, Wi-Fi, analog voltage, AC mains/load, water reservoir.
- Examples covering WASM firmware, sensors, ADCs, Wi-Fi, MQTT, AC metering, HUB75 game, and maker circuits.

### Firmware and simulation

- Deterministic virtual clock and scheduler.
- Arduino-compatible runtime APIs.
- WASM firmware compilation with Clang/wasm-ld.
- WASM import bridge for GPIO, time, Serial, Wi-Fi, HTTP, MQTT, I2C/SPI subsets, and component libraries.
- In-memory compile queue with two concurrent jobs.
- Build cache by source/toolchain/sandbox hash.
- Public-deployment sandbox support.
- Incremental electrical solver and educational diagnostics.

## Next milestones

### Extensible catalog

- Reduce remaining hardcoded coupling in the core.
- Move more component-specific behavior into component packages.
- Expand manifest-driven pin/bus/electrical declarations.
- Improve documentation for component authors.

### Electrical solver

- Harden power/GND/logical-connection validation across all active components.
- Improve switch/load propagation for relays, MOSFETs, BJTs, optocouplers, and drivers.
- Add better diagnostics for incomplete buses and floating inputs.
- Consider a future nodal solver for broader circuit coverage.

### Firmware

- Expand WASM Arduino/C++ shims only when examples need them.
- Keep unsupported APIs explicit and diagnostic-driven.
- Continue isolating public compilation with sandbox, limits, and rate limiting.

### Desktop

- Evaluate Electron packaging.
- Define main/preload/renderer boundaries.
- Add local filesystem save/load.
- Package desktop builds after the web MVP stabilizes.
