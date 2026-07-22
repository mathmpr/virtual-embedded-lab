import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeProjectCode } from '../../apps/web/js/project-serializer.js';
import { compileArduinoFirmware, runArduinoFirmware } from '../../apps/web/js/simulation/firmware-engine.js';
import { ArduinoRuntime } from '../../apps/web/js/simulation/arduino-runtime.js';
import { runLegacyIrProjectSimulation } from '../../apps/web/js/simulation/legacy-ir-simulation.js';
import {
  createProjectMultiWasmSimulationSession,
  createProjectWasmSimulationSession
} from '../../apps/web/js/simulation/simulation-engine.js';
import { EventScheduler, VirtualClock } from '../../apps/web/js/simulation/virtual-time.js';

const root = new URL('../..', import.meta.url).pathname;
const referenceCode = normalizeProjectCode(JSON.parse(
  readFileSync(join(root, 'examples/hc-sr04-led-distance/project.json'), 'utf8')
).code.files['main.ino']);

test('firmware engine compiles Arduino setup and loop into executable IR', () => {
  const firmware = compileArduinoFirmware(referenceCode);

  assert.deepEqual(firmware.diagnostics, []);
  assert.equal(firmware.program.pins.trigger, 7);
  assert.equal(firmware.program.pins.echo, 6);
  assert.equal(firmware.program.pins.led, 13);
  assert.ok(firmware.program.setup.length > 0);
  assert.ok(firmware.program.loop.length > 0);
});

test('firmware engine runs Arduino calls, variables, if and checkpoints', () => {
  const firmware = compileArduinoFirmware(referenceCode);
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const graph = {
    driveArduinoPin() {}
  };
  const runtime = new ArduinoRuntime(clock, scheduler, graph);

  scheduler.scheduleIn(112, () => runtime.driveInput(6, 'HIGH'));
  scheduler.scheduleIn(3012, () => runtime.driveInput(6, 'LOW'));

  const result = runArduinoFirmware(runtime, firmware.program);

  assert.equal(result.echoDuration, 2900);
  assert.equal(result.distanceCm, 50);
  assert.equal(result.ledValue, 'HIGH');
  assert.equal(runtime.getPin(13).value, 'HIGH');
  assert.ok(result.checkpoints.some((checkpoint) => checkpoint.label === 'after-loop'));
  assert.equal(runtime.getSerialSnapshot().baudRate, 115200);
  assert.match(runtime.getSerialSnapshot().events.map((event) => event.data).join('\n'), /LED ON - distancia cm:/);
});

test('firmware engine supports Serial baud rates and RX/TX logs', () => {
  const firmware = compileArduinoFirmware(`
    void setup() {
      Serial.begin(9600);
      Serial.println("ready");
    }

    void loop() {
      if (Serial.available() > 0) {
        int byteValue = Serial.read();
        Serial.print(byteValue);
      }
    }
  `);
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });

  runtime.serialReceive({ data: 'A', baudRate: 57600 });
  runArduinoFirmware(runtime, firmware.program);

  const serial = runtime.getSerialSnapshot();

  assert.equal(serial.baudRate, 9600);
  assert.ok(serial.supportedBaudRates.includes(115200));
  assert.equal(serial.events[0].baudRate, 57600);
  assert.deepEqual(serial.events.map((event) => event.direction), ['RX', 'TX', 'TX', 'TX']);
  assert.equal(serial.events[2].data, 'ready\n');
  assert.equal(serial.events[3].data, '65');
});

test('firmware engine supports ESP32 WiFi station and access point calls', () => {
  const firmware = compileArduinoFirmware(`
    #include <WiFi.h>

    void setup() {
      Serial.begin(115200);
      WiFi.mode(WIFI_STA);
      WiFi.begin("VirtualLab", "secret");
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("wifi ok");
        Serial.println(WiFi.RSSI());
      }
    }

    void loop() {
      int networks = WiFi.scanNetworks();
      if (networks > 0) {
        WiFi.softAP("VirtualLab-AP", "secret");
      }
    }
  `);
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });

  runtime.configureWifiEnvironment({
    ssid: 'VirtualLab',
    connected: true,
    strengthPercent: 75
  });
  const result = runArduinoFirmware(runtime, firmware.program);
  const wifi = runtime.getWifiSnapshot();

  assert.deepEqual(firmware.diagnostics, []);
  assert.equal(result.wifi.connected, true);
  assert.equal(wifi.mode, 'ap');
  assert.equal(wifi.status, 3);
  assert.equal(wifi.rssi, -51);
  assert.equal(wifi.accessPoint.ssid, 'VirtualLab-AP');
  assert.match(runtime.getSerialSnapshot().events.map((event) => event.data).join('\n'), /wifi ok/);
});

test('WiFi internet availability does not define signal strength or AP association', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });

  runtime.configureWifiEnvironment({
    ssid: 'VirtualLab',
    internetAvailable: false,
    strengthPercent: 80
  });

  assert.equal(runtime.wifiBegin('VirtualLab', 'secret'), 3);
  assert.equal(runtime.wifiStatus(), 3);
  assert.equal(runtime.wifiScanNetworks(), 1);
  assert.equal(runtime.wifiRssi(), -48);
  assert.equal(runtime.getWifiSnapshot().environment.internetAvailable, false);
});

test('project simulation does not require distance controls for ESP32 WiFi projects', () => {
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const result = runLegacyIrProjectSimulation({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }],
        ['wifi-1', {
          id: 'wifi-1',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'VirtualLab',
            connected: true,
            strengthPercent: 80
          }
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    code: `
      #include <WiFi.h>

      void setup() {
        Serial.begin(115200);
        WiFi.begin("VirtualLab", "secret");
      }

      void loop() {
        Serial.println(WiFi.RSSI());
      }
    `
  });

  assert.doesNotMatch(result.diagnostics.join('\n'), /Nenhum controle de distância/);
  assert.match(result.serial.events.map((event) => event.data).join(''), /-/);
});

test('firmware engine supports LED_BUILTIN as Arduino UNO digital pin 13', () => {
  const firmware = compileArduinoFirmware(`
    void setup() {
      pinMode(LED_BUILTIN, OUTPUT);
    }

    void loop() {
      digitalWrite(LED_BUILTIN, HIGH);
    }
  `);
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });
  const result = runArduinoFirmware(runtime, firmware.program);

  assert.deepEqual(firmware.diagnostics, []);
  assert.equal(runtime.getPin(13).value, 'HIGH');
  assert.equal(result.pinStates[13].value, 'HIGH');
});

test('project simulation resolves ESP32 LED_BUILTIN from board manifest GPIO2', () => {
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const result = runLegacyIrProjectSimulation({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    code: `
      void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
      }

      void loop() {
        digitalWrite(LED_BUILTIN, HIGH);
      }
    `
  });

  assert.equal(result.firmwareResult.pinStates[2].value, 'HIGH');
  assert.equal(result.builtInLedStates.get('esp32-1.led_builtin'), true);
});

test('project simulation runs repeated loop iterations and records blink pin events', () => {
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const result = runLegacyIrProjectSimulation({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    code: `
      void setup() {
        pinMode(PIN, OUTPUT);
      }

      void loop() {
        digitalWrite(PIN, HIGH);
        delay(1000);
        digitalWrite(PIN, LOW);
        delay(1000);
      }
    `
  });
  const ledEvents = result.builtInLedEvents.filter((event) => event.ledId === 'led_builtin');

  assert.equal(result.firmwareResult.pinStates[2].value, 'LOW');
  assert.equal(ledEvents.length, 6);
  assert.deepEqual(ledEvents.map((event) => event.value), [true, false, true, false, true, false]);
  assert.equal(ledEvents[1].timeUs, 1000000);
});

test('counter blink example runs through WASM with persisted increment state', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const { runWasmFirmware } = await import('../../apps/web/js/simulation/wasm-firmware-runner.js');
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-counter-blink/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });
  const result = await runWasmFirmware(runtime, wasm.wasmBase64, { loopIterations: 10 });
  const pinEvents = result.pinEvents.filter((event) => event.pin === 2);

  assert.equal(wasm.ok, true);
  assert.deepEqual(pinEvents.map((event) => event.value), ['LOW', 'HIGH', 'LOW']);
  assert.equal(pinEvents[1].timeUs, 2250000);
  assert.equal(pinEvents[2].timeUs, 6250000);
  assert.match(runtime.getSerialSnapshot().events.map((event) => event.data).join(''), /counter: 10/);
});

test('counter blink WASM session persists globals across simulation frames', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-counter-blink/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const first = session.runFrame();
  const second = session.runFrame();
  const serial = [...first.serial.events, ...second.serial.events].map((event) => event.data).join('');

  assert.match(serial, /counter: 3/);
  assert.match(serial, /counter: 6/);
});

test('Arduino Serial LED example reacts to RX on and off commands through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-serial-led/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 13
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  session.runFrame();
  const onResult = session.runFrame({ serialRx: [{ data: 'on', baudRate: 115200 }] });
  const offResult = session.runFrame({ serialRx: [{ data: 'off', baudRate: 115200 }] });

  assert.equal(wasm.ok, true);
  assert.equal(onResult.firmwareResult.pinStates[13].value, 'HIGH');
  assert.match(serialText(onResult), /LED ON/);
  assert.equal(offResult.firmwareResult.pinStates[13].value, 'LOW');
  assert.match(serialText(offResult), /LED OFF/);
});

test('Arduino Serial bridge example routes TX to another board RX through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-serial-bridge-led/project.json'), 'utf8'));
  const wasmByComponentId = new Map();

  for (const componentId of ['arduino-1', 'arduino-2']) {
    const firmware = project.firmwares[componentId];
    const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(firmware.files[firmware.entry]), {
      constants: {
        LED_BUILTIN: 13
      }
    });

    assert.equal(wasm.ok, true, componentId);
    wasmByComponentId.set(componentId, wasm);
  }

  const session = await createProjectMultiWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['arduino-2', officialComponent('arduino-2', 'arduino', {})],
        ['resistor-1', officialComponent('resistor-1', 'resistor', { resistanceOhms: 220 })],
        ['led-1', officialComponent('led-1', 'led', {})]
      ])
    },
    nets: project.connections.map((connection) => ({
      id: connection.id,
      terminals: connection.terminals.map((reference) => {
        const [componentId, terminalId] = reference.split('.');
        return { componentId, terminalId };
      })
    })),
    terminalKind(terminal) {
      if (/gnd/.test(terminal.terminalId)) {
        return 'ground';
      }

      if (/5v|3v3/.test(terminal.terminalId)) {
        return 'power';
      }

      return 'signal';
    },
    wasmByComponentId
  });

  session.runFrame();
  const firstPing = session.runFrame({ serialRx: [{ targetComponentId: 'arduino-1', data: 'ping', baudRate: 115200 }] });
  const secondPing = session.runFrame({ serialRx: [{ targetComponentId: 'arduino-1', data: 'ping', baudRate: 115200 }] });

  assert.equal(firstPing.ledStates.get('led-1'), true);
  assert.match(serialText(firstPing), /pong/);
  assert.match(serialText(firstPing), /LED ON/);
  assert.equal(secondPing.ledStates.get('led-1'), false);
  assert.match(serialText(secondPing), /LED OFF/);
});

test('ESP32 WiFi example runs through WASM and reads signal environment', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-wifi-signal/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }],
        ['wifi-1', {
          id: 'wifi-1',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'VirtualLab',
            connected: true,
            strengthPercent: 82
          }
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();
  const serial = serialText(result);

  assert.equal(wasm.ok, true);
  assert.equal(result.source, 'wasm');
  assert.equal(result.firmwareResult.wifi.connected, true);
  assert.equal(result.firmwareResult.wifi.rssi, -47);
  assert.match(serial, /Wi-Fi connected/);
  assert.match(serial, /RSSI dBm: -47/);
});

test('ESP32 WiFi failover example chooses strongest network with internet through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-wifi-failover/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['esp32-1', {
          id: 'esp32-1',
          type: 'esp32-devkit',
          behavior: esp32.behavior,
          properties: {}
        }],
        ['wifi-fiber', {
          id: 'wifi-fiber',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'Lab-Fiber',
            connected: false,
            strengthPercent: 95
          }
        }],
        ['wifi-mesh', {
          id: 'wifi-mesh',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'Lab-Mesh',
            connected: true,
            strengthPercent: 74
          }
        }],
        ['wifi-guest', {
          id: 'wifi-guest',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'Guest-IoT',
            connected: true,
            strengthPercent: 42
          }
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();
  const serial = serialText(result);

  assert.equal(wasm.ok, true);
  assert.equal(result.source, 'wasm');
  assert.equal(result.firmwareResult.wifi.connected, true);
  assert.equal(result.firmwareResult.wifi.ssid, 'Lab-Mesh');
  assert.equal(result.firmwareResult.wifi.rssi, -52);
  assert.match(serial, /Tentando SSID: Lab-Fiber RSSI: -38/);
  assert.match(serial, /Sem internet em: Lab-Fiber/);
  assert.match(serial, /Internet ativa em: Lab-Mesh RSSI: -52/);
});

test('HC-SR04 example runs through WASM and reads the distance input', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const wasm = await compileFirmwareWasmWithClang(referenceCode);

  assert.equal(wasm.ok, true);
  assert.ok(wasm.constantExports.includes('TRIGGER_PIN'));
  assert.ok(wasm.constantExports.includes('ECHO_PIN'));

  const near = await runHcsr04WasmDistance(wasm.wasmBase64, 50);
  const far = await runHcsr04WasmDistance(wasm.wasmBase64, 150);

  assert.match(serialText(near), /LED ON - distancia cm:/);
  assert.match(serialText(far), /LED OFF - distancia cm:/);
});

test('HC-SR04 WASM session updates distance without resetting virtual time', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const wasm = await compileFirmwareWasmWithClang(referenceCode);
  const session = await createHcsr04WasmSession(wasm.wasmBase64, 150);

  const first = session.runFrame();
  session.updateDistanceValue('distance-1', 50);
  const second = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.ok(second.timeUs > first.timeUs);
  assert.match(serialText(first), /LED OFF - distancia cm:/);
  assert.match(serialText(second), /LED ON - distancia cm:/);
});

test('FC-37 rain WASM session updates rain without resetting virtual time', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/fc-37-rain-digital/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['rain-sensor-1', officialComponent('rain-sensor-1', 'fc37-rain-sensor', {
            activeLow: true
        })],
        ['rain-1', officialComponent('rain-1', 'rain-toggle', {
            active: false,
            intensityPercent: 100
        })]
      ])
    },
    nets: [
      {
        id: 'net-rain-do',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd7' },
          { componentId: 'rain-sensor-1', terminalId: 'do' }
        ]
      }
    ],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const dry = session.runFrame();
  session.updateRainValue('rain-1', { active: true, intensityPercent: 100 });
  const wet = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.ok(wet.timeUs > dry.timeUs);
  assert.match(serialText(dry), /NO RAIN/);
  assert.match(serialText(wet), /RAIN DETECTED/);
  assert.equal(dry.signals.rain, 0);
  assert.equal(wet.signals.rain, 1);
  assert.equal(wet.signals.rainDo, 0);
});

test('LDR light WASM session updates analogRead without resetting virtual time', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/ldr-light-analog/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['ldr-1', officialComponent('ldr-1', 'ldr-light-sensor', {
            darkResistanceOhms: 100000,
            brightResistanceOhms: 1000,
            gamma: 0.7
        })],
        ['resistor-1', officialComponent('resistor-1', 'resistor', {
            resistanceOhms: 10000
        })],
        ['light-1', officialComponent('light-1', 'light-level', {
            enabled: true,
            intensityPercent: 0
        })]
      ])
    },
    nets: [
      {
        id: 'net-vcc',
        terminals: [
          { componentId: 'arduino-1', terminalId: '5v' },
          { componentId: 'ldr-1', terminalId: 'a' }
        ]
      },
      {
        id: 'net-mid',
        terminals: [
          { componentId: 'ldr-1', terminalId: 'b' },
          { componentId: 'arduino-1', terminalId: 'a0' },
          { componentId: 'resistor-1', terminalId: 'a' }
        ]
      },
      {
        id: 'net-gnd',
        terminals: [
          { componentId: 'resistor-1', terminalId: 'b' },
          { componentId: 'arduino-1', terminalId: 'gnd' }
        ]
      }
    ],
    terminalKind(terminal) {
      if (terminal.terminalId === '5v') {
        return 'power';
      }

      if (terminal.terminalId === 'gnd') {
        return 'ground';
      }

      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const dark = session.runFrame();
  session.updateLightValue('light-1', { enabled: true, intensityPercent: 100 });
  const bright = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.ok(bright.timeUs > dark.timeUs);
  assert.match(serialText(dark), /DARK/);
  assert.match(serialText(bright), /BRIGHT/);
  assert.ok(dark.signals.lightAnalog < 0.3);
  assert.ok(bright.signals.lightAnalog > 0.7);
});

test('BMP280 WASM session updates climate readings without resetting virtual time', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/bmp280-weather-i2c/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['bmp280-1', officialComponent('bmp280-1', 'bmp280-sensor', {
            i2cAddress: 118,
            temperatureOffsetC: 0,
            pressureOffsetHpa: 0
        })],
        ['climate-1', officialComponent('climate-1', 'climate-environment', {
            enabled: true,
            temperatureC: 20,
            pressureHpa: 1013.25
        })]
      ])
    },
    nets: [
      {
        id: 'net-sda',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'a4' },
          { componentId: 'bmp280-1', terminalId: 'sda' }
        ]
      },
      {
        id: 'net-scl',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'a5' },
          { componentId: 'bmp280-1', terminalId: 'scl' }
        ]
      }
    ],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  const normal = session.runFrame();
  session.updateClimateValue('climate-1', { enabled: true, temperatureC: 35, pressureHpa: 1000 });
  const hot = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.ok(hot.timeUs > normal.timeUs);
  assert.match(serialText(normal), /Temperature C: 20/);
  assert.match(serialText(normal), /Pressure hPa: 1013\.25/);
  assert.match(serialText(hot), /Temperature C: 35/);
  assert.match(serialText(hot), /Pressure hPa: 1000/);
});

test('external ADC WASM sessions update analog source without resetting virtual time', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const cases = [
    {
      example: 'examples/ads1115-single-ended/project.json',
      adcId: 'ads1115-1',
      adcType: 'ads1115-adc',
      adcProps: { i2cAddress: 72, gain: '2.048V' },
      channelTerminal: 'a0',
      expectedLow: /ADS1115 A0 raw: 16384/,
      expectedHigh: /ADS1115 A0 raw: 32767/
    },
    {
      example: 'examples/ads1015-single-ended/project.json',
      adcId: 'ads1015-1',
      adcType: 'ads1015-adc',
      adcProps: { i2cAddress: 72, gain: '2.048V' },
      channelTerminal: 'a0',
      expectedLow: /ADS1015 A0 raw: 1024/,
      expectedHigh: /ADS1015 A0 raw: 2047/
    },
    {
      example: 'examples/mcp3008-single-ended/project.json',
      adcId: 'mcp3008-1',
      adcType: 'mcp3008-adc',
      adcProps: { referenceVoltageVolts: 5 },
      channelTerminal: 'ch0',
      expectedLow: /MCP3008 CH0 raw: 512/,
      expectedHigh: /MCP3008 CH0 raw: 1023/
    }
  ];

  for (const item of cases) {
    const project = JSON.parse(readFileSync(join(root, item.example), 'utf8'));
    const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
    const session = await createProjectWasmSimulationSession({
      state: {
        components: new Map([
          ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
          [item.adcId, officialComponent(item.adcId, item.adcType, item.adcProps)],
          ['analog-1', officialComponent('analog-1', 'analog-voltage-source', { enabled: true, voltageVolts: item.adcType === 'mcp3008-adc' ? 2.5 : 1.024 })]
        ])
      },
      nets: adcTestNets(item),
      terminalKind() {
        return 'signal';
      },
      wasmBase64: wasm.wasmBase64
    });

    const low = session.runFrame();
    session.updateAnalogVoltageValue('analog-1', { enabled: true, voltageVolts: 5 });
    const high = session.runFrame();

    assert.equal(wasm.ok, true, item.example);
    assert.ok(high.timeUs > low.timeUs, item.example);
    assert.match(serialText(low), item.expectedLow, item.example);
    assert.match(serialText(high), item.expectedHigh, item.example);
  }
});

test('pull-up button example toggles blue LED through WASM pulses', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-pull-up-button-toggle-blue-led/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 13
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['button-1', officialComponent('button-1', 'pull-up-button', { pressed: false, activeHigh: true })],
        ['resistor-1', officialComponent('resistor-1', 'resistor', { resistanceOhms: 220 })],
        ['led-1', officialComponent('led-1', 'led-blue', {})]
      ])
    },
    nets: [
      testNet('net-vcc', ['arduino-1.5v', 'button-1.vcc']),
      testNet('net-gnd', ['arduino-1.gnd', 'button-1.gnd', 'led-1.cathode']),
      testNet('net-button', ['arduino-1.d2', 'button-1.out']),
      testNet('net-led-drive', ['arduino-1.d13', 'resistor-1.a']),
      testNet('net-led-anode', ['resistor-1.b', 'led-1.anode'])
    ],
    terminalKind(terminal) {
      if (/gnd/.test(terminal.terminalId)) {
        return 'ground';
      }

      if (/5v|3v3|vcc/.test(terminal.terminalId)) {
        return 'power';
      }

      return 'signal';
    },
    wasmBase64: wasm.wasmBase64
  });

  session.runFrame();
  session.updateDigitalInputValue('button-1', true);
  const firstPress = session.runFrame();
  session.updateDigitalInputValue('button-1', false);
  session.runFrame();
  session.updateDigitalInputValue('button-1', true);
  const secondPress = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.equal(firstPress.ledStates.get('led-1'), true);
  assert.match(serialText(firstPress), /Blue LED ON/);
  assert.equal(secondPress.ledStates.get('led-1'), false);
  assert.match(serialText(secondPress), /Blue LED OFF/);
});

async function runHcsr04WasmDistance(wasmBase64, valueCm) {
  const session = await createHcsr04WasmSession(wasmBase64, valueCm);

  return session.runFrame();
}

function adcTestNets(item) {
  const nets = [
    {
      id: 'net-analog',
      terminals: [
        { componentId: 'analog-1', terminalId: 'out' },
        { componentId: item.adcId, terminalId: item.channelTerminal }
      ]
    }
  ];

  if (item.adcType === 'mcp3008-adc') {
    nets.push(
      {
        id: 'net-sck',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd13' },
          { componentId: item.adcId, terminalId: 'clk' }
        ]
      },
      {
        id: 'net-miso',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd12' },
          { componentId: item.adcId, terminalId: 'dout' }
        ]
      },
      {
        id: 'net-mosi',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd11' },
          { componentId: item.adcId, terminalId: 'din' }
        ]
      },
      {
        id: 'net-cs',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd10' },
          { componentId: item.adcId, terminalId: 'cs' }
        ]
      }
    );
    return nets;
  }

  nets.push(
    {
      id: 'net-sda',
      terminals: [
        { componentId: 'arduino-1', terminalId: 'a4' },
        { componentId: item.adcId, terminalId: 'sda' }
      ]
    },
    {
      id: 'net-scl',
      terminals: [
        { componentId: 'arduino-1', terminalId: 'a5' },
        { componentId: item.adcId, terminalId: 'scl' }
      ]
    }
  );

  return nets;
}

async function createHcsr04WasmSession(wasmBase64, valueCm) {
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['sensor-1', officialComponent('sensor-1', 'hcsr04', {})],
        ['distance-1', officialComponent('distance-1', 'distance', {
            valueCm
        })]
      ])
    },
    nets: [
      {
        id: 'net-trigger',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd7' },
          { componentId: 'sensor-1', terminalId: 'trigger' },
          { componentId: 'distance-1', terminalId: 'distance' }
        ]
      },
      {
        id: 'net-echo',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd6' },
          { componentId: 'sensor-1', terminalId: 'echo' }
        ]
      }
    ],
    terminalKind(terminal) {
      return terminal.componentId === 'distance-1' ? 'environment' : 'signal';
    },
    wasmBase64
  });

  return session;
}

function serialText(result) {
  return result.serial.events.map((event) => event.data).join('');
}

function testNet(id, references) {
  return {
    id,
    terminals: references.map((reference) => {
      const [componentId, terminalId] = reference.split('.');
      return { componentId, terminalId };
    })
  };
}

function officialComponent(id, type, properties) {
  const manifest = officialManifestByVisualType(type);

  return {
    id,
    type,
    behavior: manifest.behavior ?? {},
    simulation: manifest.simulation ?? {},
    electricalModel: manifest.electricalModel ?? null,
    electricalPrimitive: manifest.electricalModel?.primitive ?? null,
    propertySchema: manifest.properties ?? {},
    properties
  };
}

function officialManifestByVisualType(type) {
  const manifestPath = {
    'analog-voltage-source': 'components/official/analog-voltage-source/component.json',
    'ads1015-adc': 'components/official/ads1015/component.json',
    'ads1115-adc': 'components/official/ads1115/component.json',
    'arduino': 'components/official/arduino-uno/component.json',
    'bmp280-sensor': 'components/official/bmp280/component.json',
    'climate-environment': 'components/official/climate/component.json',
    'distance': 'components/official/distance-range/component.json',
    'fc37-rain-sensor': 'components/official/fc-37-rain-sensor/component.json',
    'hcsr04': 'components/official/hc-sr04/component.json',
    'ldr-light-sensor': 'components/official/ldr-light-sensor/component.json',
    'led': 'components/official/led-red/component.json',
    'led-blue': 'components/official/led-blue/component.json',
    'light-level': 'components/official/light-level/component.json',
    'mcp3008-adc': 'components/official/mcp3008/component.json',
    'pull-up-button': 'components/official/pull-up-button/component.json',
    'rain-toggle': 'components/official/rain-toggle/component.json',
    'resistor': 'components/official/resistor/component.json'
  }[type];

  if (!manifestPath) {
    throw new Error(`Fixture sem manifest oficial mapeado: ${type}`);
  }

  return JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
}
