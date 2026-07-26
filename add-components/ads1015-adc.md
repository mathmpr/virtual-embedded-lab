# Add Component: ADS1015 ADC

## Goal

Add the ADS1015 external ADC for projects that need four analog inputs over I²C with 12-bit conversion.

## Component identity

- Suggested id: `converter.adc.ads1015`
- Category: analog / I²C converter
- Visual: small breakout board with screw/header-style analog inputs.

## Terminals

- `vcc`, `gnd`
- `sda`, `scl`
- `addr`
- `alrt`
- `a0`, `a1`, `a2`, `a3`

## Simulated behavior

- Requires VCC/GND and a valid I²C bus.
- Exposes four single-ended analog channels and supported differential pairs.
- Uses 12-bit conversion semantics.
- Applies gain/range configuration when firmware writes the config register.
- Reports disconnected analog channels as floating unless tied to a simulated source.

## Firmware support

The firmware/WASM bridge should provide enough I²C register behavior for common ADS1x15 libraries to initialize and read channel values.

## Required example

Arduino reads one or more analog sources through ADS1015 and prints converted voltage values.

## Required tests

- Device is not discoverable without VCC/GND.
- Reads fail or return invalid state without SDA/SCL.
- Channel value follows the connected analog source.
- Conversion scale matches 12-bit resolution.

## Out of scope

Exact comparator timing and all continuous-conversion edge cases can be deferred.
