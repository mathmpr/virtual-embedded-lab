# Guidelines for New Official Components

Use this guide before adding a new official component.

The main goal is to keep the core generic. Component-specific behavior should live in the component package whenever possible.

## Main rule

Do not add new hardcoded rules to the core if the behavior can be expressed through:

- the component manifest;
- `electricalModel`;
- `behavior`;
- local `simulation/` contribution;
- local `firmware/` contribution;
- local `ui/` contribution.

The core should provide reusable infrastructure. Components should provide their own metadata and specialized logic.

## Required checklist

- [ ] Create or update `components/official/<component>/component.json`.
- [ ] Validate against `schemas/component.schema.json`.
- [ ] Declare all terminals in both `terminals` and `visual.terminals`.
- [ ] Add palette metadata if the component should appear in the UI.
- [ ] Add default properties for all user-editable state.
- [ ] Add `simulation.implemented` truthfully.
- [ ] Add `behavior` if firmware/runtime interaction is needed.
- [ ] Add `electricalModel` if electrical diagnostics are needed.
- [ ] Add local contributions instead of hardcoding behavior in core files.
- [ ] Add at least one example when the component introduces new behavior.
- [ ] Add/update tests when behavior can regress.
- [ ] Document limitations clearly.

## Where to declare each thing

- Visual size, body, terminals, palette: `visual`.
- Editable/default values: `properties`.
- Runtime meaning and bus/pin mapping: `behavior`.
- Electrical primitive and ratings: `electricalModel`.
- CSS: `contributions.styles`.
- Simulation behavior: `contributions.simulationBehaviors`.
- WASM imports/shims/libraries: `contributions.wasmImports` and local firmware files.

## When to create specific code

Create component-specific code when:

- the component has a protocol or runtime state;
- the component interacts with environment channels;
- the component drives visual state from firmware;
- the component needs custom WASM imports or C++ shims;
- the generic electrical solver cannot express the component's educational diagnostic.

Avoid specific code when a manifest-only declaration is enough.

## Recommended flow

1. Write the component proposal in `add-components/<component>.md`.
2. Define manifest terminals/properties/behavior.
3. Add the official manifest.
4. Add local contributions when needed.
5. Add an example project.
6. Add or update tests.
7. Run `npm test`.

## Related documents

- `docs/component-description.md`
- `docs/component-contract.md`
- `docs/hardcoded-coupling-map.md`
- `add-components/new-component-example.md`
