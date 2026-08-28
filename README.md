# Virtual Embedded Lab

### Version: 0.1.0-alpha.1

Local-first visual environment for creating, programming, and behaviorally simulating embedded electronics projects.

The project already includes a functional web prototype with a visual board, official component catalog, CodeMirror editor, Arduino-compatible WASM firmware runtime, local Clang diagnostics, Serial TX/RX, simulated ESP32/ESP8266 Wi-Fi, analog inputs through WASM, initial I2C/SPI support for sensors and ADCs, virtual HTTP, virtual/real MQTT, an incremental electrical solver, multi-board simulation, and complete examples for HC-SR04 + LED, FC-37, LDR, BMP280, external ADCs, and water-pump control through MQTT.

The current architecture treats components as packages: each official component owns its manifest and can load CSS, simulation behavior, firmware libraries, C++ shims, and WASM imports from its own folder.

> Virtual Embedded Lab is currently in public alpha.
> Some components and embedded APIs may have partial support.

- Try online at temporary URL: https://virtual-lab.mathmpr.com;
- Report a bug into the [issue tracker](https://github.com/mathmpr/virtual-embedded-lab/issues);
- If you want to contribute, read [CONTRIBUTING.md](./CONTRIBUTING.md) and submit a pull request;
- Request a new component via issues also;
- If you can, sponsor the project through GitHub Sponsors;
- Current version is: `0.1.0-alpha.1` (pre-release);
- Questions? Send an email to `matheusprador@gmail.com`;

## Demo
[Drag and compile an existing project.webm](https://github.com/user-attachments/assets/8c7dc686-4a15-4c67-b680-6b51b9273020)

[Creating a new project and run it.webm](https://github.com/user-attachments/assets/9f4c4eae-37a2-4513-903b-f22a79902f56)
## License

This project is open source under the GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`).

In practical terms:

- You may use, study, modify, and redistribute the code.
- If you modify the project and offer that modified version as a network service, you must make the corresponding source code available to the users of that service, as required by the AGPLv3.
- The project is provided without warranties. Simulations are educational tools and do not replace physical validation, real measurements, or proper safety practices.

See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Name and visual identity

The name "Virtual Embedded Lab", the logo, visual identity, and confusingly similar marks are not granted for uses that imply that an unofficial version, fork, hosted instance, or distribution is the official project.

You may use the name for truthful attribution, reference to the original project, compatibility statements, and license compliance. When redistributing or hosting a modified version, make it clear that it is unofficial unless the maintainers explicitly authorize otherwise.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting changes.

By contributing, you agree that your contribution is distributed under the same project license: `AGPL-3.0-or-later`.

## Requirements

Required:

- Docker with Docker Compose.

Optional, depending on the scenario:

- Node.js 24 or newer for local development without containers.
- Project dependencies installed with `npm install` for local development without containers.
- `clang++` available in `PATH`, or configured through `CLANGXX`/`CLANG_PATH`, for local development without containers.
- `lld`/`wasm-ld` available in the Clang toolchain, for local development without containers.
- Docker or Podman to isolate WASM firmware compilation in public deployments.
- A network-accessible MQTT TCP broker when a project uses `network.mqtt.mode: "real"`.
- For the `ESP Water Control Pump Reservoir` example, the real flow depends on the MQTT/backend contract from the external project `https://github.com/mathmpr/water-control`.

The UI uses WASM as the only firmware execution path. Therefore, `clang++` and `wasm-ld` are required to run firmware simulations locally. Without `clang++`, the server returns `CLANG_UNAVAILABLE`. Without `wasm-ld`, the `/api/firmware/compile-wasm` job finishes with `WASM_TOOLCHAIN_UNAVAILABLE`.

For public use, do not compile firmware directly on the host without isolation. The WASM compiler supports container sandboxing with `WASM_COMPILER_SANDBOX=docker` or `WASM_COMPILER_SANDBOX=podman`. The production instance can also use an external sandbox runner through `WASM_COMPILER_SANDBOX=external`.

## Installation and configuration

### 1. Run with Docker

The web server runs from the repository root because `apps/web/server.mjs` serves files from `apps/web`, `components`, `examples`, and `node_modules`.

```bash
docker compose up --build
```

The application is available at `http://127.0.0.1:4173`.

The Docker image includes Node.js 24, `clang++`, and `wasm-ld`, so firmware analysis and WASM compilation work inside the container. Shared projects are persisted through the `shared-projects` Docker volume declared in `docker-compose.yml`.

## Local development without containers

### 1. Install Node dependencies

```bash
npm install
```

### 2. Install Clang and wasm-ld

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install clang lld
```

Fedora:

```bash
sudo dnf install clang lld
```

Arch Linux:

```bash
sudo pacman -S clang lld
```

macOS with Homebrew:

```bash
brew install llvm
```

On macOS, if the Homebrew LLVM `clang++` is not in `PATH`, configure `CLANGXX`:

```bash
export CLANGXX="$(brew --prefix llvm)/bin/clang++"
```

Windows:

- Install LLVM through the official installer or through the package manager used by your environment.
- Make sure `clang++.exe` and `wasm-ld.exe` are in `PATH`.
- Alternatively, set `CLANGXX` to the executable path.

Example:

```powershell
$env:CLANGXX="C:\Program Files\LLVM\bin\clang++.exe"
```

### 3. Validate Clang and wasm-ld

```bash
clang++ --version
wasm-ld --version
```

Or, if you use an environment variable:

```bash
$CLANGXX --version
wasm-ld --version
```

### 4. Run the project

```bash
npm ci
npm run dev
```

The application listens on `0.0.0.0:4173` by default and is available locally at `http://127.0.0.1:4173`.

### 5. Configure WASM compilation sandboxing

By default, local development calls `clang++` directly on the host. For public deployments, configure a container runtime:

```bash
export WASM_COMPILER_SANDBOX=docker
export WASM_COMPILER_IMAGE=virtual-embedded-lab-wasm-toolchain:latest
```

Podman is also supported:

```bash
export WASM_COMPILER_SANDBOX=podman
export WASM_COMPILER_IMAGE=virtual-embedded-lab-wasm-toolchain:latest
```

The container runner is called with networking disabled, CPU limits, memory limits, and process limits. Optional variables:

- `WASM_COMPILER_CONTAINER_RUNTIME`: overrides the `docker`/`podman` binary.
- `WASM_COMPILER_CPUS`: default `1`.
- `WASM_COMPILER_MEMORY`: default `256m`.
- `WASM_COMPILER_PIDS_LIMIT`: default `64`.

For hardened server deployments, the external runner mode can delegate compilation to a separate unprivileged user:

```bash
export WASM_COMPILER_SANDBOX=external
export WASM_COMPILER_SANDBOX_RUNNER=/usr/bin/sudo
export WASM_COMPILER_SANDBOX_RUNNER_ARGS='["-n","/usr/local/sbin/virtual-lab-wasm-compile"]'
```

The public server should also configure:

```bash
export MAX_FIRMWARE_SOURCE_BYTES=30720
export COMPILE_RATE_LIMIT_WINDOW_MS=60000
export COMPILE_RATE_LIMIT_MAX=8
```

## Validation

```bash
npm test
```

The tests use the native Node.js 24 runner with `--experimental-transform-types`.

## Current status

- The UI loads official components through `GET /api/components`.
- Examples live in `examples/**/project.json` and are loaded through the Examples modal.
- Official example C/C++ firmware lives in `examples/<slug>/firmware/*.ino` and is referenced by path in `project.json`; the examples API resolves those files before returning the project to the UI.
- The current default example is `examples/esp32-s3-snake-hub75/project.json`.
- WASM examples cover HC-SR04, Arduino Serial LED, Serial bridge multi-board, pull-up button, buzzer beep, BBC micro:bit V2 Heart, ESP32 AC Energy Meter POC, ESP32-S3 HUB75 Snake Game, ESP32-C3 LED Blink, ESP32 counter blink, ESP32 Wi-Fi Signal, ESP32 Wi-Fi Failover, ESP32 HTTP/TCP, ESP8266 MQTT water pump, FC-37 Rain Digital, LDR Light Analog, BMP280 Weather I2C, ADS1015/ADS1115 Single Ended, MCP3008 Single Ended, and ESP Water Control Pump Reservoir.
- Additional maker examples cover analog inputs with potentiometer/LM35/soil moisture, digital sensors with PIR, TTP223, tilt, SW-420, Hall, reed, IR obstacle sensor and slide switch, a switching gallery with BJTs, MOSFETs, relays, SSRs, PC817 and ULN drivers, and an ESP8266 example where an LDR controls an RGB LED through PWM.
- Official components live in `components/official/**/component.json`.
- Components may declare local contributions in `ui/`, `simulation/`, and `firmware/`; the core loads those files through `contributions.styles`, `contributions.simulationBehaviors`, and `contributions.wasmImports`.
- New official components must follow `docs/official-component-guidelines.md`, `docs/component-description.md`, `docs/component-contract.md`, and the template `add-components/new-component-example.md` before implementation.
- The official catalog includes Arduino UNO, Arduino Nano, BBC micro:bit V2, ESP32 DevKitC V4, ESP32-C3 DevKit, ESP32-S3 DevKit, ESP8266 NodeMCU, HC-SR04, FC-37 Rain Sensor, LDR Light Sensor, BMP280, ADS1015, ADS1115, MCP3008, ZMPT101B, SCT, LM35, PIR HC-SR501, TTP223, tilt switch, SW-420, A3144 Hall, reed switch, IR obstacle sensor, potentiometer, trimpot, capacitive soil sensor, maker BJTs, maker N-channel MOSFETs, MOSFET modules, electromechanical relays, solid-state relays, PC817, ULN2003A, ULN2803A, AC Mains Environment, AC Load, P5 RGB HUB75 64x32, 5V DC supply, 74AHCT245, pull-up button, buzzer, distance environment, Rain Environment, Light Environment, Climate Environment, Analog Voltage Source, Wi-Fi Signal, water pump, solid-state relay, water reservoir, resistors, capacitors, red/green/blue/yellow LEDs, and common-cathode RGB LED.
- Arduino UNO exposes the built-in `L` LED on D13/`LED_BUILTIN`; ESP32 DevKitC V4 exposes `PWR` and programmable `LD` on GPIO2/`LED_BUILTIN`.
- Built-in LED blink sketches run continuously until Pause/Reset, respect `delay()` through virtual time, and animate the `digitalWrite` timeline; undeclared `LED_PIN`/`PIN` identifiers are treated as aliases for `LED_BUILTIN`.
- The board supports pan/zoom, drag-and-drop, colored wires, wire/component removal, in-memory Undo/Redo, and JSON import/export.
- The bottom panel has Code, Console, Serial, and Problems tabs, with main-view switching.
- The signal monitor is attached to the inspector.
- The current solver covers simple LED/resistor series paths, current, power, overcurrent, excessive resistance, insufficient voltage, and basic shorts.
- The UI executes firmware through the WASM path; WASM compilation failures block simulation and display diagnostics, with no IR fallback.
- The JavaScript IR still exists as legacy/test code, but is deprecated as a firmware execution path, isolated in `legacy-ir-simulation.js`, and should not receive new features.
- The server has an in-memory WASM compilation queue. `POST /api/firmware/compile-wasm` creates a job and returns `202` with a `jobId`; `GET /api/firmware/compile-wasm/:jobId` returns the status and, once finished, the compiled WASM. At most two compilations run simultaneously.
- The Run button shows a loader, stays disabled while compiling, and keeps the animation visible for at least 3 seconds to avoid flicker on very fast compilations.
- Initial public sharing does not use accounts or a database. `POST /api/shared-projects` creates an opaque 32-character identifier, saves the project to `shared/<id>/project.json`, and updates the UI URL to `/<id>` without a refresh. `PUT /api/shared-projects/:id` updates the same project, and `GET /api/shared-projects/:id` loads the public project.
- Successful WASM builds are cached in memory by a hash of the code, constants, and toolchain/sandbox configuration.
- ESP32/ESP8266/Wi-Fi support covers `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)`, `WiFi.internetAvailable()`, virtual `WiFiClient` TCP/HTTP, and virtual or real `AsyncMqttClient` MQTT through WASM imports connected to `ArduinoRuntime`.
- Multi-board projects can keep separate firmware per microcontroller; the firmware selector changes the active code in the editor and the runtime executes one WASM session per board.
- BBC micro:bit V2 exposes the main edge connector and a simulated 5x5 built-in LED matrix controlled by `digitalWrite` in the heart example.
- `ESP32 AC Energy Meter POC` models two residential phases with ZMPT101B, SCT, ADS1115, and A-N/B-N/A-B loads, calculating Vrms, Irms, W, VA, power factor, and kWh in WASM firmware.
- `ESP32-C3 LED Blink` models an ESP32-C3 DevKit driving an external red LED through GPIO4 with a current-limiting resistor.
- `ESP32-S3 HUB75 Snake Game` models a P5 RGB HUB75 64x32 panel, four pull-up direction buttons, start/pause button, buzzer, 5V/10A power supply, and 74AHCT245. The firmware draws the snake in a 32x32 left area and score/level on the right through a simulated RGB framebuffer.
- `ESP Water Control Pump Reservoir` models ESP32 sender, ESP8266 asker, SSR, pump, and reservoir. It uses real MQTT and expects topics/payloads/tokens compatible with `https://github.com/mathmpr/water-control`.
- FC-37 support covers digital reading through `digitalRead` on `DO`, driven by the standalone Rain Environment without resetting virtual time when rain changes.
- LDR support covers `analogRead(A0)` through a voltage divider with a resistor, driven by the standalone Light Environment without resetting virtual time when light changes.
- BMP280 support covers `Wire.begin()` and a minimal `BMP280` shim class, registered by I2C address and driven by the standalone Climate Environment without resetting virtual time when temperature/pressure change.
- External ADC support covers `ADS1015`, `ADS1115`, and `MCP3008` through minimal shim classes, driven by Analog Voltage Source without resetting virtual time when voltage changes.

## Component documentation

- `docs/component-description.md`: explains how a component is packaged, including manifest, visual model, contributions, firmware, shims, and behaviors.
- `docs/component-contract.md`: defines the minimum contract validated by tests.
- `docs/official-component-guidelines.md`: defines architectural rules to avoid new coupling in the core.
- `add-components/new-component-example.md`: template for planning and accepting a new official component.

## Current limitations

- Electron integration is not included yet.
- The solver is not a general nodal/SPICE solver.
- Environment connections are still drawn as regular visual wires, although they are serialized separately.
- Manifest-based pin mapping exists for main scenarios, but does not yet cover the full ESP32/ESP8266 electrical/peripheral model.
- Firmware WASM covers a subset of Arduino/C++; APIs outside the shim block simulation until implemented in the WASM path.
- `WiFiClient` uses virtual HTTP through a separate adapter, with routes declared in `network.http`; `AsyncMqttClient` uses a virtual MQTT broker declared in `network.mqtt` or a real MQTT broker through the backend bridge when `network.mqtt.mode` is `"real"`. Real cryptographic TLS/HTTPS, MQTT authentication, and persistent broker sessions are not part of the deterministic simulator yet.
- I2C/SPI support is still initial: `Wire`/`SPI` exist as small subsets for devices registered by the runtime; there is no full raw bus model and no complete Adafruit/MCP library support.
- FC-37 exposes `AO` in the manifest, but analog FC-37 reading is outside the initial delivery.
- The water-tank example is not self-contained in real mode: it depends on a broker/backend compatible with `https://github.com/mathmpr/water-control`, valid `asker`/`sender` tokens, and a network-accessible MQTT TCP broker.
- Browser-side compilation fallback was evaluated and is not part of the public MVP; the recommended path is a server with isolated `clang++`/`wasm-ld`.
- Undo/Redo only exists during the current session.
- The signal monitor is contextual/illustrative and does not render a real time waveform yet.
