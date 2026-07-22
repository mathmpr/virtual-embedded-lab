import { terminalReference } from '../components.js';

export function createCircuitGraph({ components, nets, terminalKind }) {
  const netByTerminal = new Map();

  for (const net of nets) {
    for (const terminal of net.terminals) {
      netByTerminal.set(terminalReference(terminal), net);
    }
  }

  function findComponentsByBehaviorType(type) {
    return [...components.values()].filter((component) => component.behavior?.type === type);
  }

  function findComponentsByBehaviorChannel(channel) {
    return [...components.values()].filter((component) => component.behavior?.channel === channel);
  }

  function findComponentsByEnvironmentChannel(channel) {
    return [...components.values()].filter((component) => component.behavior?.environmentChannel === channel);
  }

  function findComponentsBySimulationKind(kind) {
    return [...components.values()].filter((component) => component.simulation?.kind === kind);
  }

  function findComponentsByElectricalModelType(type) {
    return [...components.values()].filter((component) => component.electricalModel?.type === type);
  }

  function findComponentsByElectricalPrimitive(primitive) {
    return [...components.values()].filter((component) => component.electricalPrimitive === primitive || component.electricalModel?.primitive === primitive);
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
    const arduino = findComponentsByBehaviorType('microcontroller')[0];

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
    findComponentsByBehaviorType,
    findComponentsByBehaviorChannel,
    findComponentsByEnvironmentChannel,
    findComponentsBySimulationKind,
    findComponentsByElectricalModelType,
    findComponentsByElectricalPrimitive,
    findTerminalNet,
    areConnected,
    driveArduinoPin,
    onTerminalDriven(listener) {
      terminalListeners.push(listener);
    }
  };
}
