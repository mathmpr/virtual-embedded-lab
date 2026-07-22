import { terminalReference } from '../components.js';

export function createCircuitGraph({ components, nets, terminalKind }) {
  const netByTerminal = new Map();

  for (const net of nets) {
    for (const terminal of net.terminals) {
      netByTerminal.set(terminalReference(terminal), net);
    }
  }

  function findComponentsByType(type) {
    return [...components.values()].filter((component) => component.type === type);
  }

  function findTerminalNet(componentId, terminalId) {
    return netByTerminal.get(`${componentId}.${terminalId}`) ?? null;
  }

  function areConnected(left, right) {
    const leftNet = findTerminalNet(left.componentId, left.terminalId);
    const rightNet = findTerminalNet(right.componentId, right.terminalId);
    return Boolean(leftNet && rightNet && leftNet.id === rightNet.id);
  }

  function driveArduinoPin(pin, value) {
    const arduino = findComponentsByType('arduino')[0];

    if (!arduino) {
      return;
    }

    const terminalId = `d${pin}`;
    const net = findTerminalNet(arduino.id, terminalId);

    if (!net) {
      return;
    }

    for (const terminal of net.terminals) {
      for (const listener of terminalListeners) {
        listener(terminal, value);
      }
    }
  }

  const terminalListeners = [];

  return {
    components,
    nets,
    terminalKind,
    findComponentsByType,
    findTerminalNet,
    areConnected,
    driveArduinoPin,
    onTerminalDriven(listener) {
      terminalListeners.push(listener);
    }
  };
}
