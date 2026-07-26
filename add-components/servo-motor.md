# Add Component: Servo Motor

## Goal

Add hobby servo motors for robotics and movement examples.

## Component identity

- Suggested ids: `actuator.servo.sg90`, `actuator.servo.mg90s`, `actuator.servo.mg996r`
- Category: actuator / motor
- Visual: servo body with horn angle.

## Terminals

- `vcc`
- `gnd`
- `signal`

## Simulated behavior

- Requires VCC/GND and a PWM-style signal.
- Converts pulse width or Servo library commands into horn angle.
- Shows current angle visually.
- Reports undervoltage, missing ground, missing signal, or excessive current draw for larger servos.

## Firmware support

Support Arduino Servo-style writes where already available in the firmware engine.

## Required example

Potentiometer-controlled servo angle.

## Required tests

- Servo does not move without VCC/GND.
- Servo does not move without signal.
- Angle follows valid control signal.
- Current warning differs between SG90 and high-torque servos.

## Out of scope

Torque/load physics, gearbox backlash, and real acceleration curves.
