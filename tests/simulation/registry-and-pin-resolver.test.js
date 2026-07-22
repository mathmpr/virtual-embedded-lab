import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationBehaviorRegistry } from '../../apps/web/js/simulation/behavior-registry.js';
import {
  resolveAnalogPinConnectedToTerminal,
  resolveDigitalPinConnectedToTerminal,
  resolveI2cBusConnected,
  resolveSpiBusConnected
} from '../../apps/web/js/simulation/pin-capability-resolver.js';

test('simulation behavior registry binds fake components by behavior type', () => {
  const registry = createSimulationBehaviorRegistry();
  const bound = [];

  registry.register('fake-sensor', ({ behaviorType, components }) => {
    bound.push({ behaviorType, componentIds: components.map((component) => component.id) });
    return {
      rainBindings: [{ sensor: components[0], pin: 7, channelId: 'fake.rain' }]
    };
  });

  const bindings = registry.bindAll({
    graph: {
      findComponentsByBehaviorType(type) {
        return type === 'fake-sensor'
          ? [{ id: 'fake-1', behavior: { type: 'fake-sensor' } }]
          : [];
      }
    }
  });

  assert.deepEqual(bound, [{ behaviorType: 'fake-sensor', componentIds: ['fake-1'] }]);
  assert.equal(bindings.rainBindings[0].channelId, 'fake.rain');
});

test('pin capability resolver resolves fake board pins by manifest capabilities', () => {
  const board = {
    id: 'board-1',
    behavior: {
      type: 'microcontroller',
      pinMap: {
        sig: { number: 42, name: 'SIG42', capabilities: ['digital'] },
        adc: { number: 43, analogNumber: 7, name: 'ADC7', capabilities: ['analog'] },
        sda0: { number: 10, capabilities: ['digital', 'i2c-sda'] },
        scl0: { number: 11, capabilities: ['digital', 'i2c-scl'] },
        sck0: { number: 12, capabilities: ['digital', 'spi-sck'] },
        miso0: { number: 13, capabilities: ['digital', 'spi-miso'] },
        mosi0: { number: 14, capabilities: ['digital', 'spi-mosi'] }
      },
      buses: {
        i2c: [{ id: 'fake-i2c', sda: 'sda0', scl: 'scl0' }],
        spi: [{ id: 'fake-spi', sck: 'sck0', miso: 'miso0', mosi: 'mosi0' }]
      }
    }
  };
  const peripheral = { id: 'device-1', behavior: {} };
  const graph = fakeGraph({
    components: [board, peripheral],
    nets: [
      net('net-digital', ['board-1.sig', 'device-1.in']),
      net('net-analog', ['board-1.adc', 'device-1.analog']),
      net('net-sda', ['board-1.sda0', 'device-1.sda']),
      net('net-scl', ['board-1.scl0', 'device-1.scl']),
      net('net-sck', ['board-1.sck0', 'device-1.clk']),
      net('net-miso', ['board-1.miso0', 'device-1.dout']),
      net('net-mosi', ['board-1.mosi0', 'device-1.din'])
    ]
  });

  assert.equal(resolveDigitalPinConnectedToTerminal(graph, { componentId: 'device-1', terminalId: 'in' }), 42);
  assert.equal(resolveAnalogPinConnectedToTerminal(graph, { componentId: 'device-1', terminalId: 'analog' }), 7);
  assert.equal(resolveI2cBusConnected(graph, peripheral).bus.id, 'fake-i2c');
  assert.equal(resolveSpiBusConnected(graph, peripheral).bus.id, 'fake-spi');
});

function fakeGraph({ components, nets }) {
  const componentMap = new Map(components.map((component) => [component.id, component]));

  return {
    findComponentsByBehaviorType(type) {
      return [...componentMap.values()].filter((component) => component.behavior?.type === type);
    },
    findTerminalNet(componentId, terminalId) {
      return nets.find((item) => {
        return item.terminals.some((terminal) => terminal.componentId === componentId && terminal.terminalId === terminalId);
      }) ?? null;
    },
    areConnected(left, right) {
      const leftNet = this.findTerminalNet(left.componentId, left.terminalId);
      const rightNet = this.findTerminalNet(right.componentId, right.terminalId);
      return Boolean(leftNet && rightNet && leftNet.id === rightNet.id);
    }
  };
}

function net(id, terminals) {
  return {
    id,
    terminals: terminals.map((reference) => {
      const [componentId, terminalId] = reference.split('.');
      return { componentId, terminalId };
    })
  };
}
