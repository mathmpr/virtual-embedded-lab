# Official Component Contract

This document defines the minimum contract expected from official components.

Every official component lives in `components/official/<component>/component.json` and must be valid against `schemas/component.schema.json`.

## Required manifest sections

- `identity`: stable component id, name, version, and description.
- `visual`: UI type, title, size, terminals, and optional palette metadata.
- `terminals`: electrical/logical/environment terminal definitions.
- `properties`: user-editable and simulation properties.
- `simulation`: simulation kind and implementation status.

When a component affects simulation, it must also declare:

- `behavior`: runtime-facing behavior metadata;
- `electricalModel`: electrical primitive/model when it participates in electrical diagnostics;
- `contributions`: local behavior/import/style files when component-specific code is required.

## `simulation`

`simulation` must communicate what is actually implemented.

Recommended shape:

```json
{
  "kind": "sensor",
  "implemented": true,
  "effects": ["firmware-input", "visual-state"]
}
```

Do not mark a component as fully simulated when it is only visual or partially modeled.

## Practical categories

- Passive electrical components: require terminals and `electricalModel`.
- Sensors: require environment binding and firmware-facing behavior.
- Actuators: require firmware input and visual/electrical effect.
- Boards: require pin map, logic voltage, and runtime behavior.
- Environment components: require environment channels and output terminals.

## Tests

The test suite validates:

- manifest/schema validity;
- consistency between `visual.terminals` and `terminals`;
- palette visibility;
- example references;
- firmware/simulation behavior for implemented components.

## Example code

Example firmware should live outside the JSON file, under:

```text
examples/<example>/firmware/*.ino
```

`project.json` should reference the firmware path. The examples API resolves the referenced file before sending the project to the UI.
