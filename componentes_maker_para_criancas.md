# Most Used Components in Maker Courses and Projects for Children

This catalog lists common components used in beginner maker education, robotics, Arduino/ESP projects, and STEM workshops for children. It is also a planning reference for deciding which components should exist in Virtual Embedded Lab.

The goal is not to model every part with full industrial accuracy. The goal is to prioritize components that create useful learning experiences while respecting the most important physical constraints: power, ground, signal wiring, safe current paths, and realistic behavior when a circuit is incomplete.

## 1. Development boards

| # | Component | Typical use |
|---:|---|---|
| 1 | Arduino UNO R3 | Most common beginner board for digital I/O, analog inputs, PWM, I²C, and SPI. |
| 2 | Arduino UNO R4 Minima | Newer UNO board with more modern microcontroller resources. |
| 3 | Arduino UNO R4 WiFi | UNO-style board with Wi-Fi/Bluetooth capabilities. |
| 4 | Arduino Nano | Compact Arduino-compatible board for breadboard projects. |
| 5 | Arduino Mega 2560 | Large Arduino board with many I/O pins. |
| 6 | ESP32 DevKit | Popular Wi-Fi/Bluetooth microcontroller board. |
| 7 | NodeMCU ESP8266 | Low-cost Wi-Fi board used in IoT lessons. |
| 8 | BBC micro:bit V2 | Education-focused board with LEDs, buttons, sensors, and radio. |
| 9 | Raspberry Pi Pico | RP2040 microcontroller board. |
| 10 | Raspberry Pi Pico W | Pico variant with Wi-Fi. |
| 11 | Adafruit Circuit Playground Express | Beginner-friendly board with many built-in sensors and LEDs. |
| 12 | Raspberry Pi | Linux single-board computer for advanced maker projects. |

## 2. Basic assembly components

| # | Component | Typical use |
|---:|---|---|
| 13 | Breadboard | Solderless circuit prototyping. |
| 14 | Mini breadboard | Small portable prototypes. |
| 15 | Male-to-male jumper wires | Breadboard-to-breadboard connections. |
| 16 | Male-to-female jumper wires | Board-to-module connections. |
| 17 | Female-to-female jumper wires | Header-to-header module connections. |
| 18 | Alligator clip wires | Temporary connections, classroom demos, conductive materials. |
| 19 | Male pin header | Solderable connector pins. |
| 20 | Female pin header | Socket-style connector pins. |
| 21 | Perfboard | Permanent soldered prototypes. |

## 3. Resistors and passive components

| # | Component | Typical use |
|---:|---|---|
| 22 | Resistor kit | Current limiting, pull-ups, pull-downs, dividers, and protection. |
| 23 | 10 kΩ potentiometer | Adjustable analog input and voltage divider. |
| 24 | Trimpot | Small calibration potentiometer. |
| 25 | Ceramic capacitor | Decoupling, filtering, timing, and debounce circuits. |
| 26 | Electrolytic capacitor | Larger power filtering and energy buffering. |
| 27 | 1N4148 diode | Small-signal switching diode. |
| 28 | 1N4007 diode | General rectifier and flyback diode for small inductive loads. |
| 29 | 1N5819 Schottky diode | Low-forward-voltage protection and power-path use. |

## 4. LEDs, signaling, and lighting

| # | Component | Typical use |
|---:|---|---|
| 30 | Common 5 mm LED | Basic output indicator. |
| 31 | Diffused LED | Softer visual indication. |
| 32 | Four-terminal RGB LED | Color mixing with three channels. |
| 33 | WS2812B / NeoPixel addressable LED | Individually addressable color LED. |
| 34 | WS2812B LED strip | Multiple addressable RGB LEDs in a strip. |
| 35 | 8 × 8 LED matrix | Simple icons, animations, and games. |
| 36 | MAX7219 8 × 8 matrix module | Easier LED matrix control over serial interface. |
| 37 | LED bar graph | Level indicators and visual meters. |

## 5. Buttons and controls

| # | Component | Typical use |
|---:|---|---|
| 38 | Push button / tactile button | Basic digital input. |
| 39 | On/off switch | Power or mode selection. |
| 40 | Slide switch | Simple persistent binary selection. |
| 41 | Analog joystick | Two-axis analog control plus optional button. |
| 42 | Rotary encoder | Incremental control and menu navigation. |
| 43 | 4 × 4 matrix keypad | Numeric and command input. |
| 44 | TTP223 capacitive touch sensor | Touch-based digital input. |

## 6. Sound

| # | Component | Typical use |
|---:|---|---|
| 45 | Active buzzer | Simple beeps using DC logic. |
| 46 | Passive buzzer | Tones and melodies driven by PWM/frequency. |
| 47 | Small 8 Ω speaker | Audio output with amplifier or proper driver. |
| 48 | PAM8403 amplifier module | Small speaker amplification. |
| 49 | DFPlayer Mini module | MP3 playback from storage. |

## 7. Displays

| # | Component | Typical use |
|---:|---|---|
| 50 | 16 × 2 LCD display | Text output. |
| 51 | I²C LCD adapter module | Reduces LCD wiring to I²C. |
| 52 | 0.96 inch I²C OLED display | Compact graphics/text display. |
| 53 | Seven-segment display | Numeric output. |
| 54 | TM1637 four-digit display | Clock, counter, and score displays. |
| 55 | Color TFT display | More advanced graphics and UI projects. |

## 8. Light, temperature, and environment sensors

| # | Component | Typical use |
|---:|---|---|
| 56 | LDR / photoresistor | Light-level measurement with a voltage divider. |
| 57 | Phototransistor | Faster or more directional light detection. |
| 58 | BH1750 light sensor | Digital lux measurement over I²C. |
| 59 | LM35 temperature sensor | Analog temperature measurement. |
| 60 | TMP36 temperature sensor | Analog temperature measurement with offset. |
| 61 | DHT11 sensor | Basic temperature and humidity. |
| 62 | DHT22 / AM2302 sensor | More accurate temperature and humidity. |
| 63 | BME280 sensor | Temperature, humidity, and pressure. |
| 64 | BMP280 sensor | Temperature and pressure. |

## 9. Distance, presence, and motion sensors

| # | Component | Typical use |
|---:|---|---|
| 65 | HC-SR04 ultrasonic sensor | Distance measurement. |
| 66 | JSN-SR04T waterproof ultrasonic sensor | Water-resistant distance measurement. |
| 67 | HC-SR501 PIR sensor | Motion/presence detection. |
| 68 | Infrared obstacle sensor | Short-range obstacle detection. |
| 69 | TCRT5000 line sensor | Line following and reflectance detection. |
| 70 | VS1838B infrared receiver | IR remote reception. |
| 71 | Infrared remote control | Sends IR commands. |
| 72 | APDS-9960 gesture sensor | Gesture, proximity, and color sensing. |

## 10. Position, tilt, and vibration sensors

| # | Component | Typical use |
|---:|---|---|
| 73 | Tilt switch | Simple orientation/tilt detection. |
| 74 | SW-420 vibration sensor | Vibration and impact detection. |
| 75 | MPU6050 accelerometer/gyroscope | Motion and orientation projects. |
| 76 | ADXL345 accelerometer | Acceleration measurement. |
| 77 | A3144 Hall sensor | Magnetic field detection. |
| 78 | Reed switch | Magnetic proximity switch. |

## 11. Water, plants, and material sensors

| # | Component | Typical use |
|---:|---|---|
| 79 | Resistive soil moisture sensor | Soil moisture measurement; easy but corrosion-prone. |
| 80 | Capacitive soil moisture sensor | More durable soil moisture measurement. |
| 81 | Rain sensor | Rain/wetness detection. |
| 82 | Water level sensor | Liquid level detection. |
| 83 | Float switch | Mechanical liquid-level switch. |
| 84 | YF-S201 water flow sensor | Flow pulse measurement. |
| 85 | Load cell with HX711 module | Weight measurement. |

## 12. Additional sensors

| # | Component | Typical use |
|---:|---|---|
| 86 | Sound sensor / microphone module | Sound level detection. |
| 87 | MQ-2 gas sensor | Smoke/LPG/flammable gas detection demos. |
| 88 | MQ-135 gas sensor | Air-quality demos. |
| 89 | RC522 RFID reader | Card/tag identification. |
| 90 | TCS3200 color sensor | Color detection by frequency output. |
| 91 | TCS34725 color sensor | Digital color sensing over I²C. |
| 92 | ACS712 current sensor | Current measurement. |
| 93 | SCT-013 current transformer | Non-invasive AC current measurement. |

## 13. Common bipolar transistors

| # | Component | Typical use |
|---:|---|---|
| 94 | BC547 | Small NPN signal transistor. |
| 95 | BC548 | Small NPN signal transistor. |
| 96 | BC337 | NPN transistor with higher current capability. |
| 97 | BC327 | PNP transistor paired with BC337-style uses. |
| 98 | 2N2222 / PN2222A | General-purpose NPN switching transistor. |
| 99 | 2N3904 | General-purpose NPN signal transistor. |
| 100 | 2N3906 | General-purpose PNP signal transistor. |
| 101 | TIP120 | NPN Darlington transistor for larger loads. |
| 102 | TIP122 | NPN Darlington transistor for larger loads. |
| 103 | TIP125 / TIP127 | PNP Darlington transistor for high-side switching. |
| 104 | TIP41C | NPN power transistor. |
| 105 | TIP42C | PNP power transistor. |
| 106 | BD139 | Medium-power NPN transistor. |
| 107 | BD140 | Medium-power PNP transistor. |

## 14. Common MOSFETs

| # | Component | Typical use |
|---:|---|---|
| 108 | IRLZ44N | Logic-level N-channel MOSFET for larger loads. |
| 109 | FQP30N06L | Logic-level N-channel MOSFET. |
| 110 | IRF520 | N-channel MOSFET, not ideal for direct 3.3 V/5 V logic without care. |
| 111 | AO3400 | Small logic-level N-channel MOSFET. |
| 112 | 2N7000 | Small N-channel MOSFET for low-current switching. |
| 113 | Power MOSFET module | Module form for switching motors, strips, and other loads. |

## 15. Relays and switching modules

| # | Component | Typical use |
|---:|---|---|
| 114 | One-channel electromechanical relay | Isolated load switching. |
| 115 | Two-channel electromechanical relay module | Switching two loads. |
| 116 | Four-channel electromechanical relay module | Multi-load switching. |
| 117 | Eight-channel electromechanical relay module | Larger automation projects. |
| 118 | One-channel solid-state relay | Silent electronic load switching. |
| 119 | Two-channel solid-state relay module | Switching two isolated loads. |
| 120 | Three-channel solid-state relay module | Switching three isolated loads. |
| 121 | Four-channel solid-state relay module | Multi-channel SSR switching. |
| 122 | PC817 optocoupler | Signal isolation between circuits. |
| 123 | ULN2003A relay driver | Darlington array for relays and steppers. |
| 124 | ULN2803A driver | Eight-channel Darlington driver array. |

## 16. Motors and actuators

| # | Component | Typical use |
|---:|---|---|
| 125 | SG90 micro servo | Small angular movement. |
| 126 | MG90S servo | Metal-gear small servo. |
| 127 | MG996R servo | Higher-torque servo. |
| 128 | 3 V to 6 V DC motor | Basic motion and fan projects. |
| 129 | DC gear motor | Slower higher-torque motion. |
| 130 | 28BYJ-48 stepper motor | Low-cost stepper motor. |
| 131 | ULN2003 stepper driver | Driver board for 28BYJ-48. |
| 132 | NEMA 17 stepper motor | Robotics/CNC-style stepper motor. |
| 133 | Solenoid | Linear push/pull actuator. |
| 134 | Mini water pump | Irrigation and water-flow projects. |
| 135 | 5 V or 12 V fan | Cooling or airflow projects. |

## 17. Motor drivers

| # | Component | Typical use |
|---:|---|---|
| 136 | L298N H-bridge | DC motor and stepper control. |
| 137 | L293D H-bridge | Small DC motor control. |
| 138 | TB6612FNG driver | Efficient dual motor driver. |
| 139 | DRV8833 driver | Low-voltage dual motor driver. |
| 140 | A4988 driver | Stepper motor driver. |
| 141 | DRV8825 driver | Stepper motor driver with higher current capability. |

## 18. Communication and connectivity

| # | Component | Typical use |
|---:|---|---|
| 142 | HC-05 Bluetooth module | Serial Bluetooth communication. |
| 143 | HC-06 Bluetooth module | Serial Bluetooth communication. |
| 144 | NRF24L01 module | Low-cost 2.4 GHz radio communication. |
| 145 | LoRa SX1276 / SX1278 module | Long-range low-bandwidth radio. |
| 146 | W5500 Ethernet module | Wired network connectivity. |
| 147 | MCP2515 CAN module | CAN bus communication. |
| 148 | USB-to-serial converter | Serial programming and debugging. |
| 149 | Logic-level converter | Safe 3.3 V/5 V logic interfacing. |

## 19. Power

| # | Component | Typical use |
|---:|---|---|
| 150 | AA battery holder | Portable low-voltage power. |
| 151 | 9 V battery holder | Simple portable power, limited current. |
| 152 | 18650 battery | Rechargeable lithium cell projects. |
| 153 | TP4056 charger module with protection | Charging one lithium cell. |
| 154 | LM2596 step-down converter | Buck conversion to lower voltage. |
| 155 | MT3608 step-up converter | Boost conversion to higher voltage. |
| 156 | MB102 breadboard power supply | Breadboard 3.3 V/5 V rails. |
| 157 | Adjustable bench power supply | Controlled lab power source. |
| 158 | AMS1117 regulator module | Simple linear regulation. |

## 20. Tools and support materials

| # | Component | Typical use |
|---:|---|---|
| 159 | Multimeter | Voltage, resistance, and continuity measurements. |
| 160 | Soldering iron | Permanent assembly. |
| 161 | Solder sucker | Removing solder. |
| 162 | Desoldering braid | Removing solder. |
| 163 | Flush cutter | Cutting leads and wires. |
| 164 | Needle-nose pliers | Holding and bending leads. |
| 165 | Wire stripper | Preparing wires. |
| 166 | Heat-shrink tubing | Insulation and strain relief. |
| 167 | Electrical tape | Temporary insulation. |
| 168 | Component organizer | Classroom and workshop organization. |

## 21. Priority components for an initial kit

For the simulator, the first useful maker kit should prioritize components that teach core concepts with visible feedback:

1. Arduino UNO R3
2. ESP32 DevKit
3. Breadboard and jumper wires
4. Resistors
5. LEDs and RGB LEDs
6. Push buttons and switches
7. Potentiometer
8. LDR
9. LM35/TMP36
10. DHT11/DHT22
11. Soil moisture sensor
12. Rain sensor
13. HC-SR04
14. Buzzer
15. Servo motor
16. DC motor
17. MOSFET switch
18. Relay or SSR module
19. LCD 16 × 2 I²C
20. Seven-segment display

## 22. Possible project examples

- Traffic light with pedestrian button.
- Light-controlled RGB LED.
- Mini weather station with DHT/BMP/BME sensor and LCD.
- Soil-moisture irrigation with pump and relay/SSR.
- Distance alarm with HC-SR04 and buzzer.
- Servo gate controlled by button, sensor, or joystick.
- LED matrix animation or simple game.
- RFID access indicator.
- Bluetooth/serial remote control.
- Wi-Fi sensor dashboard simulation.

## 23. Safety notes

- Simulated circuits should still teach real safety habits.
- LEDs need current-limiting resistors.
- Motors, relays, pumps, and solenoids need appropriate drivers and protection.
- Microcontroller GPIO pins must not directly power high-current loads.
- Inductive loads should use flyback protection where applicable.
- Lithium batteries and mains voltage are not safe beginner topics without supervision.
- The simulator should flag unrealistic wiring instead of silently making a component work.

## 24. Implementation rule for Virtual Embedded Lab

Every simulated component in this catalog should follow the same physical-connection principle:

- Power pins must be connected when the real component requires power.
- Ground reference must be connected when the real component requires ground.
- Logic and analog signals must travel through actual wires.
- Loads must only activate when their complete electrical path exists.
- No example should depend on hidden hard-coded links between components.
