# Add Component: ADS1115 ADC

## Goal

Add the ADS1115 external ADC for high-resolution analog measurements over I²C.

## Component identity

- Suggested id: `converter.adc.ads1115`
- Category: analog / I²C converter
- Visual: four-channel ADC breakout.

## Terminals

- `vcc`, `gnd`
- `sda`, `scl`
- `addr`
- `alrt`
- `a0`, `a1`, `a2`, `a3`

## Simulated behavior

- Requires VCC/GND and physical I²C connections.
- Supports single-ended readings from A0-A3.
- Supports common differential pairs when configured by firmware.
- Uses 16-bit conversion semantics and programmable gain.
- Connected analog sources must determine channel voltage; the component must not return useful values while floating.

## Firmware support

Provide enough ADS1115 register behavior for common Arduino examples to initialize the device, configure gain, and read conversion results.

## Required example

An Arduino UNO example connected to ADS1115 and an analog source, with metadata listing the board and all used components.

## Required tests

- No functional ADC readings without VCC/GND.
- No I²C response without SDA/SCL.
- Input channel tracks the connected voltage source.
- Returned counts match 16-bit scale and selected gain.

## Out of scope

Noise modeling, conversion latency jitter, and comparator alert modes may be added later.
