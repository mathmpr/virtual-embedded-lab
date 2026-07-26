# Add Components: Water Pump, SSR, and Reservoir

## Goal

Add a safe irrigation-style simulation set: water pump, solid-state relay, and water reservoir/environment.

## Components

### Water pump

- Suggested id: `actuator.water-pump`
- Category: actuator / fluid
- Terminals: `positive`, `negative`

### Solid-state relay

- Suggested id: `switch.ssr.1-channel`
- Category: switching / isolation
- Terminals: `in+`, `in-`, `load_a`, `load_b`

### Water reservoir

- Suggested id: `environment.water-reservoir`
- Category: environment / water
- Properties: current level, capacity, inflow/outflow.

## Simulated behavior

- Pump requires a complete powered circuit and a switching device that is actually conducting.
- SSR input side must be driven correctly before the load side closes.
- Reservoir level changes when the pump is active.
- Pump must remain off if the relay/SSR/transistor path is open.
- Warnings should identify dry-run, overcurrent, missing flyback/protection where relevant, and unsafe wiring.

## Required example

Soil-moisture controlled irrigation: sensor reads dry soil, controller activates pump through SSR/relay, reservoir level changes.

## Required tests

- Pump does not run without power.
- Pump does not run when SSR input is off.
- Reservoir level decreases only while pump is active.
- Wiring diagnostics catch missing ground, missing load path, and invalid control voltage.

## Out of scope

Hydraulic pressure curves, pipe losses, and pump wear.
