# Virtual Embedded Lab - TODO

Updated on 2026-07-22.

## Current status

The project has a testable foundation and a functional web prototype. It is not a complete electronics simulator yet, but it already runs WASM firmware, multi-board projects, sensors/ADCs, Wi-Fi, virtual HTTP, virtual/real MQTT, and the water-pump/reservoir scenario in the browser.

Run locally:

```bash
npm run dev
```

Validate:

```bash
npm test
```

## Done

### Project foundation

- [x] Local Git repository initialized.
- [x] `package.json` created with `dev`, `test`, and `check` scripts.
- [x] Initial monorepo structure created in `apps/`, `packages/`, `components/`, `schemas/`, `examples/`, `docs/`, and `tests/`.
- [x] Tests use the native Node.js 24 runner with `--experimental-transform-types`.
- [x] Documentation updated in `README.md`, `docs/architecture.md`, `docs/roadmap.md`, and `docs/ui-decisions.md`.
- [x] Original requirements document preserved in `docs/virtual-embedded-lab.md`.

### Schemas, catalog, and examples

- [x] `schemas/project.schema.json` created.
- [x] `schemas/component.schema.json` created.
- [x] Core TypeScript types created in `packages/project-model/src/types.ts`.
- [x] `Project JSON` represents components, positions, properties, electrical connections, environment connections, wire colors, and code.
- [x] Official components are the source of truth in `components/official/**/component.json`.
- [x] Frontend loads the official catalog through `GET /api/components`.
- [x] Examples are loaded from `examples/**/project.json` through `GET /api/examples` and `GET /api/examples/:id`.
- [x] `examples/hc-sr04-led-distance/project.json` contains board, connections, wire colors, and `main.ino`.
- [x] `examples/esp32-counter-blink/project.json` validates WASM firmware with persistent variables, increment, and `% 10`.
- [x] `examples/esp32-wifi-failover/project.json` validates multiple Wi-Fi networks, RSSI per SSID, and failover by active internet.
- [x] Multi-board examples keep firmware separated by microcontroller.
- [x] `examples/esp-water-control-pump-reservoir/project.json` validates ESP32 sender, ESP8266 asker, real MQTT, SSR, pump, and reservoir.

### Current official components

- [x] Arduino UNO expanded with D0-D13, A0-A5, VIN, 3V3, 5V, and GNDs.
- [x] Arduino UNO with built-in `L` LED associated with D13/`LED_BUILTIN`.
- [x] Resistor with resistance variants.
- [x] Capacitor with capacitance variants.
- [x] Red, green, and blue LEDs in `Electronic/LEDs`.
- [x] HC-SR04.
- [x] Distance environment control.
- [x] Wi-Fi environment control with SSID, active internet, and signal strength.
- [x] ESP32 DevKitC V4 with official J2/J3 header pins.
- [x] ESP32 DevKitC V4 with `PWR` LED and programmable `LD` LED associated with GPIO2.
- [x] ESP8266 NodeMCU.
- [x] Pull-up Button.
- [x] Water Pump.
- [x] 1-Channel Solid State Relay.
- [x] Water Reservoir.

### Simulation core

- [x] `VirtualClock`.
- [x] Deterministic `EventScheduler`.
- [x] Absolute and relative scheduling.
- [x] Event cancellation.
- [x] Execution ordered by time and insertion order.
- [x] `EnvironmentEngine` with environment channels and snapshots.
- [x] `Hcsr04Behavior` integrated with TRIG/ECHO.

### Arduino runtime and firmware

- [x] `pinMode`, `digitalWrite`, `digitalRead`, and `driveInput`.
- [x] `millis`, `micros`, `delay`, `delayMicroseconds`, and `pulseIn`.
- [x] `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.write`, `Serial.available`, and `Serial.read`.
- [x] Serial log split between `TX` and `RX`.
- [x] Initial support for `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)`, and `WiFi.internetAvailable`.
- [x] Classic built-in LED blink support with continuous `loop()` execution until Pause/Reset and a `digitalWrite` timeline.
- [x] Firmware engine through custom IR.
- [x] Clang integrated in the local server for real syntax diagnostics.
- [x] Clang-derived AST/IR used as the firmware-engine frontend.
- [x] Experimental `POST /api/firmware/compile-wasm` endpoint to compile freestanding C/C++ firmware to WASM on the server.
- [x] Local `clang++` and `wasm-ld` dependency documented for WASM firmware execution.
- [x] WASM firmware instantiated in browser/Node with imports connected to `ArduinoRuntime`.
- [x] Persistent WASM session between Run frames, preserving C/C++ globals such as `counter`.
- [x] WASM firmware exports pin constants and runs the HC-SR04 example with `pulseIn` connected to the distance control.
- [x] Web UI uses WASM as the only firmware execution path; WASM compilation failure blocks simulation instead of falling back to IR.
- [x] ESP32 + Wi-Fi Signal example compiles and runs through WASM.
- [x] ESP32 + multiple Wi-Fi networks chooses the strongest active-internet network through WASM.
- [x] `WiFiClient` with virtual HTTP.
- [x] `AsyncMqttClient` with virtual broker.
- [x] `AsyncMqttClient` with real broker through Node backend bridge.
- [x] `SimpleTimer` sufficient for MQTT keepalive/poll using virtual time.
- [x] Multi-board execution with one WASM session per microcontroller.

### Incremental electrical solver

- [x] Simple series path `GPIO HIGH -> resistor -> LED -> GND`.
- [x] LED current.
- [x] Voltage drop.
- [x] Resistor power.
- [x] Approximate brightness.
- [x] LED without effective resistor.
- [x] Overcurrent.
- [x] Exceeded power rating.
- [x] Excessive resistance with current below visible minimum.
- [x] Insufficient voltage.
- [x] Simple 5V/GND short.
- [x] LED return through any `ground` terminal, including multiple Arduino GNDs.
- [x] Electrical readings shown in the inspector.

### Web interface

- [x] Static web app in `apps/web`.
- [x] Local Node server in `apps/web/server.mjs`.
- [x] Darcula/JetBrains/IntelliJ/PhpStorm-inspired theme.
- [x] Simplified topbar with functional `Examples` button.
- [x] Examples modal loaded by API.
- [x] Palette rendered from official manifests.
- [x] Board with pan/zoom.
- [x] Components by click or drag-and-drop.
- [x] Movable board components.
- [x] Circular clickable visual terminals.
- [x] SVG wires between terminals.
- [x] Wire colors from `Project JSON` or inferred from connection type.
- [x] Orthogonal routing with route scoring.
- [x] Visual removal of wires and components.
- [x] In-memory Undo/Redo.
- [x] Save/load through `localStorage`.
- [x] JSON import/export.
- [x] Functional distance slider without moving the component.
- [x] Inspector with contextual properties and signals.
- [x] Bottom panel with Code, Console, Serial, and Problems.
- [x] CodeMirror with C++/Arduino syntax and dark theme.
- [x] Serial TX/RX with baud rate, append-only history limited to 1000 events, auto-scroll toggle, and fixed `Clear` button outside the scrollable log area.

### Tests

- [x] JSON tests for schemas, manifests, and examples.
- [x] Deterministic scheduler tests.
- [x] LED/resistor solver tests.
- [x] HC-SR04 behavior tests.
- [x] Firmware engine tests.
- [x] Clang adapter tests.
- [x] Static UI tests for main regions, components, interactions, and regressions.

## Pending

### Current limitations

- [ ] Local development still depends on installed `clang++`/`wasm-ld` or `CLANGXX`; public deployment should use sandbox/container isolation.
- [ ] The electrical solver is not a general nodal/SPICE solver yet.
- [ ] Environment connections still look like regular wires.
- [ ] Terminal type validation is still partial.
- [ ] Undo/Redo only exists during the current session.
- [ ] The signal monitor does not render a real time waveform yet.
- [ ] Real MQTT does not yet cover authentication/TLS, full QoS, persistent retained messages, or durable sessions.
- [ ] HTTP is still virtual/deterministic; real TLS/HTTPS and real DNS are outside the current MVP.
- [ ] `ESP Water Control Pump Reservoir` depends on an external backend/broker compatible with `https://github.com/mathmpr/water-control` when used in real mode.
- [ ] No multi-selection.
- [ ] No snap-to-grid.
- [ ] No Electron integration.

### Future audit - components must respect physical connections

Goal: review each component to ensure firmware behavior, visual state, and environment effects only happen when the minimum physical circuit connections exist. The first correction started with the HUB75 Snake example: the framebuffer should only accept writes when power, GND, and HUB75 signals are connected correctly.

Global physical-simulation rule:

- No active component, sensor, display, module, or actuator may work while floating.
- Every component that depends on power must validate VCC/power and GND before producing readings, writes, visual state, or environment effects.
- Every component that depends on a microcontroller must validate a real logical connection between its signal terminal and a compatible GPIO/bus.
- Bus connections must be complete: I2C requires SDA/SCL, SPI requires SCK/MISO/MOSI/CS when applicable, UART requires TX/RX according to the direction used, and parallel displays must require all minimum signals.
- If power or signals are absent, the component must become inactive/no-effect, clear or preserve a safe state when needed, and report a clear diagnostic in the Problems panel.
- Saved JSON state such as framebuffer, sensor level, or visual status must not mask an invalid circuit. During simulation, the current physical topology must take precedence over persisted visual properties.

Legend:

- `FW`: firmware can interact with it.
- `EL`: electrical model/diagnostic exists.
- `ENV`: depends on an environment/slider/virtual source.
- `VIS`: visual state changes.
- `Partial`: not a complete physical simulation.

| Component | Simulated today | Main review gap |
|---|---:|---|
| Arduino UNO | FW/EL/VIS | Does not validate memory exhaustion, hangs, real watchdog, or complete MCU internal limits. |
| Arduino Nano | FW/EL/VIS | Same limitations as Arduino UNO. |
| ESP32 DevKitC V4 | FW/EL/ENV/VIS | Wi-Fi and real board details are still abstractions. |
| ESP32-C3 DevKit | FW/EL/ENV/VIS | Generic pinout; USB/RGB/boot straps simplified. |
| ESP32-S3 DevKit | FW/EL/ENV/VIS | Generic pinout; USB, internal RGB, and real board details simplified. |
| ESP8266 NodeMCU | FW/EL/ENV/VIS | Wi-Fi and real board details abstracted. |
| BBC micro:bit V2 | FW/EL/VIS | LED matrix exposed through virtual pins; real hardware uses multiplexing. |
| Resistor | EL | Static model; no advanced tolerance/thermal behavior. |
| Capacitor | Partial EL | No real transient solver. |
| Red/green/blue/yellow LEDs | EL/VIS | Good for simple series circuits; no real I/V curve. |
| Common-cathode RGB LED | EL/VIS | Simplified color/PWM mixing; review resistor and complete channel requirements. |
| Buzzer | FW/EL/VIS | Simplified sound and current; must block when SIG/VCC/GND are missing. |
| Servo Motor | FW/EL/VIS | Angle by virtual PWM; missing torque, mechanical load, and complete physical validation. |
| Water Pump | EL/ENV/VIS | Simplified flow; depends on system rules and complete power/load validation. |
| 5V DC Power Supply | EL | Ideal/simplified source. |
| Potentiometer 10k | FW/EL/ENV/VIS | Treated as adjustable analog source; review real divider topology. |
| Trimpot 10k | FW/EL/ENV/VIS | Same as potentiometer. |
| Analog Voltage Source | EL/ENV | Ideal source; useful for tests, not a physical component. |
| LM35 | FW/EL/ENV/VIS | Temperature becomes ideal 10 mV/°C voltage; review power and output. |
| Capacitive Soil Moisture | FW/EL/ENV/VIS | Moisture becomes ideal voltage; review power and AO. |
| LDR | FW/EL/ENV/VIS | Simplified divider/environment; review divider resistor and power. |
| Pull-up Button | FW/EL/VIS | Logical button; real bouncing not simulated. |
| Slide Switch | FW/EL/VIS | Uses simplified button/switch behavior. |
| TTP223 Touch | FW/EL/VIS | Logical touch; real capacitance not simulated. |
| PIR HC-SR501 | FW/EL/VIS | Motion directly controlled; review VCC/GND/OUT before firmware activation. |
| A3144 Hall | FW/EL/VIS | Real magnetic field not simulated; review power/pull-up. |
| Reed Switch | FW/EL/VIS | Magnetism and bouncing not simulated. |
| Tilt Switch | FW/EL/VIS | Logical tilt; bouncing not simulated. |
| SW-420 Vibration | FW/EL/VIS | Logical vibration; real noise not simulated. |
| IR Obstacle Sensor | FW/EL/VIS | Logical obstacle; real optics not simulated. |
| FC-37 Rain Sensor | FW/ENV/VIS | No complete electrical model; review VCC/GND/DO/AO. |
| HC-SR04 | FW/ENV | Must require physical power and TRIG/ECHO before generating pulses. |
| BMP280 | FW/EL/ENV/VIS | I2C + virtual climate; review power and physical bus. |
| DHT11 | FW/EL/ENV/VIS | Virtual protocol/environment; real timing and pull-up simplified. |
| DHT22 | FW/EL/ENV/VIS | Same as DHT11. |
| ADS1015 | FW/EL/ENV/VIS | Simulated I2C and channels; idealized ADC; review power and inputs. |
| ADS1115 | FW/EL/ENV/VIS | Same as ADS1015. |
| MCP3008 | FW/EL/ENV/VIS | Simulated SPI/channels; idealized ADC; review power and bus. |
| LCD 16x2 I2C | FW/EL/VIS | Logical display; review power and SDA/SCL before accepting writes. |
| 7-Segment LED Display | FW/EL/VIS | Logical segments; simplified current/multiplexing. |
| HUB75 64x32 | FW/EL/VIS | Power and minimum-signal validation started; still uses framebuffer API, not real multiplexing. |
| 74HC595 | FW/EL/VIS | Logical shift/latch; review power, OE/MR, and output connections. |
| 74AHCT245 | Partial EL | Electrical placeholder; should propagate signals, not only assist validation. |
| PC817 | EL/VIS | Educational rules; CTR, saturation, and real transients not simulated. |
| ULN2003A | EL/VIS | Driver rules; no complete inductance/flyback model. |
| ULN2803A | EL/VIS | Same as ULN2003A. |
| 1/2/4/8-channel electromechanical relays | EL/VIS | Contacts/current partially validated; coil, timing, and transients simplified. |
| 1-channel SSR | FW/EL/VIS | Review load/output blocking through complete physical connection. |
| 2/3/4-channel SSRs | EL/VIS | Electrical rules, but no dedicated firmware behavior. |
| Power MOSFET Module | EL/VIS | Simplified low-side switching; review propagation to real loads. |
| 2N7000/AO3400/FQP30N06L/IRF520/IRLZ44N MOSFETs | EL/VIS | Validates Vgs/load, but no real curve, thermal dissipation, or dynamics. |
| NPN BJTs 2N2222/2N3904/BC337/BC547/BC548/BD139/TIP41C | EL/VIS | Approximate base/load/saturation validation; review effects on loads. |
| PNP BJTs 2N3906/BC327/BD140/TIP42C/TIP125/TIP127 | EL/VIS | Simplified high-side behavior; review conduction/load consistently. |
| TIP120/TIP122 Darlington | EL/VIS | Treated in BJT family; VCE(sat) drop and current simplified. |
| AC Mains Environment | ENV/VIS | AC environment source, not a real electrical grid. |
| AC Load | ENV/VIS | Environment load for meters, not a complete electrical load. |
| ZMPT101B | FW/ENV/VIS | Virtual AC reading; no complete electrical model. |
| SCT Current Transformer | FW/ENV/VIS | Virtual current; no real burden resistor/transformer model. |
| Wi-Fi Signal | FW/ENV/VIS | Virtual network; no real RF/interference. |
| Rain Environment | ENV | Virtual rain control. |
| Light Environment | ENV | Virtual light control. |
| Climate Environment | ENV | Virtual temperature/humidity/pressure control. |
| Distance Environment | ENV | Virtual distance control. |
| Water Reservoir | ENV/VIS | Simplified volume/overflow. |

Suggested priority for hardening physical connections:

1. Displays and buses: HUB75, LCD I2C, ADS1015/ADS1115, MCP3008, 74HC595.
2. Direct-reading sensors: HC-SR04, FC-37, DHT11/DHT22, BMP280, LDR, LM35, capacitive soil sensor.
3. Actuators: buzzer, servo, pump, relays, SSRs, MOSFET module.
4. Discrete semiconductors: MOSFETs, BJTs, PC817, ULN2003A/ULN2803A.

## Priorities

### Priority 1 - Connect UI to project model

- [x] Convert board state to `Project JSON`.
- [x] Save project to `localStorage`.
- [x] Load saved project.
- [x] Export/import `.json`.
- [x] Separate electrical connections from environment connections.
- [x] Preserve wire colors.

### Priority 2 - Real nets in the editor

- [x] Create frontend net model.
- [x] Allow multiple terminals in the same net.
- [x] Merge nets when wires connect existing networks.
- [x] Remove a wire without incorrectly breaking remaining connections.
- [x] Show selected net in the inspector.
- [x] Validate incompatible terminals.

### Priority 3 - Integrate simulation core with UI

- [x] Build circuit graph from the board.
- [x] Connect visual board to `EnvironmentEngine`.
- [x] Connect visual HC-SR04 to `Hcsr04Behavior`.
- [x] Connect visual Arduino pins to `ArduinoRuntime`.
- [x] Replace hardcoded visual rules with web-kernel execution.
- [x] Update console, signals, and problems from kernel results.

### Priority 4 - Incremental electrical solver

- [x] Solve simple series paths directly from nets.
- [x] Calculate current for real LEDs present on the board.
- [x] Detect LED without resistor by topology.
- [x] Detect invalid resistor by value/power.
- [x] Detect excessive resistance.
- [x] Detect insufficient voltage and overcurrent.
- [x] Detect simple 5V/GND short.

### Priority 5 - Code editor

- [x] Replace `textarea` with CodeMirror.
- [x] Highlight Arduino/C++ syntax.
- [x] Show diagnostics in the Problems panel.
- [ ] Show inline diagnostics in CodeMirror.

### Priority 6 - Firmware engine and Clang

- [x] Implement initial IR.
- [x] Support `setup`, `loop`, constants, variables, `if`, Arduino calls, and delays.
- [x] Map calls to `ArduinoRuntime`.
- [x] Integrate Clang in the backend.
- [x] Use Clang-derived AST/IR as the real firmware-engine frontend.
- [x] Isolate deprecated JS IR from the internal execution architecture in `legacy-ir-simulation.js`.
- [x] Extend WASM imports for basic Serial/RX and Wi-Fi with multiple networks.
- [x] Pass pin/constant metadata and sensor bindings to the WASM runtime for HC-SR04.
- [x] Isolate WASM compilation in sandbox/container for public use.
- [x] Cache builds by source hash.
- [x] Evaluate WASM/browser fallback and defer it until after the public MVP.

### Priority 7 - Catalog and component expansion

- [x] Define the minimum official component contract for new sensors, actuators, and microcontrollers.
- [x] Separate visual/passive components from components with simulated behavior.
- [x] Require `electricalModel` and `behavior` when a component impacts simulation.
- [x] Add catalog tests to ensure every component with `visual.palette` appears in the UI.
- [x] Add consistency test between `visual.terminals` and manifest `terminals`.
- [x] Add support for multiple microcontrollers in the graph.
- [ ] Generalize digital/analog pin mapping by microcontroller manifest.
- [ ] Add Arduino Nano.
- [x] Add ESP32 DevKit.
- [x] Add ESP8266 NodeMCU.
- [x] Add Wi-Fi Signal environment component.
- [x] Add ESP32 + Wi-Fi Signal example.
- [x] Add ESP32 + Wi-Fi Failover example.
- [x] Add FC-37 Rain Sensor with WASM digital reading.
- [x] Add Rain Environment with ON/OFF toggle.
- [x] Add FC-37 Rain Digital example.
- [ ] Add DHT11/DHT22.
- [x] Add LDR/photoresistor.
- [x] Add Light Environment with adjustable intensity.
- [x] Add LDR Light Analog example with `analogRead(A0)` through WASM.
- [x] Add BMP280 Pressure/Temperature with simulated I2C/WASM API.
- [x] Add Climate Environment with adjustable temperature/pressure.
- [x] Add BMP280 Weather I2C example.
- [x] Add reusable Analog Voltage Source for external ADCs.
- [x] Add ADS1015 ADC with I2C/WASM reading.
- [x] Add ADS1115 ADC with I2C/WASM reading.
- [x] Add MCP3008 ADC with SPI/WASM reading.
- [ ] Add potentiometer.
- [x] Add button/push button.
- [x] Add SSR, water pump, and reservoir.
- [x] Add buzzer.
- [ ] Add servo motor.
- [ ] Add LCD 16x2/I2C display.

### Priority 8 - Desktop

- [ ] Integrate Electron.
- [ ] Define main/preload/renderer process.
- [ ] Save projects to the local filesystem.
- [ ] Package desktop build.

## MVP completion criteria

- [ ] User manually assembles the example circuit.
- [x] User saves and reopens the project.
- [x] Reference Arduino code is executed by the runtime.
- [x] HC-SR04 responds to the runtime's real pulse.
- [x] `pulseIn` measures the real ECHO pulse.
- [x] LED turns on/off as a result of code and the electrical solver.
- [x] Solver calculates current/power from real connections for a simple series circuit.
- [ ] Electrical problems are presented in an understandable way.
- [ ] Repeated executions produce deterministic results.
