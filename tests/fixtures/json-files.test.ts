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
  'components/official/arduino-uno/component.json',
  'components/official/resistor/component.json',
  'components/official/capacitor/component.json',
  'components/official/esp32-devkit/component.json',
  'components/official/fc-37-rain-sensor/component.json',
  'components/official/led-red/component.json',
  'components/official/led-green/component.json',
  'components/official/led-blue/component.json',
  'components/official/rain-toggle/component.json',
  'components/official/hc-sr04/component.json',
  'components/official/distance-range/component.json',
  'components/official/wifi-signal/component.json',
  'examples/esp32-counter-blink/project.json',
  'examples/esp32-wifi-failover/project.json',
  'examples/esp32-wifi-signal/project.json',
  'examples/fc-37-rain-digital/project.json',
  'examples/hc-sr04-led-distance/project.json'
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
