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

test('virtual TCP HTTP supports common methods, query and request body', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });

  runtime.configureWifiEnvironment({
    ssid: 'VirtualLab',
    internetAvailable: true,
    strengthPercent: 80
  });
  runtime.wifiBegin('VirtualLab', 'secret');

  const cases = [
    {
      request: 'GET /todos/1?title=virtual&completed=true HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nConnection: close\r\n\r\n',
      expectedStatus: /HTTP\/1\.1 200 OK/,
      expectedBody: /"query":\{"title":"virtual","completed":"true"\}/
    },
    {
      request: 'POST /todos?source=esp32 HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{"title":"new"}',
      expectedStatus: /HTTP\/1\.1 201 Created/,
      expectedBody: /"received":"\{\\"title\\":\\"new\\"\}"/
    },
    {
      request: 'PUT /todos/1 HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nContent-Length: 18\r\nConnection: close\r\n\r\n{"completed":true}',
      expectedStatus: /HTTP\/1\.1 200 OK/,
      expectedBody: /"method":"PUT"/
    },
    {
      request: 'PATCH /todos/1 HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nContent-Length: 16\r\nConnection: close\r\n\r\n{"title":"edit"}',
      expectedStatus: /HTTP\/1\.1 200 OK/,
      expectedBody: /"method":"PATCH"/
    },
    {
      request: 'DELETE /todos/1?force=true HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nConnection: close\r\n\r\n',
      expectedStatus: /HTTP\/1\.1 200 OK/,
      expectedBody: /"deleted":true/
    },
    {
      request: 'OPTIONS /todos/1 HTTP/1.1\r\nHost: jsonplaceholder.typicode.com\r\nConnection: close\r\n\r\n',
      expectedStatus: /HTTP\/1\.1 204 No Content/,
      expectedBody: /Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS/
    }
  ];

  for (const item of cases) {
    assert.equal(runtime.tcpConnect('jsonplaceholder.typicode.com', 443), 1);
    runtime.tcpPrint(item.request);

    const response = drainTcpResponse(runtime);

    assert.match(response, item.expectedStatus);
    assert.match(response, item.expectedBody);
  }
});

test('virtual TCP HTTP supports project routes, HEAD and chunked body', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} }, {
    http: {
      hosts: {
        'api.local': {
          routes: [
            {
              method: 'GET',
              path: '/status',
              statusCode: 200,
              body: { ok: true }
            },
            {
              method: 'POST',
              path: '/events',
              statusCode: 202,
              reason: 'Accepted',
              body: { stored: true }
            }
          ]
        }
      }
    }
  });

  runtime.configureWifiEnvironment({
    ssid: 'VirtualLab',
    internetAvailable: true,
    strengthPercent: 80
  });
  runtime.wifiBegin('VirtualLab', 'secret');

  assert.equal(runtime.tcpConnect('api.local', 80), 1);
  runtime.tcpPrint('HEAD /status HTTP/1.1\r\nHost: api.local\r\nConnection: close\r\n\r\n');
  const head = drainTcpResponse(runtime);

  assert.match(head, /HTTP\/1\.1 200 OK/);
  assert.match(head, /Content-Length: 0/);
  assert.doesNotMatch(head, /\{"ok":true\}/);

  assert.equal(runtime.tcpConnect('api.local', 80), 1);
  runtime.tcpPrint('POST /events HTTP/1.1\r\nHost: api.local\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\nping\r\n0\r\n\r\n');
  const post = drainTcpResponse(runtime);

  assert.match(post, /HTTP\/1\.1 202 Accepted/);
  assert.match(post, /"stored":true/);

  assert.equal(runtime.tcpConnect('api.local', 80), 1);
  runtime.tcpPrint('OPTIONS /status HTTP/1.1\r\nHost: api.local\r\nConnection: close\r\n\r\n');
  const options = drainTcpResponse(runtime);

  assert.match(options, /HTTP\/1\.1 204 No Content/);
  assert.match(options, /Allow: GET, HEAD, OPTIONS/);
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

test('WASM Arduino random avoids low-bit modulo cycles', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const { runWasmFirmware } = await import('../../apps/web/js/simulation/wasm-firmware-runner.js');
  const wasm = await compileFirmwareWasmWithClang(`
    void setup() {
      Serial.begin(9600);
      randomSeed(1);
    }

    void loop() {
      Serial.println((int)random(0, 4));
    }
  `, { cache: false });
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });
  const result = await runWasmFirmware(runtime, wasm.wasmBase64, { loopIterations: 8 });
  const values = result.serial.events
    .filter((event) => event.type === 'data')
    .map((event) => event.data.trim())
    .filter(Boolean);

  assert.equal(wasm.ok, true);
  assert.deepEqual(values, ['3', '0', '0', '3', '0', '1', '2', '0']);
  assert.notDeepEqual(values.slice(0, 4), ['3', '0', '1', '2']);
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

  assert.match(serial, /counter: 1/);
  assert.match(serial, /counter: 2/);
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

test('ESP32 WiFi TCP example fetches virtual JSONPlaceholder response through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp32 = JSON.parse(readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-wifi-tcp-jsonplaceholder/project.json'), 'utf8'));
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
            strengthPercent: 86
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
  assert.match(serial, /Wi-Fi connected with internet/);
  assert.match(serial, /TCP connected/);
  assert.match(serial, /\{"userId":1,"id":1,"title":"delectus aut autem","completed":false\}/);
});

test('ESP8266 MQTT example connects to virtual broker through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp8266 = JSON.parse(readFileSync(join(root, 'components/official/esp8266-nodemcu/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const code = normalizeProjectCode(`
    #include <ESP8266WiFi.h>
    #include <AsyncMqttClient.h>
    #include <SimpleTimer.h>

    #define LED_PIN 2

    AsyncMqttClient mqttClient;
    SimpleTimer keepAliveTimer;
    bool enabledWaterPump = false;
    int keepAliveCount = 0;

    void onLed() { digitalWrite(LED_PIN, LOW); }
    void offLed() { digitalWrite(LED_PIN, HIGH); }

    void publishStatus() {
      if (enabledWaterPump) {
        mqttClient.publish("on_off/water", 0, false, "secret:asker:manual:1");
        Serial.println("MQTT publish on_off/water manual:1");
      }
    }

    void publishKeepAlive() {
      if (mqttClient.connected()) {
        keepAliveCount++;
        mqttClient.publish("keep/alive", 0, false, "secret:asker");
        Serial.print("MQTT keepalive #");
        Serial.println(keepAliveCount);
      }
    }

    void onMqttConnect(bool sessionPresent) {
      Serial.println("MQTT On!");
      onLed();
      mqttClient.subscribe("toggle/water", 0);
      publishKeepAlive();
    }

    void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
      Serial.println("MQTT Off!");
      offLed();
    }

    void onMqttMessage(char *topic, char *payload, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total) {
      Serial.print("MQTT RX ");
      Serial.print(topic);
      Serial.print(" ");
      for (size_t i = 0; i < len; i++) {
        Serial.write(payload[i]);
      }
      Serial.println();
      if (topic[0] == 't' && payload[0] == '1') {
        enabledWaterPump = true;
        publishStatus();
      }
    }

    void setup() {
      Serial.begin(9600);
      pinMode(LED_PIN, OUTPUT);
      offLed();
      WiFi.mode(WIFI_STA);
      WiFi.begin("VirtualLab", "secret");
      if (WiFi.status() == WL_CONNECTED && WiFi.internetAvailable()) {
        Serial.println("Wi-Fi connected with internet");
      }
      mqttClient.onConnect(onMqttConnect);
      mqttClient.onDisconnect(onMqttDisconnect);
      mqttClient.onMessage(onMqttMessage);
      mqttClient.setServer("mqtt.local", 1883);
      keepAliveTimer.setInterval(8300, publishKeepAlive);
      mqttClient.connect();
    }

    void loop() {
      keepAliveTimer.run();
      delay(1000);
    }
  `);
  const network = {
    mqtt: {
      brokers: {
        'mqtt.local': {
          port: 1883,
          online: true,
          messages: [
            { topic: 'toggle/water', payload: '1' }
          ]
        }
      }
    }
  };
  const wasm = await compileFirmwareWasmWithClang(code, {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['esp8266-1', {
          id: 'esp8266-1',
          type: 'esp8266-nodemcu',
          behavior: esp8266.behavior,
          properties: {}
        }],
        ['wifi-1', {
          id: 'wifi-1',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'VirtualLab',
            connected: true,
            strengthPercent: 88
          }
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64,
    network
  });

  const frames = Array.from({ length: 10 }, () => session.runFrame());
  const last = frames.at(-1);
  const serial = frames.map(serialText).join('');
  const publishedTopics = last.firmwareResult.mqtt.published.map((message) => message.topic);

  assert.equal(wasm.ok, true);
  assert.match(serial, /Wi-Fi connected with internet/);
  assert.match(serial, /MQTT On!/);
  assert.match(serial, /MQTT RX toggle\/water 1/);
  assert.match(serial, /MQTT publish on_off\/water manual:1/);
  assert.match(serial, /MQTT keepalive #1/);
  assert.match(serial, /MQTT keepalive #2/);
  assert.ok(publishedTopics.filter((topic) => topic === 'keep/alive').length >= 2);
  assert.ok(publishedTopics.includes('on_off/water'));
  assert.equal(last.builtInLedStates.get('esp8266-1.led_builtin'), true);
});

test('WASM AsyncMqttClient drains queued MQTT messages on poll', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const esp8266 = JSON.parse(readFileSync(join(root, 'components/official/esp8266-nodemcu/component.json'), 'utf8'));
  const wifiSignal = JSON.parse(readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8'));
  const code = normalizeProjectCode(`
    #include <ESP8266WiFi.h>
    #include <AsyncMqttClient.h>

    AsyncMqttClient mqtt;

    void onMqttMessage(char *topic, char *data, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total)
    {
        digitalWrite(14, len > 0 && data[0] == '1' ? LOW : HIGH);
    }

    void setup()
    {
        WiFi.mode(WIFI_STA);
        WiFi.begin("VirtualLab", "secret");
        pinMode(14, OUTPUT);
        digitalWrite(14, HIGH);
        mqtt.setServer("mqtt.local", 1883);
        mqtt.onMessage(onMqttMessage);
        mqtt.connect();
        mqtt.subscribe("toggle/water", 0);
    }

    void loop()
    {
        mqtt.connected();
        delay(1000);
    }
  `);
  const wasm = await compileFirmwareWasmWithClang(code, {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['esp8266-1', {
          id: 'esp8266-1',
          type: 'esp8266-nodemcu',
          behavior: esp8266.behavior,
          properties: {}
        }],
        ['wifi-1', {
          id: 'wifi-1',
          type: 'wifi-signal',
          behavior: wifiSignal.behavior,
          properties: {
            ssid: 'VirtualLab',
            connected: true,
            strengthPercent: 88
          }
        }]
      ])
    },
    nets: [],
    terminalKind() {
      return 'signal';
    },
    wasmBase64: wasm.wasmBase64,
    network: {
      mqtt: {
        brokers: {
          'mqtt.local': {
            online: true,
            messages: [
              { topic: 'toggle/water', payload: '1' },
              { topic: 'toggle/water', payload: '0' }
            ]
          }
        }
      }
    }
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.equal(result.firmwareResult.pinStates['14'].value, 'HIGH');
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

test('buzzer example updates buzzer visual state through WASM digitalWrite', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-buzzer-beep/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const components = new Map([
    ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
    ['buzzer-1', officialComponent('buzzer-1', 'buzzer', {
      active: false,
      inputLevel: 0,
      activeHigh: true,
      frequencyHz: 2000,
      volumePercent: 60,
      activeType: 'active'
    })]
  ]);
  const session = await createProjectWasmSimulationSession({
    state: {
      components
    },
    nets: [
      testNet('net-vcc', ['arduino-1.5v', 'buzzer-1.vcc']),
      testNet('net-gnd', ['arduino-1.gnd', 'buzzer-1.gnd']),
      testNet('net-sig', ['arduino-1.d8', 'buzzer-1.sig'])
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

  const result = session.runFrame();
  const buzzer = components.get('buzzer-1');

  assert.equal(wasm.ok, true);
  assert.match(serialText(result), /Buzzer ON/);
  assert.equal(buzzer?.properties.active, true);
  assert.equal(buzzer?.properties.inputLevel, 1);
});

test('LCD 16x2 I2C example updates display buffer through WASM library shim', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-lcd-16x2-i2c-counter/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const lcd = officialComponent('lcd-1', 'lcd-16x2-i2c', {
    i2cAddress: 39,
    columns: 16,
    rows: 2,
    backlight: true,
    line1: '',
    line2: ''
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['lcd-1', lcd]
      ])
    },
    nets: [
      testNet('net-vcc', ['arduino-1.5v', 'lcd-1.vcc']),
      testNet('net-gnd', ['arduino-1.gnd', 'lcd-1.gnd']),
      testNet('net-sda', ['arduino-1.a4', 'lcd-1.sda']),
      testNet('net-scl', ['arduino-1.a5', 'lcd-1.scl'])
    ],
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(wasm.libraries.join(','), /liquid-crystal-i2c/);
  assert.equal(lcd.properties.line1, 'Virtual Lab');
  assert.match(lcd.properties.line2, /^Count: 0/);
  assert.equal(lcd.properties.backlight, true);
  assert.match(serialText(result), /LCD count: 0/);
});

test('7-segment counter example derives active segments from WASM digitalWrite pins', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-seven-segment-counter/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const display = officialComponent('display-1', 'seven-segment-display', {
    commonType: 'cathode',
    forwardVoltageVolts: 2,
    recommendedCurrentAmps: 0.01,
    segmentA: false,
    segmentB: false,
    segmentC: false,
    segmentD: false,
    segmentE: false,
    segmentF: false,
    segmentG: false,
    segmentDp: false
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['display-1', display]
      ])
    },
    nets: [
      testNet('net-gnd', ['arduino-1.gnd', 'display-1.com1', 'display-1.com2']),
      testNet('net-a', ['arduino-1.d2', 'display-1.a']),
      testNet('net-b', ['arduino-1.d3', 'display-1.b']),
      testNet('net-c', ['arduino-1.d4', 'display-1.c']),
      testNet('net-d', ['arduino-1.d5', 'display-1.d']),
      testNet('net-e', ['arduino-1.d6', 'display-1.e']),
      testNet('net-f', ['arduino-1.d7', 'display-1.f']),
      testNet('net-g', ['arduino-1.d8', 'display-1.g']),
      testNet('net-dp', ['arduino-1.d9', 'display-1.dp'])
    ],
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(serialText(result), /Digit: 0/);
  assert.equal(display.properties.segmentA, true);
  assert.equal(display.properties.segmentB, true);
  assert.equal(display.properties.segmentC, true);
  assert.equal(display.properties.segmentD, true);
  assert.equal(display.properties.segmentE, true);
  assert.equal(display.properties.segmentF, true);
  assert.equal(display.properties.segmentG, false);
  assert.equal(display.properties.segmentDp, false);
});

test('74HC595 example drives a 7-segment display through shiftOut', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-74hc595-seven-segment-counter/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const shift = officialComponent('shift-1', 'shift-register-74hc595', {
    latchedValue: 0,
    shiftValue: 0,
    outputEnabled: true,
    clearActiveLow: true,
    q0: false,
    q1: false,
    q2: false,
    q3: false,
    q4: false,
    q5: false,
    q6: false,
    q7: false
  });
  const display = officialComponent('display-1', 'seven-segment-display', {
    commonType: 'cathode',
    forwardVoltageVolts: 2,
    recommendedCurrentAmps: 0.01,
    segmentA: false,
    segmentB: false,
    segmentC: false,
    segmentD: false,
    segmentE: false,
    segmentF: false,
    segmentG: false,
    segmentDp: false
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['shift-1', shift],
        ['display-1', display]
      ])
    },
    nets: project.connections.map((connection) => testNet(connection.id, connection.terminals)),
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(serialText(result), /Shift digit: 0/);
  assert.equal(shift.properties.latchedValue, 0b00111111);
  assert.equal(display.properties.segmentA, true);
  assert.equal(display.properties.segmentB, true);
  assert.equal(display.properties.segmentC, true);
  assert.equal(display.properties.segmentD, true);
  assert.equal(display.properties.segmentE, true);
  assert.equal(display.properties.segmentF, true);
  assert.equal(display.properties.segmentG, false);
  assert.equal(display.properties.segmentDp, false);
});

test('ESP32 Simon Says example compiles and drives score display, LEDs and buzzer through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/esp32-simon-says/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const componentTypeById = {
    'board.esp32.devkit': 'esp32-devkit',
    'electronic.led.red': 'led-red',
    'electronic.led.green': 'led-green',
    'electronic.led.blue': 'led-blue',
    'electronic.led.yellow': 'led-yellow',
    'electronic.resistor': 'resistor',
    'input.button.pull-up': 'pull-up-button',
    'actuator.buzzer': 'buzzer',
    'ic.shift-register.74hc595': 'shift-register-74hc595',
    'display.led.7segment': 'seven-segment-display'
  };
  const components = new Map(project.components.map((component) => [
    component.id,
    officialComponent(component.id, componentTypeById[component.componentId], component.properties ?? {})
  ]));
  const session = await createProjectWasmSimulationSession({
    state: {
      components
    },
    nets: project.connections.map((connection) => testNet(connection.id, connection.terminals)),
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const initial = session.runFrame();
  const sequenceStart = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(serialText(initial), /Simon Says ready/);
  assert.match(serialText(initial), /Round 1/);
  assert.doesNotMatch(serialText(initial), /Game over/);
  assert.equal(components.get('shift-high')?.properties.latchedValue, 0b00111111);
  assert.equal(components.get('shift-low')?.properties.latchedValue, 0b00111111);
  assert.ok(sequenceStart.ledEvents.some((event) => event.componentId === 'led-yellow' && event.value === true));
  assert.equal(components.get('buzzer-1')?.properties.active, true);

  for (let frame = 0; frame < 20; frame++) {
    session.runFrame();
  }

  session.updateDigitalInputValue('button-yellow', true);
  const pressed = session.runFrame();

  assert.ok(pressed.ledEvents.some((event) => event.componentId === 'led-yellow' && event.value === true));
  assert.equal(components.get('buzzer-1')?.properties.active, true);

  const feedbackFrames = [];
  for (let frame = 0; frame < 12; frame++) {
    feedbackFrames.push(session.runFrame());
  }

  assert.ok(feedbackFrames.some((frame) => frame.ledEvents.some((event) => event.componentId === 'led-yellow' && event.value === false)));
  assert.doesNotMatch(feedbackFrames.map(serialText).join(''), /Game over/);

  for (let frame = 0; frame < 28; frame++) {
    session.runFrame();
  }

  assert.equal(components.get('shift-high')?.properties.latchedValue, 0b00111111);
  assert.equal(components.get('shift-low')?.properties.latchedValue, 0b00000110);
  assert.equal(components.get('display-low')?.properties.segmentA, false);
  assert.equal(components.get('display-low')?.properties.segmentB, true);
  assert.equal(components.get('display-low')?.properties.segmentC, true);
  assert.equal(components.get('display-low')?.properties.segmentD, false);
});

test('DHT22 example reads climate temperature and humidity through WASM shim', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-dht22-climate/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const dht = officialComponent('dht-1', 'dht22-sensor', {
    temperatureCelsius: 25,
    humidityPercent: 55,
    sensorModel: 'DHT22',
    readIntervalMs: 2000
  });
  const climate = officialComponent('climate-1', 'climate-environment', {
    enabled: true,
    temperatureC: 28,
    pressureHpa: 1013.25,
    humidityPercent: 68
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['dht-1', dht],
        ['climate-1', climate]
      ])
    },
    nets: [
      testNet('net-vcc', ['arduino-1.5v', 'dht-1.vcc']),
      testNet('net-gnd', ['arduino-1.gnd', 'dht-1.gnd']),
      testNet('net-data', ['arduino-1.d2', 'dht-1.data']),
      testNet('net-env', ['climate-1.climate', 'dht-1.env'])
    ],
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(wasm.libraries.join(','), /dht/);
  assert.equal(dht.properties.temperatureCelsius, 28);
  assert.equal(dht.properties.humidityPercent, 68);
  assert.match(serialText(result), /Humidity %: 68/);
  assert.match(serialText(result), /Temperature C: 28/);
});

test('Arduino Nano blink button example uses board LED_BUILTIN and external LED through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-nano-blink-button/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: { LED_BUILTIN: 13 }
  });
  const components = new Map([
    ['nano-1', officialComponent('nano-1', 'arduino-nano', { logicVoltage: 5, clockMHz: 16, usbPowered: true })],
    ['button-1', officialComponent('button-1', 'pull-up-button', { pressed: false, activeHigh: true })],
    ['resistor-1', officialComponent('resistor-1', 'resistor', { resistanceOhms: 220 })],
    ['led-1', officialComponent('led-1', 'led-blue', {})]
  ]);
  const session = await createProjectWasmSimulationSession({
    state: { components },
    nets: project.connections.map((connection) => testNet(connection.id, connection.terminals)),
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  session.runFrame();
  session.updateDigitalInputValue('button-1', true);
  const pressed = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(serialText(pressed), /Nano LED ON/);
  assert.equal(pressed.ledStates.get('led-1'), true);
  assert.equal(pressed.builtInLedStates.get('nano-1.led_builtin'), true);
});

test('BBC micro:bit V2 heart example lights built-in LED matrix through WASM', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/bbc-microbit-v2-heart/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['microbit-1', officialComponent('microbit-1', 'bbc-microbit-v2', {
          logicVoltage: 3.3,
          displayBrightness: 100
        })]
      ])
    },
    nets: [],
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const result = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(serialText(result), /micro:bit heart ready/);
  assert.equal(result.builtInLedStates.get('microbit-1.px-0-1'), true);
  assert.equal(result.builtInLedStates.get('microbit-1.px-0-2'), false);
  assert.equal(result.builtInLedStates.get('microbit-1.px-2-2'), true);
  assert.equal(result.builtInLedStates.get('microbit-1.px-4-2'), true);
});

test('Servo sweep example updates servo angle through Servo WASM shim', async () => {
  const { compileFirmwareWasmWithClang } = await import('../../apps/web/firmware/wasm-compiler.mjs');
  const project = JSON.parse(readFileSync(join(root, 'examples/arduino-servo-sweep/project.json'), 'utf8'));
  const wasm = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));
  const servo = officialComponent('servo-1', 'servo-motor', {
    angleDegrees: 90,
    attached: false,
    minPulseUs: 544,
    maxPulseUs: 2400,
    stallCurrentAmps: 0.65,
    noLoadCurrentAmps: 0.15
  });
  const session = await createProjectWasmSimulationSession({
    state: {
      components: new Map([
        ['arduino-1', officialComponent('arduino-1', 'arduino', {})],
        ['servo-1', servo]
      ])
    },
    nets: project.connections.map((connection) => testNet(connection.id, connection.terminals)),
    terminalKind: powerGroundTerminalKind,
    wasmBase64: wasm.wasmBase64
  });

  const first = session.runFrame();
  const second = session.runFrame();

  assert.equal(wasm.ok, true);
  assert.match(wasm.libraries.join(','), /servo/);
  assert.equal(servo.properties.attached, true);
  assert.equal(servo.properties.angleDegrees, 90);
  assert.match(serialText(first), /Servo angle: 0/);
  assert.match(serialText(second), /Servo angle: 90/);
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

function drainTcpResponse(runtime) {
  const bytes = [];

  while (runtime.tcpAvailable() > 0) {
    bytes.push(runtime.tcpRead());
  }

  return String.fromCharCode(...bytes);
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

function powerGroundTerminalKind(terminal) {
  if (/gnd|com/.test(terminal.terminalId)) {
    return 'ground';
  }

  if (/5v|3v3|vcc/.test(terminal.terminalId)) {
    return 'power';
  }

  return 'signal';
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
    'arduino-nano': 'components/official/arduino-nano/component.json',
    'bbc-microbit-v2': 'components/official/bbc-microbit-v2/component.json',
    'esp32-devkit': 'components/official/esp32-devkit/component.json',
    'bmp280-sensor': 'components/official/bmp280/component.json',
    'buzzer': 'components/official/buzzer/component.json',
    'climate-environment': 'components/official/climate/component.json',
    'distance': 'components/official/distance-range/component.json',
    'dht11-sensor': 'components/official/dht11/component.json',
    'dht22-sensor': 'components/official/dht22/component.json',
    'fc37-rain-sensor': 'components/official/fc-37-rain-sensor/component.json',
    'hcsr04': 'components/official/hc-sr04/component.json',
    'ldr-light-sensor': 'components/official/ldr-light-sensor/component.json',
    'led': 'components/official/led-red/component.json',
    'led-blue': 'components/official/led-blue/component.json',
    'led-green': 'components/official/led-green/component.json',
    'led-red': 'components/official/led-red/component.json',
    'led-yellow': 'components/official/led-yellow/component.json',
    'lcd-16x2-i2c': 'components/official/lcd-16x2-i2c/component.json',
    'light-level': 'components/official/light-level/component.json',
    'mcp3008-adc': 'components/official/mcp3008/component.json',
    'pull-up-button': 'components/official/pull-up-button/component.json',
    'rain-toggle': 'components/official/rain-toggle/component.json',
    'resistor': 'components/official/resistor/component.json',
    'seven-segment-display': 'components/official/seven-segment-display/component.json',
    'servo-motor': 'components/official/servo-motor/component.json',
    'shift-register-74hc595': 'components/official/74hc595/component.json'
  }[type];

  if (!manifestPath) {
    throw new Error(`Fixture sem manifest oficial mapeado: ${type}`);
  }

  return JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
}
