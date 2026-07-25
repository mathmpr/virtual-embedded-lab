import test from 'node:test';
import assert from 'node:assert/strict';
import { ArduinoRuntime } from '../../apps/web/js/simulation/arduino-runtime.js';
import { createCircuitGraph } from '../../apps/web/js/simulation/circuit-graph.js';
import { createSignalSnapshot } from '../../apps/web/js/simulation/signal-snapshot.js';
import { EventScheduler, VirtualClock } from '../../apps/web/js/simulation/virtual-time.js';

test('signal snapshot exposes Arduino UNO terminals, runtime state and connected peers', () => {
  const components = new Map([
    ['arduino-1', arduinoComponent({
      terminals: [
        { id: 'd13', label: 'D13', kind: 'signal' },
        { id: 'gnd', label: 'GND', kind: 'ground' }
      ]
    })],
    ['led-1', {
      id: 'led-1',
      type: 'led',
      properties: {},
      terminals: [
        { id: 'anode', label: 'A', kind: 'signal' },
        { id: 'cathode', label: 'K', kind: 'ground' }
      ]
    }]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      {
        id: 'net-d13',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd13' },
          { componentId: 'led-1', terminalId: 'anode' }
        ]
      }
    ],
    terminalKind: terminalKindForComponents(components)
  });
  const clock = new VirtualClock();
  const runtime = new ArduinoRuntime(clock, new EventScheduler(clock), graph, { componentId: 'arduino-1' });

  runtime.pinMode(13, 'OUTPUT');
  runtime.digitalWrite(13, 'HIGH');

  const snapshot = createSignalSnapshot({ graph, runtime, electrical: emptyElectricalState() });
  const d13 = snapshot.signalsByComponent.get('arduino-1').terminals.find((terminal) => terminal.terminalId === 'd13');

  assert.ok(d13);
  assert.match(d13.label, /D13/);
  assert.match(d13.label, /led-1\.anode/);
  assert.match(d13.text, /OUTPUT/);
  assert.equal(d13.value, 1);
});

test('signal snapshot infers board pin terminals when legacy component state has no terminal list', () => {
  const components = new Map([
    ['arduino-1', arduinoComponent({ terminals: undefined })],
    ['led-1', { id: 'led-1', type: 'led', properties: {} }]
  ]);
  const graph = createCircuitGraph({
    components,
    nets: [
      {
        id: 'net-d13',
        terminals: [
          { componentId: 'arduino-1', terminalId: 'd13' },
          { componentId: 'led-1', terminalId: 'anode' }
        ]
      }
    ],
    terminalKind: terminalKindForComponents(components)
  });
  const clock = new VirtualClock();
  const runtime = new ArduinoRuntime(clock, new EventScheduler(clock), graph, { componentId: 'arduino-1' });

  runtime.pinMode(13, 'OUTPUT');
  runtime.digitalWrite(13, 'HIGH');

  const snapshot = createSignalSnapshot({ graph, runtime, electrical: emptyElectricalState() });
  const arduinoSignals = snapshot.signalsByComponent.get('arduino-1').terminals;

  assert.ok(arduinoSignals.some((terminal) => terminal.terminalId === 'd13' && /led-1\.anode/.test(terminal.label)));
});

function arduinoComponent({ terminals }) {
  return {
    id: 'arduino-1',
    type: 'arduino',
    behavior: {
      type: 'microcontroller',
      pinMap: {
        d13: { number: 13, name: 'D13', capabilities: ['digital'] }
      }
    },
    properties: {},
    terminals
  };
}

function terminalKindForComponents(components) {
  return (terminal) => {
    const manifestTerminal = components.get(terminal.componentId)?.terminals?.find((item) => item.id === terminal.terminalId);

    if (manifestTerminal?.kind) {
      return manifestTerminal.kind;
    }

    return /gnd|ground/i.test(terminal.terminalId) ? 'ground' : 'signal';
  };
}

function emptyElectricalState() {
  return {
    netReadings: new Map(),
    componentReadings: new Map()
  };
}
