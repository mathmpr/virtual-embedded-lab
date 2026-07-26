# Add Component: MCP3008 ADC

## Goal

Add the MCP3008 external ADC for SPI-based analog input expansion.

## Component identity

- Suggested id: `converter.adc.mcp3008`
- Category: analog / SPI converter
- Visual: 16-pin DIP or breakout.

## Terminals

- `vdd`, `vref`, `agnd`, `dgnd`
- `clk`, `dout`, `din`, `cs`
- `ch0` to `ch7`

## Simulated behavior

- Requires VDD, VREF, analog ground, and digital ground.
- Requires physical SPI connections.
- Returns 10-bit readings scaled by VREF.
- Analog channels must be connected to a source or valid voltage divider.
- Floating channels must not produce stable useful values.

## Firmware support

Support common SPI transaction patterns used by Arduino MCP3008 examples.

## Required example

Read multiple analog channels through MCP3008 and print raw and voltage values.

## Required tests

- No SPI response without power or CS.
- Readings track connected analog sources.
- VREF changes conversion scale.
- Floating channels are detected.

## Out of scope

Sample-and-hold timing, input leakage, and exact SPI edge-mode variants.
