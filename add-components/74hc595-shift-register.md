# Add Component: 74HC595 Shift Register

## Goal

Add a 74HC595 serial-in/parallel-out shift register so examples can expand digital outputs from boards with limited GPIO.

## Component identity

- Suggested id: `logic.shift-register.74hc595`
- Category: logic / GPIO expansion
- Visual: 16-pin DIP package with QA-QH outputs and SER, SRCLK, RCLK, OE, SRCLR control pins.

## Terminals

- `vcc`, `gnd`
- `ser`: serial data input
- `srclk`: shift-register clock
- `rclk`: storage-register/latch clock
- `oe`: output enable, active low
- `srclr`: shift-register clear, active low
- `qa` to `qh`: parallel outputs
- `qh_prime`: serial carry output for chaining

## Simulated behavior

- Requires valid VCC and GND before any output can drive a load.
- Samples `ser` on the rising edge of `srclk`.
- Copies the internal shift register to outputs on the rising edge of `rclk`.
- Forces all parallel outputs high impedance when `oe` is high.
- Clears the shift register when `srclr` is low.
- Reports invalid/floating logic inputs when required pins are not physically connected.

## Required example

Create or keep an Arduino/ESP example that drives eight LEDs through the 74HC595 using data, clock, and latch pins.

## Required tests

- No output without VCC/GND.
- Output only changes after latch clock.
- OE disables all outputs.
- SRCLR clears shifted data.

## Out of scope

Propagation delay, exact fan-out curves, and thermal modeling are not required for the first implementation.
