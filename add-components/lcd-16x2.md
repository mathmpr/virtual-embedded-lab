# Add Component: LCD 16x2

## Goal

Add a 16x2 character LCD, preferably with I²C backpack support, for text-based maker examples.

## Component identity

- Suggested ids: `display.lcd.16x2`, `display.lcd.16x2.i2c`
- Category: display / character LCD
- Visual: 16 columns by 2 rows with backlight.

## Terminals

### Parallel LCD

- `vss`, `vdd`, `vo`
- `rs`, `rw`, `e`
- `d4`, `d5`, `d6`, `d7`
- Optional `d0` to `d3`
- `led+`, `led-`

### I²C backpack

- `vcc`, `gnd`, `sda`, `scl`

## Simulated behavior

- Requires power and ground.
- I²C variant requires SDA/SCL.
- Displays text written by firmware commands.
- Backlight state should be visible.
- Should not update when unpowered or disconnected from the bus.

## Required example

Show sensor readings on a 16x2 I²C LCD.

## Required tests

- No visible text without VCC/GND.
- I²C commands work only with SDA/SCL connected.
- Text positioning and clearing work.

## Out of scope

Exact HD44780 timing and custom glyph edge cases can be added later.
