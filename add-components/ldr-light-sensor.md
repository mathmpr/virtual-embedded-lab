# Add Component: LDR Light Sensor

## Goal

Add an LDR/photoresistor sensor and a light environment so examples can react to brightness.

## Component identity

- Suggested id: `sensor.light.ldr`
- Category: sensor / light
- Visual: photoresistor disk.

## Terminals

- `pin1`
- `pin2`

## Environment component

Create or reuse a light source environment with:

- brightness percentage
- optional day/night presets

## Simulated behavior

- LDR resistance changes according to environment brightness.
- It must be wired as part of a voltage divider before an analog input can read a useful voltage.
- It must not produce a meaningful analog value while floating.

## Required example

Arduino/ESP reads an LDR voltage divider and changes LED brightness or RGB color according to light level.

## Required tests

- Floating LDR produces no valid reading.
- Voltage divider output changes with brightness.
- Missing VCC or GND is detected.

## Out of scope

Exact spectral response and response-time curves.
