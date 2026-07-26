# Add Components: Basic Maker Inputs and Sensors

## Goal

Track the basic input and sensor components commonly needed for beginner maker projects.

## Components covered

- Push button
- Pull-up/pull-down button module
- Potentiometer
- Trimpot
- LDR/photoresistor
- LM35/TMP36 temperature sensor
- Soil moisture sensor
- Rain sensor
- Joystick
- Rotary encoder
- Capacitive touch sensor

## Required simulation rules

- Every component must require physical VCC/GND where the real module requires power.
- Every logical output must depend on an actual wire to the board.
- Analog values must come from a connected electrical model or environment source.
- No input can silently work from a hard-coded component id.
- Floating inputs should be reported as warnings or invalid readings.

## Required examples

Examples do not need to be one per component, but they must cover:

- analog input readings
- digital input readings
- environment-controlled sensors
- UI controls that modify sensor state during simulation

## Required tests

- Power missing.
- Ground missing.
- Signal wire missing.
- Valid wiring.
- Runtime state changes through the UI.

## Out of scope

Exact manufacturer tolerances and aging effects.
