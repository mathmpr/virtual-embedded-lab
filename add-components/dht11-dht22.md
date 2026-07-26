# Add Component: DHT11 and DHT22

## Goal

Add DHT11 and DHT22 temperature/humidity sensors for introductory weather-station projects.

## Component identity

- Suggested ids: `sensor.environment.dht11`, `sensor.environment.dht22`
- Category: sensor / environment
- Visual: DHT-style package with three or four pins.

## Terminals

- `vcc`
- `data`
- `gnd`
- Optional `nc`

## Environment component

Create or reuse an environment source that exposes:

- temperature in °C
- relative humidity in %

## Simulated behavior

- Requires VCC/GND and a physically connected data pin.
- Returns environment-provided temperature and humidity.
- DHT11 should use lower precision/range than DHT22.
- Reports missing pull-up or floating data where relevant.

## Firmware support

Support common DHT Arduino libraries at the protocol abstraction level used by the simulation.

## Required example

Read DHT11 or DHT22 values and show them in serial output or an LCD.

## Required tests

- No valid reading without power.
- No valid reading without data wire.
- DHT11/DHT22 precision differences are visible.
- Values follow the environment source.

## Out of scope

Exact single-wire pulse timing and sensor self-heating.
