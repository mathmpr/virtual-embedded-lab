# Add Components: Maker Switching and Isolation Components

## Goal

Add common relay, transistor, MOSFET, and optocoupler components used to switch loads safely from microcontroller pins.

## Components covered

- NPN transistors: BC547, 2N2222, TIP120/TIP122
- PNP transistors: BC327, 2N3906, TIP125/TIP127
- Logic-level MOSFETs: IRLZ44N, FQP30N06L, AO3400, 2N7000
- Non-logic-level MOSFET/module: IRF520
- Electromechanical relay modules: 1, 2, 4, and 8 channels
- Solid-state relay modules: 1, 2, 3, and 4 channels
- PC817 optocoupler
- ULN2003A and ULN2803A driver arrays

## Required electrical rules

- A switch must not conduct unless its control side is correctly powered and driven.
- Loads must depend on the switched path. LEDs, motors, pumps, or buzzers must stay off when the transistor/MOSFET/relay/opto output is open.
- MOSFETs must validate Vgs threshold and distinguish logic-level from non-logic-level parts.
- BJTs must validate base drive/current-limiting resistor and collector/emitter orientation.
- Relay coils/modules must validate control power, input logic, and contact wiring.
- Optocouplers must validate LED-side current and transistor-side pull-up/load path.

## Required examples

Create shared examples demonstrating:

- LED strip or LED load switched by MOSFET.
- Pump or motor switched by relay/SSR.
- Isolated input/output using PC817.
- Darlington/driver-array use with several loads.

## Required tests

- No conduction without VCC/GND.
- No conduction when control input is below threshold.
- Correct load behavior when the switch opens/closes.
- Warnings for missing base/gate resistors, missing flyback diode, overcurrent, and incompatible logic voltage.

## Out of scope

Detailed thermal runaway, relay contact bounce, and high-voltage arc modeling.
