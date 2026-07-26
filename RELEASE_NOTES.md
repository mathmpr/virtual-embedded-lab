# Virtual Embedded Lab v0.1.0-alpha.1

This is the first public alpha release of **Virtual Embedded Lab**, an open-source visual environment for building, programming, and behaviorally simulating embedded electronics projects.

Virtual Embedded Lab combines a drag-and-drop board editor with real C/C++ compilation through Clang and WebAssembly, allowing firmware, electronic components, sensors, actuators, networks, and physical environments to work together in the same simulation.

## Try it online

https://virtual-lab.mathmpr.com/

Projects can be shared directly through generated URLs. Build a project, press **Run**, and share the resulting link.

## Highlights

- Drag-and-drop visual editor for boards, components, environments, and wires.
- Real Arduino-compatible C/C++ compilation using Clang and `wasm-ld`.
- WebAssembly-based firmware execution with virtual time.
- Multi-board projects with separate firmware for each microcontroller.
- Serial TX/RX support and per-board serial output.
- Simulated GPIO, digital input/output, analog input, PWM, timing, and basic interrupts.
- Initial I2C and SPI support for sensors and external ADCs.
- Simulated ESP32 and ESP8266 Wi-Fi APIs.
- Virtual HTTP/TCP communication.
- Virtual and real MQTT support.
- Incremental electrical simulation for simple LED/resistor circuits, current, power, overcurrent, insufficient voltage, excessive resistance, and basic short circuits.
- Component packages with their own manifests, styles, behaviors, firmware shims, and WASM imports.
- JSON import/export, Undo/Redo, pan, zoom, colored wires, and component inspection.
- Public project sharing through opaque URL identifiers.

## Supported boards

The initial official catalog includes:

- Arduino UNO
- Arduino Nano
- BBC micro:bit V2
- ESP32 DevKitC V4
- ESP32-C3 DevKit
- ESP32-S3 DevKit
- ESP8266 NodeMCU

## Included components and environments

The official catalog already includes components such as:

- Resistors, capacitors, and LEDs
- RGB LED
- HC-SR04 ultrasonic sensor
- FC-37 rain sensor
- LDR light sensor
- BMP280
- ADS1015 and ADS1115
- MCP3008
- ZMPT101B and SCT current transformer
- LM35
- PIR HC-SR501
- TTP223
- Tilt, vibration, Hall, reed, and IR obstacle sensors
- Potentiometers and trimpots
- Capacitive soil moisture sensor
- BJTs, MOSFETs, relays, SSRs, PC817, ULN2003A, and ULN2803A
- HUB75 RGB matrix panel
- Buzzer and buttons
- Water pump and water reservoir
- Distance, rain, light, climate, Wi-Fi signal, AC mains, and analog voltage environments

## Example projects

This release includes examples demonstrating:

- HC-SR04 distance detection controlling an LED
- Arduino Serial LED control
- Multi-board Serial bridge
- Pull-up buttons and buzzer output
- BBC micro:bit V2 LED matrix heart
- ESP32-C3 external LED blink
- ESP32 and ESP8266 Wi-Fi scenarios
- Virtual HTTP/TCP communication
- Virtual and real MQTT communication
- ESP32 AC energy meter proof of concept
- ESP32-S3 HUB75 Snake game
- FC-37 rain detection
- LDR analog light measurement
- BMP280 I2C weather readings
- ADS1015, ADS1115, and MCP3008 external ADC examples
- ESP32 + ESP8266 water-pump and reservoir control using real MQTT

## Public deployment safeguards

The public instance includes:

- Sandboxed firmware compilation
- Compilation timeout
- Request and source-size limits
- Rate limiting of 8 compilation requests per minute
- An in-memory compilation queue
- A maximum of two simultaneous compilations
- Queue-position feedback in the interface
- HTTP `429` responses when limits are reached
- In-memory caching of successful WASM builds

## Current limitations

This is an early public alpha. Some components and embedded APIs have partial support.

Known limitations include:

- The electrical solver is not yet a general nodal or SPICE solver.
- Arduino/C++ support is limited to the APIs and shims currently implemented in the WASM runtime.
- ESP32 and ESP8266 hardware/peripheral behavior is behavioral rather than cycle-accurate emulation.
- I2C and SPI support currently covers a small subset of devices and operations.
- Real TLS/HTTPS, MQTT authentication, and persistent broker sessions are not yet part of the deterministic simulator.
- The signal monitor does not yet provide a full real-time waveform or logic analyzer.
- Undo/Redo history exists only during the current browser session.
- Public shared projects currently use URL-based access without user accounts or ownership controls.
- Electron integration is not included yet.

Simulations are educational and development tools. They do not replace physical validation, real measurements, or proper electrical safety practices.

## Local requirements

- Node.js 24 or newer
- `clang++`
- `lld` / `wasm-ld`
- Project dependencies installed with `npm install`
- Docker or Podman is recommended for isolated compilation in public deployments

## Feedback and contributions

This release is intended for early testing and community feedback.

- Report bugs: https://github.com/mathmpr/virtual-embedded-lab/issues
- Request components through GitHub Issues
- Read `CONTRIBUTING.md` before submitting pull requests
- Sponsor development through GitHub Sponsors

## License

Virtual Embedded Lab is distributed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`).
