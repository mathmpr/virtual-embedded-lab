import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { componentDefinitions, installComponentCatalog } from '../../apps/web/js/components.js';
import { createCircuitGraph } from '../../apps/web/js/simulation/circuit-graph.js';
import { solveElectricalState } from '../../apps/web/js/simulation/electrical-solver.js';

const root = new URL('../..', import.meta.url).pathname;

installComponentCatalog([
  readManifest('components/official/arduino-uno/component.json'),
  readManifest('components/official/resistor/component.json'),
  readManifest('components/official/capacitor/component.json'),
  readManifest('components/official/led-red/component.json'),
  readManifest('components/official/led-green/component.json'),
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
    properties
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

function readManifest(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}
