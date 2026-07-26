# UI Decisions

This document records the current web UI decisions for Virtual Embedded Lab.

## Visual direction

The UI follows a Darcula/JetBrains/IntelliJ/PhpStorm-inspired language:

- dark background;
- panels with strong dividers;
- IDE-like topbar;
- side tool windows;
- central board;
- bottom tab panel;
- monospaced typography for code, signals, and technical values;
- blue accents for selection/signals and green accents for execution.

The goal is to feel like a local-first technical tool, not a generic dashboard.

## Layout

The main screen is split into:

- topbar with `Examples` and simulation controls;
- categorized component palette on the left;
- visual board in the center;
- property and contextual signal inspector on the right;
- bottom panel with Code, Console, Serial, and Problems.

The bottom panel is vertically resizable through `--bottom-panel-height`. Bottom tabs switch the main view: the active tab occupies the wide area, and inactive views stay stacked in the side column.

The inspector has a single vertical scroll. Properties and the signal monitor share the same flow to keep selected-component context.

## Component catalog

The official component source of truth is `components/official/**/component.json`.

The backend exposes `GET /api/components`, reads all official manifests, and returns the catalog to the frontend. `js/components.js` does not declare components manually; it normalizes received manifests into:

- visual definitions;
- serialization maps;
- default properties;
- variants;
- palette items.

The palette has its own vertical scroll and compact cards. Components are grouped by categories such as `Boards`, `Sensors`, `Inputs`, and `Electronic`, with subcategories such as `ESP32`, `Wireless`, `Resistors`, `LEDs`, and `Capacitors`.

## Examples

Examples live in `examples/**/project.json`.

The topbar exposes only the `Examples` action, which opens a modal. The modal calls:

- `GET /api/examples` to list projects;
- `GET /api/examples/:id` to load a full project.

When an example is selected, the UI restores board, connections, wire colors, and code in CodeMirror. The default example is also loaded from real JSON, not assembled through hardcoded frontend logic.

## Editable components

Resistors declare variants in `variants.resistanceOhms`. Each variant has a numeric ohm `value` and readable `label` using `Ω`, such as `220 Ω`, `1 kΩ`, and `10 kΩ`.

Capacitors use `variants.capacitanceMicrofarads`. Values are normalized in microfarads and labels may use readable units such as `100 nF`, `10 µF`, and `4700 µF`.

Resistance, capacitance, distance, and Wi-Fi signal can be edited on the board component or in the inspector. Wi-Fi exposes SSID, active internet, and signal strength from 0 to 100%. It is standalone: it has no terminals and does not need to be wired to the ESP32.

Red, green, and blue LEDs live in `Electronic/LEDs`. Each LED has its own visual type, but all share `electricalModel.primitive = led`, allowing reuse of the same electrical rule.

ESP32 DevKitC V4 lives in `Boards/ESP32` and its manifest declares J2/J3 header pins based on Espressif documentation. D0, D1, D2, D3, CMD, and CLK remain in the catalog, but are marked as reserved for SPI flash in component behavior.

Arduino UNO has a built-in `L` indicator associated with D13/`LED_BUILTIN`. ESP32 DevKitC V4 has always-on `PWR` and programmable `LD` associated with GPIO2/`LED_BUILTIN`, a common mapping on ESP32 DevKit boards. `LED_BUILTIN` is resolved from the microcontroller manifest present in the project.

To make the classic blink example observable, Run keeps simulation active until Pause/Reset. Each frame executes `loop()` iterations, respects `delay()` through virtual time, and records timed `digitalWrite` events. The UI uses that timeline to animate built-in LEDs over a short scale, preserving final pin state at the end of each frame. If the user uses undeclared `LED_PIN` or `PIN`, firmware treats it as an alias of the current board's `LED_BUILTIN`.

## Board

The board uses a visual viewport with `overflow: hidden` and a larger inner surface.

Current decisions:

- `#board` is the visible window;
- `#boardViewport` is the transformable surface;
- components are positioned HTML in `#componentLayer`;
- wires are SVG in `#wireLayer`;
- pan uses spacebar + drag;
- zoom uses mouse wheel while preserving the point under the cursor;
- loading an example/project centers the content in the visible area.

HTML makes inputs, hover, focus, and inspector interactions simpler. SVG makes wires, hit testing, selection, and removal easier.

## Terminals and wires

Terminals are circular HTML buttons with visual type:

- `power`;
- `ground`;
- `signal`;
- `environment`.

Creation flow:

1. User clicks a terminal.
2. That terminal becomes pending.
3. User clicks another terminal.
4. An SVG wire is created between them.

Wires may receive `color` in `Project JSON`. When no explicit color exists, the UI infers:

- red for `power`;
- white for `ground`;
- green for environment;
- blue for signals.

Wires use orthogonal segments and choose the best route among Manhattan candidates. The score considers length, number of bends, proximity to cards, and component crossings. This avoids the old fixed terminal-side exit and reduces wires hidden behind components.

## Nets

The editor derives nets from existing wires.

Current decisions:

- wires continue to exist for rendering, removal, and Undo/Redo;
- Union-Find groups connected terminals;
- export writes electrical nets to `connections`;
- environment connections are written to `environmentConnections`;
- clicking a wire selects the corresponding net in the inspector;
- removing a wire recalculates nets from remaining wires.

Current validations:

- blocks direct short between `power` and `ground`;
- allows `ENV` only when connected to signal/behavior terminals;
- does not yet validate every possible electrical conflict.

## Code editor

The editor uses CodeMirror 6 with:

- `@codemirror/lang-cpp`;
- `@codemirror/theme-one-dark`;
- local import map pointing to `node_modules`;
- a simple wrapper in `js/code-editor.js`.

When running simulation, the UI calls `POST /api/firmware/compile-wasm` to generate executable firmware. The Problems panel displays Clang, `clang-wasm`, runtime, and solver diagnostics.

Current limitation: there are no inline CodeMirror markers yet.

## Visual simulation

`js/visual-simulation.js` is a thin adapter between the UI and the web kernel.

Today:

- the board is converted into a circuit graph;
- nets feed connectivity;
- environment controls create channels in `EnvironmentEngine`;
- sensors are bound to behaviors;
- Arduino pins are manipulated by `ArduinoRuntime`;
- firmware is executed as WASM compiled through `clang++`/`wasm-ld`;
- results update LEDs, signals, Serial, Console, and Problems.

Simulation no longer depends on example-specific hardcoded visual rules and does not use visual fallback for IR. If WASM firmware does not compile, execution is blocked with diagnostics.

## Electrical solver

The current solver covers the simple series path:

```text
GPIO HIGH -> resistor -> LED anode -> LED cathode -> GND
```

It calculates:

- LED current;
- voltage drop;
- resistor power;
- approximate brightness;
- LED visual state.

It also diagnoses:

- LED without effective resistor;
- overcurrent;
- exceeded resistor power;
- excessive resistance below visible-current threshold;
- insufficient voltage;
- 5V/GND short;
- HIGH output connected to GND.

LED visual state is based on calculated current, not only on the existence of a connection.

Current limitation: it is not a general nodal/SPICE solver yet.

## Serial

The Arduino runtime has Serial integrated with virtual time:

- `Serial.begin`;
- `Serial.print`;
- `Serial.println`;
- `Serial.write`;
- `Serial.available`;
- `Serial.read`.

The Serial panel separates `TX` and `RX`, shows baud rate and virtual time, keeps an append-only history limited to the last 1000 events, and has a `Clear` button. `Auto-scroll` and `Clear` are placed together in a fixed footer bar, outside the scrollable log area.

Current limitation: Serial is still a simple text buffer. There is no bit timing, UART framing, parity, stop bits, or physical RX/TX component.

## Wi-Fi

The Wi-Fi Signal environment component represents a wireless network in the scenario. A project may include multiple Wi-Fi Signal components, each with SSID, active-internet checkbox, and signal-strength slider.

The runtime interprets initial ESP32/Arduino Core calls:

- `WiFi.mode`;
- `WiFi.begin`;
- `WiFi.status`;
- `WiFi.softAP`;
- `WiFi.scanNetworks`;
- `WiFi.RSSI`;
- `WiFi.RSSI(ssid)`;
- `WiFi.internetAvailable`.

In station mode, `WiFi.begin` connects when a Wi-Fi Signal has matching SSID and strength above zero. `WiFi.RSSI(ssid)` allows comparing networks before connecting. The active-internet checkbox does not change RSSI or access-point association; it represents whether the connected network would have internet access and is read by `WiFi.internetAvailable()`. In access-point mode, `WiFi.softAP` registers the virtual AP in the runtime snapshot.

Current networking: `WiFiClient` exposes a virtual TCP/HTTP model sufficient for textual requests and project-declared routes; `AsyncMqttClient` can use a virtual broker or a real MQTT broker through the Node backend bridge. There is no full TCP/IP stack, real DNS, cryptographic TLS/HTTPS, MQTT authentication, full QoS, or arbitrary browser/WASM sockets yet.

## Signal monitor

The signal monitor lives in the inspector and depends on the selected component:

- Arduino shows Ultrasonic and LED cards;
- HC-SR04 shows TRIG/ECHO;
- LED shows ON/OFF;
- Wi-Fi Signal shows active internet and signal strength;
- other components show a message when no monitorable signals exist.

The bottom panel does not include a signal tab to avoid mixing global signals with local properties.

## Persistence

The UI supports:

- save to `localStorage`;
- load from `localStorage`;
- export `.json`;
- import `.json`;
- in-memory Undo/Redo.

`Project JSON` preserves components, positions, properties, connections, wire colors, and code.

## Known limitations

- Environment connections still look like regular wires.
- Nets are not edited as first-class entities yet.
- Electrical validation is still partial.
- No multi-selection.
- No snap-to-grid.
- Undo/Redo does not persist across sessions.
- No Electron integration.
- No real temporal waveform in the signal monitor.
