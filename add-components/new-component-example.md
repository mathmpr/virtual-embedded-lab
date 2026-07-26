# New Component Request Template

Use this template when proposing a new simulated component.

## Component name

Write the public name that should appear in the UI.

## Goal

Explain what educational scenario this component enables and why the project needs it.

## Suggested identity

- `id`:
- `category`:
- `visualType`:
- `simulationModel`:

## Terminals

List every physical terminal that should be available for wiring.

Example:

- `vcc`
- `gnd`
- `signal`

## Properties and controls

List editable properties shown in the inspector and any runtime controls shown in the component UI.

## Simulated behavior

Describe what the component must actually simulate. Include:

- required power pins
- required ground pins
- required logic/analog signal pins
- expected behavior when a wire is missing
- warnings/errors for unsafe or unrealistic wiring

## Firmware/WASM expectations

Describe which firmware APIs or protocols should interact with the component.

Examples:

- GPIO
- analogRead
- PWM/tone
- I²C
- SPI
- UART

## Required examples

List one or more examples that demonstrate the component in a realistic circuit.

## Required tests

At minimum, test:

- missing VCC
- missing GND
- missing signal wire
- valid wiring
- runtime property changes

## Out of scope

State what the first implementation intentionally does not simulate.
