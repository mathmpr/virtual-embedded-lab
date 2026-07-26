# Add Component: BMP280 Pressure and Temperature Sensor

## Goal

Add a BMP280 environmental sensor for pressure, temperature, and altitude-style maker examples.

## Component identity

- Suggested id: `sensor.environment.bmp280`
- Category: sensor / environment
- Visual: BMP280 breakout board.

## Terminals

- `vcc`, `gnd`
- `sda`, `scl` for I²C
- Optional SPI pins: `sck`, `sdi`, `sdo`, `cs`

## Environment component

Create or reuse an environment source that provides:

- temperature in °C
- pressure in hPa
- optional altitude estimate

## Simulated behavior

- Requires VCC/GND.
- Requires a valid I²C or SPI connection depending on configured mode.
- Returns environment-provided temperature and pressure.
- Does not provide valid readings while unpowered or disconnected from the bus.

## Required example

Read BMP280 temperature and pressure from an Arduino or ESP board and print values.

## Required tests

- Sensor is unavailable without VCC/GND.
- I²C address scan works only when SDA/SCL are connected.
- Readings follow the environment component values.

## Out of scope

Calibration coefficient drift, long-term sensor noise, and exact oversampling timing.
