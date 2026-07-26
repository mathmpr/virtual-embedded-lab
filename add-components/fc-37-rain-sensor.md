# Add Component: FC-37 Rain Sensor

## Goal

Add the FC-37 rain sensor module for weather and irrigation examples.

## Component identity

- Suggested id: `sensor.weather.fc37-rain`
- Category: sensor / weather
- Visual: rain plate plus comparator module.

## Terminals

- `vcc`
- `gnd`
- `ao`: analog output
- `do`: digital comparator output

## Environment component

Create or reuse a rain/wetness environment with:

- rain intensity or wetness percentage
- comparator threshold

## Simulated behavior

- Requires VCC/GND.
- `ao` follows wetness level.
- `do` changes according to comparator threshold.
- Reports floating outputs when the module is not powered.

## Required example

Arduino or ESP reads analog and digital rain outputs and drives a warning LED or buzzer.

## Required tests

- No valid output without power.
- Analog output follows wetness.
- Digital output switches at configured threshold.

## Out of scope

Corrosion, plate contamination, and exact resistance curves.
