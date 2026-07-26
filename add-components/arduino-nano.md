# Add Component: Arduino Nano

## Goal

Add Arduino Nano as a compact Arduino-compatible board for examples where the UNO footprint is too large.

## Component identity

- Suggested id: `board.arduino.nano`
- Category: board / microcontroller
- Visual: Nano-style board with USB connector and two pin rows.

## Terminals

- Digital GPIO: `d0` to `d13`
- Analog inputs: `a0` to `a7`
- Power: `5v`, `3v3`, `vin`, `gnd`
- Serial: `tx0`, `rx0`
- I²C: `sda`, `scl`
- SPI: `mosi`, `miso`, `sck`, `ss`
- Reset: `rst`

## Simulated behavior

- Runs Arduino-style firmware using the existing WASM firmware engine.
- Mirrors UNO-compatible digital, analog, PWM, I²C, and SPI behavior where pin mappings overlap.
- Shows live pin state in the board visual while the simulation runs.
- Components connected to Nano pins must depend on physical wires, not hard-coded IDs.

## Required example

Blink an LED and read one analog input using Arduino Nano.

## Required tests

- Pin labels and pin mapping are correct.
- Digital output state appears in the board visual.
- Analog reads reflect connected analog sources.
- Existing UNO behavior is not regressed.

## Out of scope

Exact bootloader behavior, USB serial chip emulation, and board-specific fuse settings.
