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
  readManifest('components/official/led-red/component.json'),
  readManifest('components/official/led-green/component.json')
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
