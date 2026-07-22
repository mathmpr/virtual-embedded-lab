import { terminalReference } from '../components.js';
import { propertyLabel, stateText } from '../i18n.js';

export function createSignalSnapshot({ graph, runtime, runtimesByComponent = null, electrical }) {
  const signalsByNet = new Map();

  for (const net of graph.nets) {
    signalsByNet.set(net.id, netSignal({ graph, runtime, runtimesByComponent, electrical, net }));
  }

  const signalsByComponent = new Map();

  for (const component of graph.components.values()) {
    const properties = propertySignals(component);
    const terminals = (component.terminals ?? []).map((terminal) => {
      const net = graph.findTerminalNet(component.id, terminal.id);
      const signal = signalForTerminal({ graph, runtime, runtimesByComponent, electrical, terminal: { componentId: component.id, terminalId: terminal.id }, net });
      const connected = connectedTerminalLabels(component.id, net);
      const pinLabel = signal.name ? ` (${signal.name})` : '';

      return {
        terminalId: terminal.id,
        label: `${terminal.label ?? terminal.id}${pinLabel}${connected ? ` -> ${connected}` : ''}`,
        ...signal
      };
    });
    const electricalSignals = electricalSignalsForComponent(electrical.componentReadings.get(component.id));

    signalsByComponent.set(component.id, {
      componentId: component.id,
      properties,
      terminals,
      electrical: electricalSignals
    });
  }

  return {
    signalsByComponent,
    signalsByNet
  };
}

function propertySignals(component) {
  return Object.entries(component.properties ?? {})
    .filter(([, value]) => typeof value === 'boolean' || Number.isFinite(Number(value)))
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return {
          label: labelFromPropertyName(key),
          value: value ? 1 : 0,
          text: value ? stateText('ON') : stateText('OFF')
        };
      }

      const numberValue = Number(value);

      return {
        label: labelFromPropertyName(key),
        value: normalizePropertySignal(key, numberValue),
        text: formatPropertySignal(key, numberValue)
      };
    });
}

function signalForTerminal({ graph, runtime, runtimesByComponent, electrical, terminal, net }) {
  const directRuntime = runtimeSignalForTerminal({ graph, runtime: runtimeForTerminal({ graph, runtime, runtimesByComponent, terminal }), terminal });

  if (directRuntime) {
    return directRuntime;
  }

  const netRuntime = runtimeSignalForNet({ graph, runtime, runtimesByComponent, net });

  if (netRuntime) {
    return netRuntime;
  }

  const reading = net ? electrical.netReadings.get(net.id) : null;

  if (reading) {
    return {
      value: normalizeVoltage(reading.voltageVolts),
      text: reading.voltageVolts === null ? reading.state : `${formatVoltage(reading.voltageVolts)} / ${reading.state}`
    };
  }

  const kind = graph.terminalKind(terminal);

  if (kind === 'power') {
    return { value: 1, text: 'VCC' };
  }

  if (kind === 'ground') {
    return { value: 0, text: 'GND' };
  }

  return {
    value: 0,
    text: net ? 'conectado' : 'desconectado'
  };
}

function netSignal({ graph, runtime, runtimesByComponent, electrical, net }) {
  const runtimeSignal = runtimeSignalForNet({ graph, runtime, runtimesByComponent, net });

  if (runtimeSignal) {
    return runtimeSignal;
  }

  const reading = electrical.netReadings.get(net.id);

  if (reading) {
    return {
      netId: net.id,
      value: normalizeVoltage(reading.voltageVolts),
      text: reading.voltageVolts === null ? reading.state : `${formatVoltage(reading.voltageVolts)} / ${reading.state}`
    };
  }

  return {
    netId: net.id,
    value: 0,
    text: 'conectado'
  };
}

function runtimeSignalForNet({ graph, runtime, runtimesByComponent, net }) {
  if (!net) {
    return null;
  }

  for (const terminal of net.terminals) {
    const signal = runtimeSignalForTerminal({
      graph,
      runtime: runtimeForTerminal({ graph, runtime, runtimesByComponent, terminal }),
      terminal
    });

    if (signal) {
      return signal;
    }
  }

  return null;
}

function runtimeForTerminal({ graph, runtime, runtimesByComponent, terminal }) {
  if (!runtimesByComponent) {
    return runtime;
  }

  const component = graph.components.get(terminal.componentId);

  if (component?.behavior?.type === 'microcontroller') {
    return runtimesByComponent.get(component.id) ?? runtime;
  }

  return runtime;
}

function runtimeSignalForTerminal({ graph, runtime, terminal }) {
  if (!runtime) {
    return null;
  }

  const component = graph.components.get(terminal.componentId);
  const pin = component?.behavior?.pinMap?.[terminal.terminalId];

  if (!pin) {
    return null;
  }

  if (pin.capabilities?.includes('digital') && Number.isInteger(pin.number) && runtime.getPinsSnapshot()[pin.number]) {
    const state = runtime.getPinsSnapshot()[pin.number];
    return {
      value: state.value === 'HIGH' ? 1 : 0,
      text: `${stateText(state.value)} / ${state.mode}`,
      name: pin.name ?? `GPIO ${pin.number}`
    };
  }

  if (pin.capabilities?.includes('analog') && Number.isInteger(pin.analogNumber) && runtime.getAnalogPinsSnapshot()[pin.analogNumber]) {
    const analog = runtime.getAnalogPinsSnapshot()[pin.analogNumber];
    return {
      value: normalizeAnalog(analog.value),
      text: `${analog.value} / ${formatVoltage(analog.voltageVolts)}`,
      name: pin.name ?? `ADC ${pin.analogNumber}`,
      voltageVolts: analog.voltageVolts
    };
  }

  return null;
}

function electricalSignalsForComponent(reading) {
  if (!reading) {
    return [];
  }

  return [
    { label: 'Tensão', value: normalizeVoltage(reading.voltageVolts), text: formatVoltage(reading.voltageVolts) },
    { label: 'Corrente', value: normalizeCurrent(reading.currentAmps), text: formatCurrent(reading.currentAmps) },
    { label: 'Potência', value: normalizePower(reading.powerWatts), text: formatPower(reading.powerWatts) }
  ];
}

function connectedTerminalLabels(componentId, net) {
  if (!net) {
    return '';
  }

  return net.terminals
    .filter((terminal) => terminal.componentId !== componentId)
    .slice(0, 3)
    .map((terminal) => terminalReference(terminal))
    .join(', ');
}

function labelFromPropertyName(name) {
  return propertyLabel(name);
}

function formatPropertySignal(key, value) {
  if (/distance/i.test(key)) {
    return `${Math.round(value)} cm`;
  }

  if (/intensity|strength|percent/i.test(key)) {
    return `${Math.round(value)}%`;
  }

  if (/temperature/i.test(key)) {
    return `${value.toFixed(1)} °C`;
  }

  if (/pressure/i.test(key)) {
    return `${Math.round(value)} hPa`;
  }

  if (/voltage/i.test(key)) {
    return formatVoltage(value);
  }

  if (/resistance/i.test(key)) {
    return `${Math.round(value)} Ω`;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function normalizePropertySignal(key, value) {
  if (/distance/i.test(key)) {
    return clamp(value / 200, 0, 1);
  }

  if (/intensity|strength|percent/i.test(key)) {
    return clamp(value / 100, 0, 1);
  }

  if (/temperature/i.test(key)) {
    return clamp((value + 20) / 80, 0, 1);
  }

  if (/pressure/i.test(key)) {
    return clamp((value - 900) / 250, 0, 1);
  }

  if (/voltage/i.test(key)) {
    return clamp(value / 5, 0, 1);
  }

  if (/resistance/i.test(key)) {
    return clamp(Math.log10(Math.max(1, value)) / 6, 0, 1);
  }

  return clamp(value, 0, 1);
}

function formatVoltage(value) {
  return value === null || value === undefined ? '-- V' : `${Number(value).toFixed(2)} V`;
}

function formatCurrent(value) {
  if (value === null || value === undefined) {
    return '-- A';
  }

  const amps = Math.abs(Number(value));
  return amps < 1 ? `${(amps * 1000).toFixed(2)} mA` : `${amps.toFixed(3)} A`;
}

function formatPower(value) {
  if (value === null || value === undefined) {
    return '-- W';
  }

  const watts = Math.abs(Number(value));
  return watts < 1 ? `${(watts * 1000).toFixed(2)} mW` : `${watts.toFixed(3)} W`;
}

function normalizeVoltage(value) {
  return value === null || value === undefined ? 0 : clamp(Number(value) / 5, 0, 1);
}

function normalizeCurrent(value) {
  return value === null || value === undefined ? 0 : clamp(Math.abs(Number(value)) / 0.03, 0, 1);
}

function normalizePower(value) {
  return value === null || value === undefined ? 0 : clamp(Math.abs(Number(value)) / 0.15, 0, 1);
}

function normalizeAnalog(value) {
  return clamp(Number(value) / 1023, 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
