import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { componentPalette, installComponentCatalog } from '../../apps/web/js/components.js';

const root = new URL('../..', import.meta.url).pathname;
const officialComponentsRoot = join(root, 'components/official');

const jsonFiles = [
  'schemas/project.schema.json',
  'schemas/component.schema.json',
  'components/official/ads1015/component.json',
  'components/official/ads1115/component.json',
  'components/official/analog-voltage-source/component.json',
  'components/official/arduino-uno/component.json',
  'components/official/bmp280/component.json',
  'components/official/resistor/component.json',
  'components/official/capacitor/component.json',
  'components/official/climate/component.json',
  'components/official/esp32-devkit/component.json',
  'components/official/fc-37-rain-sensor/component.json',
  'components/official/ldr-light-sensor/component.json',
  'components/official/led-red/component.json',
  'components/official/led-green/component.json',
  'components/official/led-blue/component.json',
  'components/official/light-level/component.json',
  'components/official/mcp3008/component.json',
  'components/official/pull-up-button/component.json',
  'components/official/rain-toggle/component.json',
  'components/official/hc-sr04/component.json',
  'components/official/distance-range/component.json',
  'components/official/wifi-signal/component.json',
  'examples/bmp280-weather-i2c/project.json',
  'examples/ads1015-single-ended/project.json',
  'examples/ads1115-single-ended/project.json',
  'examples/arduino-serial-bridge-led/project.json',
  'examples/arduino-serial-led/project.json',
  'examples/esp32-counter-blink/project.json',
  'examples/esp32-wifi-failover/project.json',
  'examples/esp32-wifi-signal/project.json',
  'examples/fc-37-rain-digital/project.json',
  'examples/hc-sr04-led-distance/project.json',
  'examples/ldr-light-analog/project.json',
  'examples/mcp3008-single-ended/project.json',
  'examples/arduino-pull-up-button-toggle-blue-led/project.json'
];

function officialComponentPaths() {
  return readdirSync(officialComponentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `components/official/${entry.name}/component.json`)
    .sort();
}

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function officialComponentManifests() {
  return officialComponentPaths().map((path) => ({
    path,
    manifest: readJson(path)
  }));
}

function flattenControls(controls: Array<Record<string, unknown>>): Array<Record<string, string>> {
  return controls.flatMap((control) => [
    control as Record<string, string>,
    ...flattenControls((control.children ?? []) as Array<Record<string, unknown>>)
  ]);
}

for (const relativePath of jsonFiles) {
  test(`${relativePath} is valid JSON`, () => {
    const content = readFileSync(join(root, relativePath), 'utf8');
    assert.doesNotThrow(() => JSON.parse(content));
  });
}

test('official component manifests follow the minimum simulation contract', () => {
  for (const { path, manifest } of officialComponentManifests()) {
    assert.equal(typeof manifest.identity.id, 'string', path);
    assert.equal(typeof manifest.identity.name, 'string', path);
    assert.equal(typeof manifest.identity.category, 'string', path);
    assert.equal(typeof manifest.simulation.kind, 'string', path);
    assert.equal(typeof manifest.simulation.implemented, 'boolean', path);
    assert.ok(Array.isArray(manifest.simulation.effects), path);

    if (manifest.simulation.effects.includes('electrical')) {
      assert.ok(manifest.electricalModel, `${path} impacts electrical simulation and must define electricalModel`);
    }

    if (manifest.simulation.kind === 'microcontroller' || manifest.simulation.kind === 'behavioral-sensor' || manifest.simulation.kind === 'environment-source') {
      assert.ok(manifest.behavior, `${path} impacts runtime/environment simulation and must define behavior`);
    }
  }
});

test('official component palette manifests are rendered by the UI catalog adapter', () => {
  const manifests = officialComponentManifests().map(({ manifest }) => manifest);
  const paletteManifests = manifests.filter((manifest) => manifest.visual?.palette);

  installComponentCatalog(manifests);

  for (const manifest of paletteManifests) {
    assert.ok(
      componentPalette.some((item) => item.type === manifest.visual.type && item.title === manifest.visual.title),
      `${manifest.identity.id} has visual.palette but was not added to componentPalette`
    );
  }
});

test('official component visual terminals match logical manifest terminals', () => {
  for (const { path, manifest } of officialComponentManifests()) {
    const logicalTerminals = new Set((manifest.terminals ?? []).map((terminal: { id: string }) => terminal.id));
    const visualTerminals = new Set((manifest.visual?.terminals ?? []).map((terminal: { id: string }) => terminal.id));

    assert.deepEqual(
      [...visualTerminals].sort(),
      [...logicalTerminals].sort(),
      `${path} visual.terminals must match terminals`
    );
  }
});

test('official component manifests keep references internally consistent', () => {
  for (const { path, manifest } of officialComponentManifests()) {
    const properties = new Set(Object.keys(manifest.properties ?? {}));
    const terminals = new Set((manifest.terminals ?? []).map((terminal: { id: string }) => terminal.id));

    for (const [propertyName, propertySchema] of Object.entries(manifest.properties ?? {}) as Array<[string, { type: string; simulationUpdate?: string }]>) {
      assert.ok(['number', 'string', 'boolean'].includes(propertySchema.type), `${path}.${propertyName} has invalid property type`);
      assert.ok(propertySchema.simulationUpdate, `${path}.${propertyName} must declare simulationUpdate`);
    }

    for (const control of flattenControls(manifest.visual?.controls ?? [])) {
      if (control.property) {
        assert.ok(properties.has(control.property), `${path} visual control references missing property ${control.property}`);
      }

      if (control.activeProperty) {
        assert.ok(properties.has(control.activeProperty), `${path} visual control references missing activeProperty ${control.activeProperty}`);
      }
    }

    for (const binding of manifest.visual?.stateBindings ?? []) {
      if (binding.source?.property && binding.source.kind === 'component') {
        assert.ok(properties.has(binding.source.property), `${path} state binding references missing property ${binding.source.property}`);
      }

      if (binding.selector) {
        assert.equal(typeof binding.selector, 'string', `${path} state binding selector must be string`);
      }
    }

    for (const [terminalId, pin] of Object.entries(manifest.behavior?.pinMap ?? {}) as Array<[string, { capabilities?: string[]; number?: number; analogNumber?: number }]>) {
      assert.ok(terminals.has(terminalId), `${path} pinMap references missing terminal ${terminalId}`);
      assert.ok(Array.isArray(pin.capabilities), `${path} pin ${terminalId} must declare capabilities`);
      assert.ok(Number.isInteger(pin.number) || Number.isInteger(pin.analogNumber), `${path} pin ${terminalId} must expose a runtime number`);
    }

    for (const busList of Object.values(manifest.behavior?.buses ?? {}) as Array<Array<Record<string, string | number>>>) {
      for (const bus of busList) {
        for (const [key, value] of Object.entries(bus)) {
          if (!['sda', 'scl', 'sck', 'miso', 'mosi', 'defaultCs', 'rx', 'tx'].includes(key) || typeof value !== 'string') {
            continue;
          }

          assert.ok(terminals.has(value), `${path} bus references missing terminal ${value}`);
        }
      }
    }
  }
});

test('HC-SR04 example contains required validation components', () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/hc-sr04-led-distance/project.json'), 'utf8')
  );

  assert.deepEqual(
    project.components.map((component: { componentId: string }) => component.componentId).sort(),
    [
      'board.arduino.uno',
      'electronic.led.red',
      'electronic.resistor',
      'environment.distance-range',
      'sensor.ultrasonic.hc-sr04'
    ].sort()
  );
  assert.equal(project.code.entry, 'main.ino');
  assert.equal(project.connections.find((connection: { id: string }) => connection.id === 'net-1')?.color, '#f05252');
  assert.equal(project.connections.find((connection: { id: string }) => connection.id === 'net-2')?.color, '#f5f7fa');
  assert.equal(project.environmentConnections[0].color, '#6fbf73');
});

test('resistor component exposes known resistance variants', () => {
  const resistor = JSON.parse(
    readFileSync(join(root, 'components/official/resistor/component.json'), 'utf8')
  );

  assert.equal(resistor.properties.resistanceOhms.unit, 'Ω');
  assert.ok(Array.isArray(resistor.variants.resistanceOhms));
  assert.ok(resistor.variants.resistanceOhms.some((variant: { label: string; value: number }) => variant.label === '1 kΩ' && variant.value === 1000));
  assert.ok(resistor.variants.resistanceOhms.some((variant: { label: string; value: number }) => variant.label === '10 kΩ' && variant.value === 10000));
  assert.ok(resistor.variants.resistanceOhms.some((variant: { label: string; value: number }) => variant.label === '1 MΩ' && variant.value === 1000000));
});

test('capacitor component exposes known capacitance variants', () => {
  const capacitor = JSON.parse(
    readFileSync(join(root, 'components/official/capacitor/component.json'), 'utf8')
  );

  assert.equal(capacitor.properties.capacitanceMicrofarads.unit, 'µF');
  assert.ok(Array.isArray(capacitor.variants.capacitanceMicrofarads));
  assert.ok(capacitor.variants.capacitanceMicrofarads.some((variant: { label: string; value: number }) => variant.label === '100 nF' && variant.value === 0.1));
  assert.ok(capacitor.variants.capacitanceMicrofarads.some((variant: { label: string; value: number }) => variant.label === '4700 µF' && variant.value === 4700));
});

test('Arduino UNO manifest exposes common digital, analog and power pins', () => {
  const arduino = JSON.parse(
    readFileSync(join(root, 'components/official/arduino-uno/component.json'), 'utf8')
  );
  const terminalIds = arduino.terminals.map((terminal: { id: string }) => terminal.id);
  const visualTerminalIds = arduino.visual.terminals.map((terminal: { id: string }) => terminal.id);

  for (const id of ['vin', '3v3', '5v', 'gnd', 'gnd2', 'd0', 'd1', 'd13', 'a0', 'a5']) {
    assert.ok(terminalIds.includes(id));
    assert.ok(visualTerminalIds.includes(id));
  }

  assert.equal(arduino.behavior.builtInLeds[0].pin, 13);
  assert.equal(arduino.behavior.builtInLeds[0].terminalId, 'd13');
  assert.equal(arduino.behavior.pinMap.d13.number, 13);
  assert.equal(arduino.behavior.pinMap.a0.analogNumber, 14);
  assert.ok(arduino.behavior.pinMap.a4.capabilities.includes('i2c-sda'));
  assert.equal(arduino.behavior.buses.i2c[0].sda, 'a4');
  assert.equal(arduino.behavior.buses.spi[0].sck, 'd13');
});

test('ESP32 DevKit manifest exposes documented header pins and wireless capability', () => {
  const esp32 = JSON.parse(
    readFileSync(join(root, 'components/official/esp32-devkit/component.json'), 'utf8')
  );
  const terminalIds = esp32.terminals.map((terminal: { id: string }) => terminal.id);
  const visualTerminalIds = esp32.visual.terminals.map((terminal: { id: string }) => terminal.id);

  for (const id of ['3v3', '5v', 'en', 'vp', 'vn', 'io0', 'io23', 'tx', 'rx', 'gnd', 'gnd2', 'gnd3', 'd0', 'd1', 'd2', 'd3', 'cmd', 'clk']) {
    assert.ok(terminalIds.includes(id));
    assert.ok(visualTerminalIds.includes(id));
  }

  assert.equal(esp32.electricalModel.logicVoltage, 3.3);
  assert.deepEqual(esp32.behavior.wireless, ['wifi', 'bluetooth']);
  assert.equal(esp32.behavior.pinMap.io2.number, 2);
  assert.equal(esp32.behavior.pinMap.vp.analogNumber, 36);
  assert.ok(esp32.behavior.pinMap.io22.capabilities.includes('i2c-scl'));
  assert.ok(esp32.behavior.pinMap.io2.capabilities.includes('interrupt'));
  assert.ok(esp32.behavior.pinMap.io2.capabilities.includes('pwm'));
  assert.ok(esp32.behavior.pinMap.io2.capabilities.includes('adc2'));
  assert.equal(esp32.behavior.buses.i2c[0].sda, 'io21');
  assert.equal(esp32.behavior.buses.spi[0].id, 'vspi');
  assert.equal(esp32.behavior.buses.pwm[0].channels, 16);
  assert.equal(esp32.behavior.buses.timers.length, 2);
  assert.equal(esp32.behavior.builtInLeds[0].id, 'power');
  assert.equal(esp32.behavior.builtInLeds[0].pin, null);
  assert.equal(esp32.behavior.builtInLeds[1].id, 'led_builtin');
  assert.equal(esp32.behavior.builtInLeds[1].pin, 2);
  assert.equal(esp32.behavior.builtInLeds[1].terminalId, 'io2');
  assert.match(esp32.behavior.notes[1], /GPIO2/);
});

test('Wi-Fi signal component exposes connection and signal strength properties', () => {
  const wifiSignal = JSON.parse(
    readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8')
  );

  assert.equal(wifiSignal.identity.category, 'environment');
  assert.equal(wifiSignal.properties.connected.type, 'boolean');
  assert.equal(wifiSignal.properties.strengthPercent.minimum, 0);
  assert.equal(wifiSignal.properties.strengthPercent.maximum, 100);
  assert.deepEqual(wifiSignal.terminals, []);
  assert.deepEqual(wifiSignal.visual.terminals, []);
});

test('FC-37 rain package exposes sensor, environment and digital example', () => {
  const sensor = JSON.parse(
    readFileSync(join(root, 'components/official/fc-37-rain-sensor/component.json'), 'utf8')
  );
  const rain = JSON.parse(
    readFileSync(join(root, 'components/official/rain-toggle/component.json'), 'utf8')
  );
  const project = JSON.parse(
    readFileSync(join(root, 'examples/fc-37-rain-digital/project.json'), 'utf8')
  );

  assert.equal(sensor.identity.id, 'sensor.rain.fc-37');
  assert.equal(sensor.simulation.kind, 'behavioral-sensor');
  assert.deepEqual(sensor.simulation.effects, ['firmware', 'environment', 'visual-state']);
  assert.equal(sensor.behavior.type, 'rain-sensor');
  assert.ok(sensor.terminals.some((terminal: { id: string }) => terminal.id === 'do'));
  assert.ok(sensor.terminals.some((terminal: { id: string }) => terminal.id === 'ao'));
  assert.equal(sensor.visual.palette.group, 'Sensors');
  assert.equal(sensor.visual.palette.subgroup, 'Rain');

  assert.equal(rain.identity.id, 'environment.rain-toggle');
  assert.equal(rain.simulation.kind, 'environment-source');
  assert.deepEqual(rain.terminals, []);
  assert.deepEqual(rain.visual.terminals, []);
  assert.equal(rain.properties.active.default, false);
  assert.equal(rain.visual.palette.subgroup, 'Weather');

  assert.deepEqual(
    project.components.map((component: { componentId: string }) => component.componentId).sort(),
    [
      'board.arduino.uno',
      'environment.rain-toggle',
      'sensor.rain.fc-37'
    ].sort()
  );
  assert.match(project.code.files['main.ino'], /digitalRead\(RAIN_PIN\)/);
  assert.match(project.code.files['main.ino'], /RAIN DETECTED/);
  assert.match(project.code.files['main.ino'], /NO RAIN/);
});

test('LDR light package exposes sensor, environment and analog example', () => {
  const sensor = JSON.parse(
    readFileSync(join(root, 'components/official/ldr-light-sensor/component.json'), 'utf8')
  );
  const light = JSON.parse(
    readFileSync(join(root, 'components/official/light-level/component.json'), 'utf8')
  );
  const project = JSON.parse(
    readFileSync(join(root, 'examples/ldr-light-analog/project.json'), 'utf8')
  );

  assert.equal(sensor.identity.id, 'sensor.light.ldr');
  assert.equal(sensor.simulation.kind, 'behavioral-sensor');
  assert.deepEqual(sensor.simulation.effects, ['firmware', 'environment', 'electrical', 'visual-state']);
  assert.equal(sensor.behavior.type, 'light-sensor');
  assert.equal(sensor.electricalModel.type, 'variable-resistor');
  assert.equal(sensor.electricalModel.primitive, 'ldr');
  assert.deepEqual(sensor.terminals.map((terminal: { id: string }) => terminal.id), ['a', 'b']);
  assert.equal(sensor.visual.palette.group, 'Sensors');
  assert.equal(sensor.visual.palette.subgroup, 'Light');

  assert.equal(light.identity.id, 'environment.light-level');
  assert.equal(light.simulation.kind, 'environment-source');
  assert.deepEqual(light.terminals, []);
  assert.deepEqual(light.visual.terminals, []);
  assert.equal(light.properties.intensityPercent.default, 50);
  assert.equal(light.visual.palette.subgroup, 'Light');

  assert.deepEqual(
    project.components.map((component: { componentId: string }) => component.componentId).sort(),
    [
      'board.arduino.uno',
      'electronic.resistor',
      'environment.light-level',
      'sensor.light.ldr'
    ].sort()
  );
  assert.match(project.code.files['main.ino'], /const int LIGHT_PIN = A0/);
  assert.match(project.code.files['main.ino'], /analogRead\(LIGHT_PIN\)/);
  assert.match(project.code.files['main.ino'], /DARK/);
  assert.match(project.code.files['main.ino'], /BRIGHT/);
});

test('BMP280 package exposes sensor, climate environment and I2C example', () => {
  const sensor = JSON.parse(
    readFileSync(join(root, 'components/official/bmp280/component.json'), 'utf8')
  );
  const climate = JSON.parse(
    readFileSync(join(root, 'components/official/climate/component.json'), 'utf8')
  );
  const project = JSON.parse(
    readFileSync(join(root, 'examples/bmp280-weather-i2c/project.json'), 'utf8')
  );

  assert.equal(sensor.identity.id, 'sensor.environment.bmp280');
  assert.equal(sensor.simulation.kind, 'behavioral-sensor');
  assert.deepEqual(sensor.simulation.effects, ['firmware', 'environment', 'electrical', 'visual-state']);
  assert.equal(sensor.behavior.type, 'bmp280-sensor');
  assert.equal(sensor.electricalModel.bus, 'i2c');
  assert.deepEqual(sensor.terminals.map((terminal: { id: string }) => terminal.id).sort(), ['csb', 'gnd', 'scl', 'sda', 'sdo', 'vcc'].sort());
  assert.equal(sensor.visual.palette.group, 'Sensors');
  assert.equal(sensor.visual.palette.subgroup, 'Environment');

  assert.equal(climate.identity.id, 'environment.climate');
  assert.equal(climate.simulation.kind, 'environment-source');
  assert.deepEqual(climate.terminals, []);
  assert.deepEqual(climate.visual.terminals, []);
  assert.equal(climate.properties.temperatureC.default, 25);
  assert.equal(climate.properties.pressureHpa.default, 1013.25);
  assert.equal(climate.visual.palette.subgroup, 'Weather');

  assert.deepEqual(
    project.components.map((component: { componentId: string }) => component.componentId).sort(),
    [
      'board.arduino.uno',
      'environment.climate',
      'sensor.environment.bmp280'
    ].sort()
  );
  assert.match(project.code.files['main.ino'], /#include <Wire\.h>/);
  assert.match(project.code.files['main.ino'], /BMP280 bmp/);
  assert.match(project.code.files['main.ino'], /bmp\.begin\(0x76\)/);
  assert.match(project.code.files['main.ino'], /bmp\.readTemperature\(\)/);
  assert.match(project.code.files['main.ino'], /bmp\.readPressure\(\)/);
});

test('external ADC package exposes ADS1015, ADS1115, MCP3008 and analog source examples', () => {
  const ads1015 = readJson('components/official/ads1015/component.json');
  const ads1115 = readJson('components/official/ads1115/component.json');
  const mcp3008 = readJson('components/official/mcp3008/component.json');
  const analogSource = readJson('components/official/analog-voltage-source/component.json');
  const projects = [
    readJson('examples/ads1015-single-ended/project.json'),
    readJson('examples/ads1115-single-ended/project.json'),
    readJson('examples/mcp3008-single-ended/project.json')
  ];

  assert.equal(ads1015.identity.id, 'converter.adc.ads1015');
  assert.equal(ads1015.electricalModel.resolutionBits, 12);
  assert.equal(ads1015.electricalModel.bus, 'i2c');
  assert.equal(ads1015.visual.palette.subgroup, 'ADCs');
  assert.equal(ads1115.identity.id, 'converter.adc.ads1115');
  assert.equal(ads1115.electricalModel.resolutionBits, 16);
  assert.equal(ads1115.electricalModel.bus, 'i2c');
  assert.equal(mcp3008.identity.id, 'converter.adc.mcp3008');
  assert.equal(mcp3008.electricalModel.resolutionBits, 10);
  assert.equal(mcp3008.electricalModel.bus, 'spi');
  assert.equal(analogSource.identity.id, 'environment.analog-voltage-source');
  assert.equal(analogSource.visual.palette.subgroup, 'Analog');

  for (const project of projects) {
    assert.ok(project.components.some((component: { componentId: string }) => component.componentId === 'environment.analog-voltage-source'));
    assert.match(project.code.files['main.ino'], /Serial\.println/);
  }

  assert.match(projects[0].code.files['main.ino'], /ADS1015 ads/);
  assert.match(projects[1].code.files['main.ino'], /ADS1115 ads/);
  assert.match(projects[2].code.files['main.ino'], /MCP3008 adc/);
});

test('ESP32 Wi-Fi example contains standalone Wi-Fi signal and firmware', () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-wifi-signal/project.json'), 'utf8')
  );

  assert.deepEqual(
    project.components.map((component: { componentId: string }) => component.componentId).sort(),
    [
      'board.esp32.devkit',
      'environment.wifi-signal'
    ].sort()
  );
  assert.deepEqual(project.connections, []);
  assert.deepEqual(project.environmentConnections, []);
  assert.match(project.code.files['main.ino'], /WiFi\.begin\("VirtualLab"/);
  assert.match(project.code.files['main.ino'], /WiFi\.RSSI\(\)/);
});

test('ESP32 Wi-Fi failover example contains multiple networks and internet validation', () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-wifi-failover/project.json'), 'utf8')
  );
  const wifiSignals = project.components.filter((component: { componentId: string }) => component.componentId === 'environment.wifi-signal');
  const code = project.code.files['main.ino'];

  assert.equal(project.components.find((component: { componentId: string }) => component.componentId === 'board.esp32.devkit')?.id, 'esp32-1');
  assert.equal(wifiSignals.length, 3);
  assert.deepEqual(wifiSignals.map((component: { properties: { strengthPercent: number } }) => component.properties.strengthPercent), [95, 74, 42]);
  assert.equal(wifiSignals[0].properties.connected, false);
  assert.equal(wifiSignals[1].properties.connected, true);
  assert.match(code, /WiFi\.RSSI\(networks\[index\]\.ssid\)/);
  assert.match(code, /WiFi\.internetAvailable\(\)/);
});

test('ESP32 counter blink example exercises WASM-supported C++ state', () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-counter-blink/project.json'), 'utf8')
  );
  const code = project.code.files['main.ino'];

  assert.deepEqual(project.components.map((component: { componentId: string }) => component.componentId), ['board.esp32.devkit']);
  assert.deepEqual(project.connections, []);
  assert.deepEqual(project.environmentConnections, []);
  assert.match(code, /int counter = 0/);
  assert.match(code, /counter\+\+/);
  assert.match(code, /counter % 10 == 0/);
  assert.match(code, /delay\(4000\)/);
});
