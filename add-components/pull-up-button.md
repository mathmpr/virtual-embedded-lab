# Add Component: Pull-up Button

## Goal

Add a button module that demonstrates pull-up and pull-down logic clearly for beginners.

## Component identity

- Suggested id: `input.button.pull-up`
- Category: input / digital
- Visual: tactile button module with signal, VCC, and GND pins.

## Terminals

- `vcc`
- `gnd`
- `sig`

## Simulated behavior

- Requires the wiring mode selected by the module: pull-up or pull-down.
- Output changes when the user presses/releases the button.
- The signal must be physically wired to the board input.
- Floating or incomplete wiring must be reported.

## Required example

Use the button to toggle an LED and print the digital state.

## Required tests

- Press/release changes signal state.
- Missing signal wire is detected.
- Missing VCC/GND is detected for module mode.
- Arduino internal pull-up behavior remains supported for plain two-terminal buttons.

## Out of scope

Mechanical bounce can be simplified unless a debounce example explicitly needs it.
