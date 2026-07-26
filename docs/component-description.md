# How a Component Is Described

This document explains how an official component is packaged in Virtual Embedded Lab. Use it as a practical reference when creating or reviewing components.

## Structure

An official component lives in `components/official/<slug>/`.

Recommended structure:

```text
components/official/<slug>/
  component.json
  ui/
    styles.css
  simulation/
    behavior.js
  firmware/
    library.json
    wasm-imports.js
    shims/
      <library-or-api>.cpp
```

Not every component needs every file. Purely visual or passive components usually only need `component.json`. Extra files should exist only when the component introduces specific visuals, simulated behavior, firmware APIs, or C++ shims.

## Source of truth

`component.json` is the component source of truth. It describes:

- identity and category;
- editable properties;
- logical terminals;
- electrical model;
- simulation behavior;
- loadable contributions;
- visual representation on the board and catalog.

The core should read this information generically. Avoid rules such as `if (component.type === "...")` in `board-editor.js`, `arduino-runtime.js`, `wasm-import-adapters.js`, `wasm-compiler.mjs`, or `clang-analyzer.mjs` for cases that can be declared in the component.

## Main manifest fields

### `identity`

Identifies the component in a stable way.

```json
{
  "identity": {
    "id": "sensor.environment.bmp280",
    "name": "BMP280 Pressure/Temperature",
    "category": "sensor",
    "subCategory": "pressure-temperature"
  }
}
```

Use `identity.id` as the stable semantic identifier. The visual type stored in projects is `visual.type`.

### `simulation`

Declares the component role.

```json
{
  "simulation": {
    "kind": "behavioral-sensor",
    "effects": ["firmware", "environment", "electrical", "visual-state"],
    "implemented": true
  }
}
```

Common `kind` values:

- `visual-only`: element with no electrical or firmware impact.
- `passive-electrical`: resistor, capacitor, and other passive parts.
- `active-electrical`: LED, buzzer, relay, and simple active loads.
- `behavioral-sensor`: sensor that produces firmware readings.
- `environment-source`: environmental source such as climate, rain, light, or Wi-Fi.
- `microcontroller`: board that runs firmware.

Use `effects` to declare which subsystems the component affects: `electrical`, `firmware`, `environment`, and `visual-state`.

### `properties` and `variants`

`properties` stores persisted state and inspector-editable values.

```json
{
  "properties": {
    "i2cAddress": {
      "type": "number",
      "default": 118,
      "minimum": 118,
      "maximum": 119,
      "simulationUpdate": "rerun"
    }
  },
  "variants": {
    "i2cAddress": [
      { "label": "I2C 0x76", "value": 118 },
      { "label": "I2C 0x77", "value": 119 }
    ]
  }
}
```

Use `simulationUpdate: "live"` when the change can be applied without restarting firmware. Use `"rerun"` when firmware state must be rebuilt.

### `terminals`

Declares logical connectable points used by connections, solver, buses, and serialization.

```json
{
  "terminals": [
    { "id": "vcc", "label": "VCC", "type": "power-input" },
    { "id": "gnd", "label": "GND", "type": "ground" },
    { "id": "scl", "label": "SCL", "type": "i2c-scl" },
    { "id": "sda", "label": "SDA", "type": "i2c-sda" }
  ]
}
```

Every logical terminal must have a matching visual terminal in `visual.terminals` with the same `id`.

### `electricalModel`

Required when `simulation.effects` contains `electrical`.

```json
{
  "electricalModel": {
    "type": "sensor-module",
    "logicVoltage": 3.3,
    "toleratesFiveVoltPower": false,
    "bus": "i2c",
    "inputCurrentAmps": 0.001
  }
}
```

This block should contain only electrical-model data. Generic rules belong in the solver; highly specific exceptions must be justified.

### `behavior`

Required for `microcontroller`, `behavioral-sensor`, and `environment-source`.

```json
{
  "behavior": {
    "type": "bmp280-sensor",
    "environmentChannel": "climate",
    "bus": "i2c",
    "addressProperty": "i2cAddress",
    "sdaTerminal": "sda",
    "sclTerminal": "scl"
  }
}
```

`behavior.type` selects the adapter registered by `simulation/behavior.js` or by existing core adapters. The manifest should point to channels, terminals, properties, and buses; the adapter should implement only logic that cannot fit the declarative contract.

### `contributions`

Declares files loaded by the core.

```json
{
  "contributions": {
    "wasmImports": {
      "modules": ["./firmware/wasm-imports.js"]
    },
    "simulationBehaviors": {
      "modules": ["./simulation/behavior.js"]
    },
    "styles": {
      "files": ["./ui/styles.css"]
    }
  }
}
```

Contributions should be append-only whenever possible:

- `styles.files`: component-specific visual CSS.
- `simulationBehaviors.modules`: specialized behavior registration.
- `wasmImports.modules`: WASM imports required by component libraries.

Paths are resolved from `resources.baseUrl`, filled by the official component loader.

### `visual`

Defines how the component appears on the board and in the catalog.

```json
{
  "visual": {
    "type": "bmp280-sensor",
    "title": "BMP280",
    "className": "bmp280-sensor",
    "body": "25 C / 1013 hPa",
    "width": 170,
    "height": 118,
    "controls": [],
    "stateBindings": [],
    "palette": {
      "group": "Sensors",
      "subgroup": "Environment",
      "icon": "bmp280-icon",
      "order": 26
    },
    "terminals": [
      { "id": "vcc", "side": "left", "x": 0, "y": 26, "kind": "power" }
    ]
  }
}
```

Use `visual.controls` for inline elements such as sliders, checkboxes, selects, containers, and readouts. Use `visual.stateBindings` for text and classes derived from signals, nets, environment channels, properties, or runtime readings.

Component-specific CSS belongs in `ui/styles.css`; `apps/web/styles.css` should contain layout, editor, board, inspector, and shared styles.

## Firmware

Component-specific firmware libraries live in `firmware/library*.json`.

```json
{
  "id": "bmp280",
  "headers": ["BMP280"],
  "identifiers": ["BMP280"],
  "imports": ["bmp280Begin", "bmp280ReadTemperature", "bmp280ReadPressure"],
  "apis": ["BMP280.begin", "BMP280.readTemperature", "BMP280.readPressure"]
}
```

The resolver combines:

- `apps/web/firmware/core-libraries.json` for Arduino core, Serial, Wire, and SPI;
- `components/official/**/firmware/library*.json` for libraries added by components.

Component-specific C++ shims live in `firmware/shims/*.cpp`. Generic Arduino shims live in `apps/web/firmware/shims/arduino-wasm/**`.

Component-specific WASM imports live in `firmware/wasm-imports.js` and must register imports only for the declared libraries or capabilities.

## Evolution rules

- Adding a new component should be mostly append-only inside `components/official/<slug>/`.
- Editing the core is acceptable when the project gains a new generic capability, such as a bus type, electrical primitive, binding format, or Arduino core API.
- Editing `arduino-runtime.js` should mean generic runtime behavior, not visual component rules.
- Editing `wasm-import-adapters.js` should mean reusable Arduino/core imports, not imports specific to an external library.
- Editing `wasm-compiler.mjs` or `clang-analyzer.mjs` should be an exception tied to toolchain, library discovery, diagnostics, or shim assembly.

## Quick checklist

- `component.json` is valid and points to `schemas/component.schema.json`.
- `simulation` declares role, effects, and `implemented`.
- `terminals` and `visual.terminals` have the same IDs.
- `properties` has defaults and `simulationUpdate` when it affects runtime.
- `visual.palette` exists if the component appears in the catalog.
- Specific CSS lives in `ui/styles.css` and is declared in `contributions.styles`.
- Specific libraries live in `firmware/library*.json`.
- Specific shims live in `firmware/shims/*.cpp`.
- Specific behaviors live in `simulation/behavior.js`.
- An official example in `examples/<slug>/project.json` covers the main path.
- Relevant tests pass.
