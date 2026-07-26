# Add Component: Buzzer

## Goal

Add active and passive buzzers for simple sound feedback in educational examples.

## Component identity

- Suggested ids: `actuator.buzzer.active`, `actuator.buzzer.passive`
- Category: actuator / sound
- Visual: round buzzer with polarity marker.

## Terminals

- `positive`
- `negative`

## Simulated behavior

- Requires a complete electrical path between power/GPIO and ground.
- Active buzzer sounds when driven with valid DC voltage above threshold.
- Passive buzzer responds to PWM/tone frequency.
- Visual state should show whether the buzzer is silent or active.
- Warnings should be produced for reverse polarity, missing ground, or excessive current.

## Firmware support

Support common Arduino `digitalWrite`, `tone`, `noTone`, and PWM-driven examples.

## Required example

Button-controlled buzzer and melody/tone demonstration.

## Required tests

- No sound without a complete circuit.
- Active buzzer works from digital HIGH.
- Passive buzzer needs frequency/PWM.
- Overvoltage or invalid wiring is reported.

## Out of scope

Audio waveform rendering and realistic speaker acoustics.
