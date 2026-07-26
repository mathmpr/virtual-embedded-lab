# Virtual Embedded Lab

This document is the consolidated English version of the original product requirements for Virtual Embedded Lab.

## 1. Overview

Virtual Embedded Lab is a local-first environment for assembling, programming, and simulating embedded electronics projects in a visual board editor.

The product combines:

- a visual circuit board;
- an official component catalog;
- project JSON import/export;
- Arduino-compatible firmware execution;
- deterministic virtual time;
- environment controls such as distance, light, rain, climate, Wi-Fi, and analog voltage;
- educational electrical diagnostics;
- examples that demonstrate real firmware interacting with virtual hardware.

The goal is not to replace real electronics work. The goal is to provide an accessible, inspectable, and deterministic environment for learning and prototyping.

## 2. Product goal

The application should let a user:

1. choose components from a catalog;
2. place components on a visual board;
3. connect terminals with wires;
4. write or load Arduino/C++ firmware;
5. run the firmware against the virtual circuit;
6. observe serial output, signal state, component state, and electrical problems;
7. save, export, import, and share projects.

The first validated circuit was:

```text
Arduino UNO + HC-SR04 + resistor + LED + distance environment
```

The platform has since expanded to ESP32/ESP8266, sensors, ADCs, displays, Wi-Fi, MQTT, AC metering, and maker switching components.

## 3. Architecture principles

### 3.1 Real code, virtual hardware

Firmware should be normal Arduino/C++ code whenever practical. The simulator should adapt the runtime around the code instead of asking users to write simulator-specific scripts.

The current primary execution path is:

```text
Arduino/C++ source -> Clang -> WASM -> ArduinoRuntime imports -> virtual components
```

### 3.2 Components react to signals, not source text

Components should not inspect firmware source text to decide what happens. They should react to:

- GPIO values;
- bus transactions;
- runtime calls;
- environment channels;
- circuit topology;
- electrical solver readings.

This keeps examples honest: if a wire is missing, the component should not work merely because the firmware contains the right function call.

### 3.3 Behavior and electricity are separate

A component may have:

- behavioral simulation: firmware-facing protocol/state;
- electrical simulation: voltage/current/connection diagnostics;
- visual simulation: state shown on the board.

These should be modeled independently when possible.

### 3.4 Deterministic virtual time

Simulation uses virtual time, not wall-clock time. Calls such as `delay()`, `micros()`, `millis()`, and `pulseIn()` advance or inspect virtual time deterministically.

Repeated executions of the same project should produce the same result unless the project intentionally uses randomness.

## 4. Initial MVP scope

The original MVP focused on:

- Arduino UNO;
- resistor;
- LED;
- HC-SR04;
- distance environment control;
- simple visual board;
- project JSON;
- basic Arduino runtime;
- simple electrical solver;
- deterministic scheduler.

The MVP acceptance goal was: an Arduino sketch triggers the HC-SR04, reads distance through `pulseIn`, and turns an LED on/off through a real circuit path validated by the solver.

## 5. Initial validation project

### Objective

Validate the full loop:

```text
firmware -> GPIO trigger -> sensor behavior -> echo pulse -> firmware read -> LED output -> electrical solver -> visual LED
```

### Components

- Arduino UNO.
- HC-SR04 ultrasonic sensor.
- Red LED.
- Current-limiting resistor.
- Distance environment control.

### Suggested wiring

```text
Arduino 5V  -> HC-SR04 VCC
Arduino GND -> HC-SR04 GND
Arduino D7  -> HC-SR04 TRIG
Arduino D6  -> HC-SR04 ECHO
Arduino D13 -> resistor -> LED anode
LED cathode -> GND
Distance environment -> HC-SR04 environment input
```

### Reference firmware

```cpp
const int trigPin = 7;
const int echoPin = 6;
const int ledPin = 13;

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  float distanceCm = duration * 0.0343 / 2.0;

  if (distanceCm < 100) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }

  Serial.println(distanceCm);
  delay(100);
}
```

### Expected result

- Near distance turns the LED on.
- Far distance turns the LED off.
- Serial output shows measured distance.
- Electrical diagnostics warn about invalid resistor values, missing resistor, overcurrent, or invalid wiring.

## 6. Proposed architecture

Main runtime modules:

- `VirtualClock`: virtual time source.
- `EventScheduler`: deterministic event queue.
- `EnvironmentEngine`: environment channels.
- `ArduinoRuntime`: firmware-facing Arduino APIs.
- `CircuitGraph`: component/wire/net graph.
- `electrical-solver`: electrical readings and diagnostics.
- component behavior registry: specialized sensor/display/actuator behavior.
- WASM firmware runner: imports/exports bridge between compiled firmware and runtime.

## 7. Visual interface

The UI is a web application because it offers:

- easy local development;
- HTML controls inside components;
- SVG wires;
- CodeMirror integration;
- browser-native WASM execution;
- a future path to Electron.

Initial layout:

- topbar;
- left component palette;
- center board;
- right inspector;
- bottom panel with Code, Console, Serial, and Problems.

Interactions:

- drag-and-drop components;
- click terminals to create wires;
- pan/zoom board;
- edit component properties inline or in the inspector;
- import/export project JSON;
- load official examples.

## 8. Project representation

Projects are represented as JSON. A project stores:

- schema version;
- project name and optional description;
- board size/grid;
- components;
- positions;
- properties;
- electrical connections;
- environment connections;
- code/firmware files;
- optional multiple firmware entries;
- optional network configuration;
- optional public share key.

Example shape:

```json
{
  "schemaVersion": "1.0.0",
  "name": "Example",
  "components": [],
  "connections": [],
  "environmentConnections": [],
  "code": {
    "language": "arduino-cpp",
    "entry": "main.ino",
    "files": {
      "main.ino": "void setup() {}\\nvoid loop() {}"
    }
  }
}
```

## 9. Component model

Official components are packages under:

```text
components/official/<slug>/
```

Minimum package:

```text
component.json
```

Optional package files:

```text
ui/styles.css
simulation/behavior.js
firmware/library.json
firmware/wasm-imports.js
firmware/shims/*.cpp
```

Manifest responsibilities:

- `identity`: stable semantic id and metadata.
- `visual`: visual type, title, size, controls, terminals, palette.
- `properties`: persisted editable state.
- `terminals`: logical terminals.
- `simulation`: role/effects/implementation status.
- `electricalModel`: electrical data when relevant.
- `behavior`: runtime behavior metadata.
- `contributions`: local CSS/simulation/firmware files.

Component categories:

- passive electrical parts;
- active electrical parts;
- behavioral sensors;
- actuators;
- microcontroller boards;
- environment sources;
- displays;
- bus/peripheral modules.

## 10. Example component manifests

### Resistor

A resistor should declare:

- two terminals;
- resistance property;
- resistance variants;
- passive electrical model;
- visual body and palette metadata.

### LED

An LED should declare:

- anode/cathode terminals;
- forward voltage;
- safe current;
- visual state binding for brightness/on-off state;
- electrical primitive `led`.

### HC-SR04

An HC-SR04 should declare:

- VCC/GND;
- trigger input;
- echo output;
- environment input;
- behavioral sensor role;
- distance environment channel;
- trigger/echo behavior metadata.

## 11. Firmware engine with Clang

Responsibilities:

- accept Arduino/C++ source;
- provide diagnostics;
- compile supported firmware to WASM;
- wire WASM imports to `ArduinoRuntime`;
- expose deterministic runtime behavior.

The current implementation uses Clang/wasm-ld and a controlled shim layer. Unsupported APIs should fail with clear diagnostics rather than silently doing nothing.

## 12. Virtual Arduino runtime

The runtime exposes the subset needed by examples:

- GPIO: `pinMode`, `digitalWrite`, `digitalRead`;
- time: `millis`, `micros`, `delay`, `delayMicroseconds`;
- pulse measurement: `pulseIn`;
- Serial;
- Wi-Fi;
- virtual HTTP/TCP;
- virtual/real MQTT bridge;
- initial I2C/SPI abstractions;
- component-specific imports registered by firmware libraries.

## 13. Initial electrical engine

The initial solver focuses on educational diagnostics:

- simple LED/resistor series path;
- current and power calculation;
- overcurrent;
- missing resistor;
- excessive resistance;
- insufficient voltage;
- basic shorts;
- sensor/module voltage-current limits.

The solver is intentionally incremental and is not a general SPICE replacement.

## 14. Signal bus and nets

Wires are grouped into nets. Nets drive:

- serialization;
- terminal compatibility validation;
- circuit graph construction;
- electrical solver;
- signal monitor;
- component behavior binding.

Environment connections are serialized separately from electrical connections even if they look like wires in the UI.

## 15. HC-SR04 behavior

The HC-SR04 behavior is:

1. firmware drives TRIG low/high/low;
2. behavior detects a valid trigger pulse;
3. distance environment is read;
4. echo pulse duration is calculated;
5. ECHO line is driven high for the calculated duration;
6. firmware reads it through `pulseIn`.

The behavior must depend on real physical connections, power, and environment binding.

## 16. Environment engine

The environment engine stores deterministic channels such as:

- distance;
- rain;
- light;
- climate;
- Wi-Fi;
- analog voltage;
- AC mains;
- water reservoir.

Environment sources can be standalone UI controls or components connected through environment terminals.

## 17. AI-assisted component generation

The original product vision included AI-assisted component import. That feature should be treated carefully.

Proposed flow:

1. user provides component description/datasheet;
2. assistant proposes manifest/properties/terminals;
3. assistant proposes simulation limitations;
4. generated files are reviewed before becoming official;
5. tests validate schema and behavior.

Safety rules:

- never mark a generated component as fully simulated without evidence;
- keep limitations explicit;
- prefer manifest-only components when behavior is unknown;
- require review for firmware shims and simulation code.

Trust states:

- draft;
- reviewed;
- official;
- deprecated.

## 18. Development plan

### Phase 0 - Foundation

- repository structure;
- schemas;
- test runner;
- initial docs.

### Phase 1 - Visual editor

- board;
- palette;
- component placement;
- inspector;
- project persistence.

### Phase 2 - Terminals, wires, and nets

- clickable terminals;
- SVG wires;
- net model;
- serialization;
- validation.

### Phase 3 - Clock and scheduler

- deterministic clock;
- event queue;
- delays and scheduled behavior.

### Phase 4 - Basic electrical solver

- LED/resistor path;
- current/power;
- diagnostics.

### Phase 5 - Minimal Arduino runtime

- GPIO;
- time;
- Serial;
- basic firmware execution.

### Phase 6 - HC-SR04 and `pulseIn`

- trigger/echo behavior;
- distance channel;
- end-to-end firmware validation.

### Phase 7 - Diagnostics and UX

- Problems panel;
- clearer warnings;
- serial/console feedback.

### Phase 8 - Component registry

- official catalog;
- manifest-driven UI;
- component contributions.

### Phase 9 - Assisted importer

- proposal workflow;
- schema validation;
- review gates.

### Phase 10 - ESP expansion

- ESP32/ESP8266 boards;
- Wi-Fi environment;
- HTTP/MQTT;
- additional examples.

## 19. Suggested repository structure

```text
apps/
  web/
components/
  official/
docs/
examples/
packages/
schemas/
tests/
```

## 20. Testing strategy

### Unit tests

- scheduler;
- environment engine;
- runtime APIs;
- electrical solver;
- component helpers.

### Integration tests

- examples;
- firmware compilation;
- WASM runtime;
- UI fixtures;
- project serialization.

### Deterministic tests

Repeated runs should produce stable results for the same inputs.

### Security tests

Public compilation must enforce:

- source-size limits;
- rate limits;
- sandboxed compiler execution;
- unsupported include rejection;
- no direct host filesystem access through firmware source.

## 21. MVP limitations

- Not a full electronics/SPICE simulator.
- Not a replacement for real hardware.
- Not a complete Arduino/ESP32 SDK.
- Not a complete browser networking stack.
- No real RF simulation.
- No thermal model.
- No memory-exhaustion/hang validation for microcontrollers.
- No physical component wear, manufacturing tolerance, or electromagnetic interference.

## 22. Technical risks

- Compiling untrusted C++ on a public server.
- Growing hardcoded component coupling in the core.
- Overstating simulation fidelity.
- Adding too many firmware APIs without tests.
- Making examples work without physical connections.
- Confusing visual state with simulated electrical state.
- Making the solver appear more accurate than it is.

Mitigations:

- run public compilation in sandboxed/unprivileged context;
- keep component behavior in component packages;
- document limitations;
- require tests for examples and behaviors;
- ensure active components validate power, GND, and logical connections;
- show clear diagnostics when a circuit is invalid.
