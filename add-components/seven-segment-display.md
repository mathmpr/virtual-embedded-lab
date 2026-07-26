# Add Component: Seven-segment Display

## Goal

Add seven-segment displays for number-output examples and multiplexing lessons.

## Component identity

- Suggested id: `display.led.seven-segment`
- Category: display / LED
- Visual: single digit with decimal point.

## Terminals

- Segment pins: `a`, `b`, `c`, `d`, `e`, `f`, `g`, `dp`
- Common pin: `common`

## Simulated behavior

- Supports common-anode and common-cathode modes.
- Each segment lights only when there is a valid current path.
- Requires current-limiting resistors for realistic/safe wiring.
- Reports overcurrent when segment resistors are missing or too small.

## Required example

Arduino counts from 0 to 9 on a seven-segment display.

## Required tests

- Segment state matches wiring and logic mode.
- No segment lights without common connection.
- Missing/unsafe resistors produce diagnostics.
- Decimal point is independently controllable.

## Out of scope

Exact LED brightness binning and multiplex ghosting.
