# TODO: Removing Hardcoded Coupling

This TODO tracks the gradual removal of hardcoded code tied to components, pins, visual types, sensors, and libraries. General rule: a new component should be described by its manifest and should require specific code only when it introduces genuinely new physical, electrical, or firmware behavior.

## Baseline status

- [x] Load official catalog from `components/official/*/component.json`.
- [x] Expose `propertySchema` in `componentDefinitions` from manifests.
- [x] Expose `identity` in `componentDefinitions` from manifests.
- [x] Expose `electricalModel` in `componentDefinitions` from manifests.
- [x] Make the UI use `propertySchema` as the main source for editable properties.
- [x] Make the runtime use `behavior`, `simulation`, and `electricalModel` as the main source for behavior discovery.
- [x] Runtime creates environment channels from `simulation.kind === "environment-source"` and `behavior.channel`.
- [x] Prevent new components from adding `if (component.type === "...")` for simple inspector properties.

## `apps/web/js/board-editor.js`

### Responsibility split

- [x] Create `apps/web/js/board/` for internal board-editor modules.
- [x] Extract initial state and board-world configuration to `board/state.js`.
- [x] Extract component visual-template rendering to `board/component-template.js`.
- [x] Extract UI value formatting and normalization to `board/formatters.js`.
- [x] Extract wire-route calculation to `board/wire-routing.js`.
- [x] Extract Serial panel to `board/serial-panel.js`.
- [x] Extract Console to `board/console-panel.js`.
- [x] Extract Problems to `board/problems-panel.js`.
- [x] Extract viewport, pan, and zoom to `board/viewport-controller.js`.
- [x] Extract component and inline-control binding to `board/component-binder.js`.
- [x] Extract property/net inspector to `board/inspector-panel.js`.
- [x] Extract signal monitor to `board/signals-panel.js`.
- [x] Extract history, undo, redo, and import/export to `board/project-actions.js`.
- [x] Extract visual states and component-specific property updates to `board/component-state.js`.

### Visual component rendering

- [x] Remove the comparison chain against `definition.className` in `renderComponentTemplate()`.
- [x] Add support for `visual.controls` in the manifest.
- [x] Render inline controls by property type: `boolean`, `number`, `string`, and `variant`.
- [x] Keep specific visual customization in CSS/classes, not JS logic.
- [x] Ensure simple new components can appear on the board without editing `board-editor.js`.

### Property inspector

- [x] Expose `componentDefinitions[type].propertySchema`.
- [x] Refactor `renderEditableProperties()` to generate fields from the manifest schema.
- [x] Use manifest `variants` for selects such as resistor, capacitor, BMP280, and ADCs.
- [x] Use `minimum`, `maximum`, `step`, and `unit` from the schema to configure inputs.
- [x] Create human labels from schema or consistent property-name fallback.
- [x] Remove component-specific inspector branches for distance, resistor, capacitor, Wi-Fi Signal, rain, FC-37, light, LDR, climate, BMP280, analog voltage source, ADS1015, ADS1115, and MCP3008.

### Inline and inspector control binding

- [x] Replace specific selectors with `data-property="propertyName"`.
- [x] Create a generic binder for component inline inputs.
- [x] Create a generic binder for inspector inputs.
- [x] Create a single property-update function.
- [x] Declare in the manifest whether a property can update live without reset.
- [x] Declare in the manifest whether a property requires rerun/reset.
- [x] Remove component-specific binders such as `data-distance-slider`, `data-resistor-select`, `data-capacitor-select`, `data-wifi-slider`, `data-rain-*`, `data-light-*`, `data-climate-*`, `data-analog-*`, and `data-inspector-*`.

### Derived visual states

- [x] Create `visual.stateBindings` descriptors in the manifest.
- [x] Allow CSS-class binding from derived signals.
- [x] Allow text binding from derived signals.
- [x] Allow binding from terminal, net, environment channel, or electrical reading.
- [x] Refactor rain, LDR, BMP280, and ADC state updates to use state bindings.
- [x] Ensure a new sensor with an existing reading does not need a new `apply*States()` function.

### Signal monitor

- [x] `renderSignals()` uses selected-component properties.
- [x] `renderSignals()` uses real project terminals and connections.
- [x] `renderSignals()` uses electrical readings by component/net.
- [x] Remove fixed pin heuristics based on `dN`, `a0..a5`, and `ioN`.
- [x] Create shared pin/capability resolver.
- [x] Read pin capabilities from microcontroller manifests.
- [x] Support named signals by component/net without depending on legacy fields.

## `apps/web/js/simulation/simulation-engine.js`

### Environment sources

- [x] Refactor `bindEnvironmentChannels()` to iterate components with `simulation.kind === "environment-source"`.
- [x] Create environment channels from `behavior.channel`.
- [x] Read main, active, and intensity properties through behavior metadata.
- [x] Normalize environment payloads through adapter/schema.
- [x] Remove hardcoded creation of `distance`, `rain`, `light`, `climate`, and `analog-voltage` channels.

### Sensor and converter binders

- [x] Create simulation behavior registry.
- [x] Register HC-SR04, FC-37, LDR, BMP280, ADS1015/ADS1115, and MCP3008 behavior instead of calling fixed binders directly.
- [x] Move environment-source selection to manifest metadata.
- [x] Move terminal/channel selection to manifest metadata.
- [x] Allow specialized behaviors, but keep them isolated in adapters.

### Pins and buses

- [x] Create board manifest with complete `pinMap` and capabilities.
- [x] Create digital/analog pin resolvers by capability, not regex.
- [x] Create I2C/SPI bus resolvers by capability.
- [x] Remove fixed `graph.findComponentsByType('arduino')[0]`.
- [x] Remove Arduino I2C assumption on `A4/A5`.
- [x] Remove ESP32 I2C assumption on `IO21/IO22`.
- [x] Remove MCP3008 SPI/CS assumption by Arduino digital pin.
- [x] Prepare ESP32 capabilities for I2C, SPI, PWM, ADC, timers, and interrupts.

### Legacy signals

- [x] Create `signalsByComponent`.
- [x] Create `signalsByNet`.
- [x] Migrate UI to consume signals for the selected component.
- [x] Keep `trig`, `echo`, `led`, `rain`, `rainDo`, `light`, and `lightAnalog` only as temporary compatibility.
- [x] Remove direct consumption of legacy signals once the UI is migrated.

## `apps/web/js/simulation/electrical-solver.js`

- [x] Solve simple series path `GPIO HIGH -> resistor -> LED -> GND`.
- [x] Detect LED without effective resistor.
- [x] Detect excessive LED current.
- [x] Detect excessive resistance for visible LED current.
- [x] Detect exceeded resistor power.
- [x] Detect basic short between HIGH output and GND.
- [x] Evolve solver toward manifest-primitive netlists.
- [x] Model `voltage-source`, `resistor`, and `diode-led` generically.
- [x] Model `sensor-module` with voltage/current limits.
- [x] Model `capacitor` at least for initial electrical validation.
- [x] Diagnose logic-voltage incompatibility by terminal.
- [x] Diagnose overcurrent by module/sensor.
- [x] Diagnose floating voltage on relevant inputs.
- [x] Emit diagnostics by component, terminal, and net.

## Firmware, Clang, and WASM

### `apps/web/firmware/wasm-compiler.mjs`

- [x] Compile firmware through WASM path.
- [x] Inject minimal Arduino/ESP32 shim for supported APIs.
- [x] Support Serial, WiFi, Wire, SPI, BMP280, ADS, and MCP shims.
- [x] Create library/shim registry.
- [x] Load shims based on detected `#include`.
- [x] Document supported APIs by library.
- [x] Avoid adding new libraries directly to the central compiler.

### `apps/web/js/simulation/wasm-firmware-runner.js`

- [x] Map WASM imports to basic Arduino runtime.
- [x] Map WASM imports to Serial.
- [x] Map WASM imports to Wi-Fi.
- [x] Map WASM imports to initial I2C/SPI.
- [x] Split imports by modules/adapters.
- [x] Register adapters by library.
- [x] Register adapters by capability.
- [x] Keep runner as orchestrator, without per-library logic.

### `apps/web/js/simulation/firmware-engine.js`

- [x] Document JS IR as deprecated.
- [x] Isolate JS IR for temporary fallback/debug.
- [x] Prevent new components from depending on JS IR.
- [ ] Remove JS IR once WASM covers required scenarios.

## Tests

- [x] Keep examples as integration tests.
- [x] Validate component and example JSON files.
- [x] Create manifest-contract tests.
- [x] Test generic property rendering from `propertySchema`.
- [x] Test generic inline property binding.
- [x] Test generic inspector property binding.
- [x] Test behavior registry with a fake component.
- [x] Test pin/capability resolver with a fake board.
- [x] Test that a simple new component does not require changing `board-editor.js`.

## Suggested execution order

- [x] Step 1: manifest-schema inspector.
- [x] Step 2: inline controls through schema and `visual.controls`.
- [x] Step 3: behavior registry in the simulation engine.
- [x] Step 4: pin/bus resolver through microcontroller manifest.
- [x] Step 5: signals by component/net instead of legacy fields.
- [x] Step 6: WASM shim registry by library.
- [x] Step 7: more generic electrical netlist for passives and modules.

## Checklist for new official components

The checklist moved to `docs/official-component-guidelines.md`, which should be read before the documents in `add-components/`.
