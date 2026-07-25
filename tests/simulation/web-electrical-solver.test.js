import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { componentDefinitionFromManifest, componentDefinitions, installComponentCatalog } from '../../apps/web/js/components.js';
import { createCircuitGraph } from '../../apps/web/js/simulation/circuit-graph.js';
import { solveElectricalState } from '../../apps/web/js/simulation/electrical-solver.js';

const root = new URL('../..', import.meta.url).pathname;

installComponentCatalog([
  readManifest('components/official/arduino-uno/component.json'),
  readManifest('components/official/resistor/component.json'),
  readManifest('components/official/capacitor/component.json'),
  readManifest('components/official/led-red/component.json'),
  readManifest('components/official/led-green/component.json'),
  readManifest('components/official/rgb-led-common-cathode/component.json'),
  readManifest('components/official/bc547-transistor/component.json'),
  readManifest('components/official/irlz44n-mosfet/component.json'),
  readManifest('components/official/electromechanical-relay-1ch/component.json'),
  readManifest('components/official/pc817-optoisolator/component.json'),
  readManifest('components/official/uln2003a-relay-driver/component.json'),
  readManifest('components/official/analog-voltage-source/component.json'),
  readManifest('components/official/hc-sr04/component.json'),
  readManifest('components/official/fc-37-rain-sensor/component.json'),
  readManifest('components/official/bmp280/component.json')
]);

test('web electrical solver computes LED series current from nets', () => {
  const graph = createCircuitGraph({
    components: createComponents(),
    nets: [
      net('net-1', ['arduino-1.d13', 'resistor-1.a']),
      net('net-2', ['resistor-1.b', 'led-1.anode']),
      net('net-3', ['led-1.cathode', 'arduino-1.gnd'])
    ],
    terminalKind
  });
  const runtime = runtimeWithHighPin(13);

  const result = solveElectricalState({ graph, runtime });
  const led = result.componentReadings.get('led-1');
  const resistor = result.componentReadings.get('resistor-1');

  assert.equal(Number(led.currentAmps.toFixed(6)), 0.013636);
  assert.equal(Number(resistor.powerWatts.toFixed(4)), 0.0409);
  assert.equal(result.ledStates.get('led-1'), true);
});

test('web electrical solver accepts any Arduino ground terminal as LED return path', () => {
  const graph = createCircuitGraph({
    components: createComponents(),
    nets: [
      net('net-1', ['arduino-1.d13', 'resistor-1.a']),
      net('net-2', ['resistor-1.b', 'led-1.anode']),
      net('net-3', ['led-1.cathode', 'arduino-1.gnd2'])
    ],
    terminalKind
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(13) });

  assert.equal(result.ledStates.get('led-1'), true);
  assert.doesNotMatch(result.diagnostics.join('\n'), /catodo não está conectado ao GND/);
});

test('web electrical solver handles non-red LEDs through electrical primitive metadata', () => {
  const components = createComponents();
  components.set('led-green-1', {
    id: 'led-green-1',
    type: 'led-green',
    electricalPrimitive: 'led',
    properties: { forwardVoltage: 2.1, recommendedCurrent: 0.01, minimumVisibleCurrent: 0.001, maximumCurrent: 0.02 }
  });
  components.delete('led-1');

  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-1', ['arduino-1.d13', 'resistor-1.a']),
      net('net-2', ['resistor-1.b', 'led-green-1.anode']),
      net('net-3', ['led-green-1.cathode', 'arduino-1.gnd'])
    ],
    terminalKind
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(13) });

  assert.equal(result.ledStates.get('led-green-1'), true);
  assert.equal(result.componentReadings.get('led-green-1').type, 'led');
});

test('web electrical solver combines PWM channels for RGB LEDs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['rgb-1', componentFromDefinition('rgb-1', 'rgb-led-common-cathode', {})],
    ['red-resistor-1', componentFromDefinition('red-resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })],
    ['green-resistor-1', componentFromDefinition('green-resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })],
    ['blue-resistor-1', componentFromDefinition('blue-resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-red-drive', ['arduino-1.d3', 'red-resistor-1.a']),
      net('net-red-led', ['red-resistor-1.b', 'rgb-1.red']),
      net('net-green-drive', ['arduino-1.d5', 'green-resistor-1.a']),
      net('net-green-led', ['green-resistor-1.b', 'rgb-1.green']),
      net('net-blue-drive', ['arduino-1.d6', 'blue-resistor-1.a']),
      net('net-blue-led', ['blue-resistor-1.b', 'rgb-1.blue']),
      net('net-gnd', ['rgb-1.cathode', 'arduino-1.gnd'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([
    [3, 255],
    [5, 128],
    [6, 0]
  ])) });
  const reading = result.componentReadings.get('rgb-1');

  assert.equal(result.ledStates.get('rgb-1'), true);
  assert.equal(reading.color, '#ff8000');
  assert.equal(reading.red, 255);
  assert.equal(reading.green, 128);
  assert.equal(reading.blue, 0);
});

test('web electrical solver diagnoses BJT base drive without resistor and missing collector load', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['bjt-1', componentFromDefinition('bjt-1', 'bc547-transistor', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-base', ['arduino-1.d2', 'bjt-1.base']),
      net('net-emitter', ['arduino-1.gnd', 'bjt-1.emitter'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(2) });
  const reading = result.componentReadings.get('bjt-1');

  assert.equal(reading.type, 'bjt-transistor');
  assert.equal(reading.state, 'under-driven');
  assert.match(result.diagnostics.join('\n'), /base acionada sem resistor/);
  assert.match(result.diagnostics.join('\n'), /coletor sem carga/);
});

test('web electrical solver diagnoses MOSFET floating gate and missing source reference', () => {
  const components = new Map([
    ['mosfet-1', componentFromDefinition('mosfet-1', 'irlz44n-mosfet', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });
  const reading = result.componentReadings.get('mosfet-1');

  assert.equal(reading.type, 'mosfet');
  assert.equal(reading.state, 'floating-gate');
  assert.match(result.diagnostics.join('\n'), /gate flutuante/);
  assert.match(result.diagnostics.join('\n'), /fonte de MOSFET canal N/);
});

test('web electrical solver lights LED loads only through active low-side MOSFETs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['mosfet-1', componentFromDefinition('mosfet-1', 'irlz44n-mosfet', {})],
    ['resistor-1', componentFromDefinition('resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })],
    ['led-1', componentFromDefinition('led-1', 'led', { forwardVoltage: 2, recommendedCurrent: 0.01, minimumVisibleCurrent: 0.001, maximumCurrent: 0.02 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-supply', ['arduino-1.5v', 'resistor-1.a']),
      net('net-led-anode', ['resistor-1.b', 'led-1.anode']),
      net('net-switched-cathode', ['led-1.cathode', 'mosfet-1.drain']),
      net('net-source', ['mosfet-1.source', 'arduino-1.gnd']),
      net('net-gate', ['arduino-1.d4', 'mosfet-1.gate'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const off = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[4, 0]])) });
  const on = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[4, 255]])) });

  assert.equal(off.componentReadings.get('mosfet-1').state, 'off');
  assert.equal(off.ledStates.get('led-1'), false);
  assert.equal(on.componentReadings.get('mosfet-1').state, 'on');
  assert.equal(on.ledStates.get('led-1'), true);
});

test('web electrical solver lights LED loads only through conducting PC817 outputs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['pc817-1', componentFromDefinition('pc817-1', 'pc817-optoisolator', {})],
    ['input-resistor-1', componentFromDefinition('input-resistor-1', 'resistor', { resistanceOhms: 1000, maximumPowerWatts: 0.25 })],
    ['load-resistor-1', componentFromDefinition('load-resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })],
    ['led-1', componentFromDefinition('led-1', 'led', { forwardVoltage: 2, recommendedCurrent: 0.01, minimumVisibleCurrent: 0.001, maximumCurrent: 0.02 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-input-drive', ['arduino-1.d9', 'input-resistor-1.a']),
      net('net-input-anode', ['input-resistor-1.b', 'pc817-1.anode']),
      net('net-input-ground', ['pc817-1.cathode', 'arduino-1.gnd']),
      net('net-supply', ['arduino-1.5v', 'load-resistor-1.a']),
      net('net-led-anode', ['load-resistor-1.b', 'led-1.anode']),
      net('net-opto-collector', ['led-1.cathode', 'pc817-1.collector']),
      net('net-opto-emitter', ['pc817-1.emitter', 'arduino-1.gnd'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const off = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[9, 0]])) });
  const on = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[9, 255]])) });

  assert.equal(off.componentReadings.get('pc817-1').state, 'off');
  assert.equal(off.ledStates.get('led-1'), false);
  assert.equal(on.componentReadings.get('pc817-1').state, 'conducting');
  assert.equal(on.ledStates.get('led-1'), true);
});

test('arduino maker switching gallery load LEDs follow the switching component state', () => {
  const project = readJson('examples/arduino-maker-switching-gallery/project.json');
  const components = componentsFromProject(project);
  const graph = createCircuitGraph({
    components,
    nets: project.connections.map((connection) => net(connection.id, connection.terminals)),
    terminalKind: terminalKindFor(components)
  });

  const off = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[4, 0], [9, 0]])) });
  const mosfetOn = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[4, 255], [9, 0]])) });
  const pc817On = solveElectricalState({ graph, runtime: runtimeWithPwmPins(new Map([[4, 0], [9, 255]])) });

  assert.equal(off.ledStates.get('led-d4'), false);
  assert.equal(off.ledStates.get('led-d9'), false);
  assert.equal(mosfetOn.ledStates.get('led-d4'), true);
  assert.equal(mosfetOn.ledStates.get('led-d9'), false);
  assert.equal(pc817On.ledStates.get('led-d4'), false);
  assert.equal(pc817On.ledStates.get('led-d9'), true);
});

function componentsFromProject(project) {
  return new Map(project.components.map((component) => {
    const definition = definitionByComponentIdentity(component.componentId);

    return [component.id, {
      id: component.id,
      type: definition.type,
      behavior: definition.behavior ?? {},
      electricalModel: definition.electricalModel ?? null,
      electricalPrimitive: definition.electricalPrimitive,
      properties: { ...(definition.properties ?? {}), ...(component.properties ?? {}) }
    }];
  }));
}

function definitionByComponentIdentity(componentId) {
  const existing = Object.values(componentDefinitions).find((definition) => definition.identity?.id === componentId);

  if (existing) {
    return existing;
  }

  const manifest = officialManifestByIdentity(componentId);
  return componentDefinitionFromManifest(manifest);
}

function officialManifestByIdentity(componentId) {
  for (const entry of readdirSync(join(root, 'components/official'), { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifest = readJson(`components/official/${entry.name}/component.json`);

    if (manifest.identity.id === componentId) {
      return manifest;
    }
  }

  throw new Error(`Official manifest not found for ${componentId}`);
}

test('web electrical solver reports active relay channel state', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['relay-1', componentFromDefinition('relay-1', 'electromechanical-relay-1ch', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-vcc', ['arduino-1.5v', 'relay-1.vcc']),
      net('net-gnd', ['arduino-1.gnd', 'relay-1.gnd']),
      net('net-in', ['arduino-1.d6', 'relay-1.in1'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(6) });
  const reading = result.componentReadings.get('relay-1');

  assert.equal(reading.type, 'relay');
  assert.equal(reading.state, 'active');
  assert.equal(reading.channels[0].active, true);
  assert.match(result.diagnostics.join('\n'), /ch1: chave ativa sem carga/);
});

test('web electrical solver diagnoses PC817 input without series resistor', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['pc817-1', componentFromDefinition('pc817-1', 'pc817-optoisolator', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-anode', ['arduino-1.d9', 'pc817-1.anode']),
      net('net-cathode', ['arduino-1.gnd', 'pc817-1.cathode'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(9) });
  const reading = result.componentReadings.get('pc817-1');

  assert.equal(reading.type, 'optoisolator');
  assert.equal(reading.state, 'input-active-output-floating');
  assert.match(result.diagnostics.join('\n'), /LED interno do PC817 acionado sem resistor/);
});

test('web electrical solver diagnoses ULN active open collector without load', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['uln-1', componentFromDefinition('uln-1', 'uln2003a-relay-driver', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-gnd', ['arduino-1.gnd', 'uln-1.gnd']),
      net('net-in', ['arduino-1.d10', 'uln-1.in1'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(10) });
  const reading = result.componentReadings.get('uln-1');

  assert.equal(reading.type, 'darlington-array');
  assert.equal(reading.state, 'active');
  assert.equal(reading.channels[0].active, true);
  assert.match(result.diagnostics.join('\n'), /out1: saída open-collector ativa sem carga/);
});

test('web electrical solver keeps LED off when series resistance is too high', () => {
  const components = createComponents();
  components.get('resistor-1').properties.resistanceOhms = 1000000;
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-1', ['arduino-1.d13', 'resistor-1.a']),
      net('net-2', ['resistor-1.b', 'led-1.anode']),
      net('net-3', ['led-1.cathode', 'arduino-1.gnd'])
    ],
    terminalKind
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(13) });
  const led = result.componentReadings.get('led-1');

  assert.equal(result.ledStates.get('led-1'), false);
  assert.equal(led.state, 'low-current');
  assert.equal(Number(led.currentAmps.toFixed(6)), 0.000003);
  assert.match(result.diagnostics.join('\n'), /corrente do LED .* abaixo do mínimo visível/);
});

test('web electrical solver reports LED directly connected without resistor', () => {
  const graph = createCircuitGraph({
    components: createComponents(),
    nets: [
      net('net-1', ['arduino-1.d13', 'led-1.anode']),
      net('net-2', ['led-1.cathode', 'arduino-1.gnd'])
    ],
    terminalKind
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(13) });

  assert.equal(result.ledStates.get('led-1'), true);
  assert.match(result.diagnostics.join('\n'), /sem resistor/);
});

test('web electrical solver reports direct 5V to GND short', () => {
  const graph = createCircuitGraph({
    components: createComponents(),
    nets: [
      net('net-1', ['arduino-1.5v', 'arduino-1.gnd'])
    ],
    terminalKind
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(13) });

  assert.match(result.diagnostics.join('\n'), /curto direto entre 5V e GND/);
  assert.equal(result.netReadings.get('net-1').state, 'short');
});

test('web electrical solver exposes generic netlist and resistor readings from voltage sources', () => {
  const components = new Map([
    ['source-1', componentFromDefinition('source-1', 'analog-voltage-source', { enabled: true, voltageVolts: 1.024 })],
    ['resistor-1', componentFromDefinition('resistor-1', 'resistor', { resistanceOhms: 1000, maximumPowerWatts: 0.25 })],
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-out', ['source-1.out', 'resistor-1.a']),
      net('net-gnd', ['source-1.gnd', 'resistor-1.b', 'arduino-1.gnd'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });
  const resistor = result.componentReadings.get('resistor-1');

  assert.equal(result.netlist.primitives.some((primitive) => primitive.kind === 'resistor'), true);
  assert.equal(result.netReadings.get('net-out').state, 'voltage-source');
  assert.equal(Number(resistor.currentAmps.toFixed(6)), 0.001024);
  assert.equal(Number(resistor.powerWatts.toFixed(6)), 0.001049);
});

test('web electrical solver validates capacitor voltage limits', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['capacitor-1', componentFromDefinition('capacitor-1', 'capacitor', { capacitanceMicrofarads: 10, maximumVoltageVolts: 3.3 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-vcc', ['arduino-1.5v', 'capacitor-1.a']),
      net('net-gnd', ['arduino-1.gnd', 'capacitor-1.b'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });
  const capacitor = result.componentReadings.get('capacitor-1');

  assert.equal(capacitor.state, 'overvoltage');
  assert.match(result.diagnostics.join('\n'), /excede limite do capacitor/);
});

test('web electrical solver validates sensor module voltage and floating MCU inputs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['bmp280-1', componentFromDefinition('bmp280-1', 'bmp280-sensor', { i2cAddress: 118, maximumCurrentAmps: 0.0005 })],
    ['resistor-1', componentFromDefinition('resistor-1', 'resistor', { resistanceOhms: 1000, maximumPowerWatts: 0.25 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-vcc', ['arduino-1.5v', 'bmp280-1.vcc']),
      net('net-gnd', ['arduino-1.gnd', 'bmp280-1.gnd']),
      net('net-floating-input', ['arduino-1.a0'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });

  assert.match(result.diagnostics.join('\n'), /bmp280-1\.vcc .*incompatível/);
  assert.match(result.diagnostics.join('\n'), /corrente .* excede limite do módulo/);
  assert.match(result.diagnostics.join('\n'), /arduino-1\.a0 .*net flutuante/);
  assert.equal(result.componentReadings.get('bmp280-1').type, 'sensor-module');
  assert.equal(result.componentReadings.get('bmp280-1').state, 'overcurrent');
});

test('web electrical solver does not report runtime-driven sensor outputs as floating inputs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['sensor-1', componentFromDefinition('sensor-1', 'hcsr04', {})],
    ['rain-sensor-1', componentFromDefinition('rain-sensor-1', 'fc37-rain-sensor', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-echo', ['arduino-1.d6', 'sensor-1.echo']),
      net('net-trigger', ['arduino-1.d7', 'sensor-1.trigger']),
      net('net-rain-do', ['arduino-1.d8', 'rain-sensor-1.do'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });

  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-1\.d6 .*net flutuante/);
  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-1\.d8 .*net flutuante/);
});

test('web electrical solver does not report connected I2C buses as floating inputs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['bmp280-1', componentFromDefinition('bmp280-1', 'bmp280-sensor', { i2cAddress: 118 })]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-sda', ['arduino-1.a4', 'bmp280-1.sda']),
      net('net-scl', ['arduino-1.a5', 'bmp280-1.scl'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });

  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-1\.a4 .*net flutuante/);
  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-1\.a5 .*net flutuante/);
});

test('web electrical solver does not report connected UART peers as floating inputs', () => {
  const components = new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['arduino-2', componentFromDefinition('arduino-2', 'arduino', {})]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      net('net-uart', ['arduino-1.d1', 'arduino-2.d0'])
    ],
    terminalKind: terminalKindFor(components)
  });

  const result = solveElectricalState({ graph, runtime: runtimeWithHighPin(null) });

  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-1\.d1 .*net flutuante/);
  assert.doesNotMatch(result.diagnostics.join('\n'), /arduino-2\.d0 .*net flutuante/);
});

function createComponents() {
  return new Map([
    ['arduino-1', componentFromDefinition('arduino-1', 'arduino', {})],
    ['resistor-1', componentFromDefinition('resistor-1', 'resistor', { resistanceOhms: 220, maximumPowerWatts: 0.25 })],
    ['led-1', componentFromDefinition('led-1', 'led', { forwardVoltage: 2, recommendedCurrent: 0.01, minimumVisibleCurrent: 0.001, maximumCurrent: 0.02 })]
  ]);
}

function componentFromDefinition(id, type, properties) {
  const definition = componentDefinitions[type];

  return {
    id,
    type,
    behavior: definition.behavior ?? {},
    electricalModel: definition.electricalModel ?? null,
    electricalPrimitive: definition.electricalPrimitive,
    properties: { ...(definition.properties ?? {}), ...properties }
  };
}

function net(id, references) {
  return {
    id,
    kind: 'electrical',
    terminals: references.map((reference) => {
      const [componentId, terminalId] = reference.split('.');
      return { componentId, terminalId };
    })
  };
}

function terminalKind(terminal) {
  const component = createComponents().get(terminal.componentId);
  const definition = componentDefinitions[component?.type];
  return definition?.terminals.find((item) => item.id === terminal.terminalId)?.kind ?? 'signal';
}

function terminalKindFor(components) {
  return (terminal) => {
    const component = components.get(terminal.componentId);
    const definition = componentDefinitions[component?.type];
    return definition?.terminals.find((item) => item.id === terminal.terminalId)?.kind ?? 'signal';
  };
}

function runtimeWithHighPin(highPin) {
  return {
    getPin(pin) {
      return {
        mode: pin === highPin ? 'OUTPUT' : 'INPUT',
        value: pin === highPin ? 'HIGH' : 'LOW'
      };
    }
  };
}

function runtimeWithPwmPins(pins) {
  return {
    getPin(pin) {
      const pwmValue = pins.get(pin);

      return {
        mode: Number.isFinite(pwmValue) ? 'OUTPUT' : 'INPUT',
        value: Number(pwmValue) > 0 ? 'HIGH' : 'LOW',
        pwmValue
      };
    }
  };
}

function readManifest(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}
