# Add Component: ESP32 and Wi-Fi Environment

## Goal

Improve ESP32 support and add a Wi-Fi environment so examples can demonstrate network-oriented firmware without requiring real network access.

## Components

### ESP32 DevKit

- Suggested id: `board.esp32.devkit`
- Category: board / microcontroller
- Visual: ESP32 development board.

### Wi-Fi network environment

- Suggested id: `environment.wifi-network`
- Category: environment / connectivity
- Visual: access point or radio signal card.

## ESP32 terminals

- Power: `vin`, `3v3`, `gnd`
- GPIO pins according to the chosen DevKit layout
- UART, I²C, SPI, PWM-capable pins
- Boot/reset pins where useful for visual completeness

## Simulated behavior

- Board GPIO must only affect connected components through physical wires.
- Wi-Fi state is represented by an environment component with SSID, password status, signal strength, and online/offline state.
- Firmware APIs can report connection success/failure based on environment settings.
- The Wi-Fi simulation must not perform uncontrolled external network access.

## Required examples

- ESP32 reads a sensor and prints values.
- ESP32 connects to the simulated Wi-Fi environment and displays connection state.

## Required tests

- GPIO state is shown on the board visual.
- Wi-Fi fails when SSID/password do not match the environment.
- Wi-Fi works when configured values match.
- Components do not work without required wires.

## Out of scope

Full TCP/IP emulation, real internet access from firmware, and RF interference modeling.
