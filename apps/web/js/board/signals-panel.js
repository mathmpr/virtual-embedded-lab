import { terminalReference } from '../components.js';
import {
  formatCurrent,
  formatPower,
  formatPropertySignal,
  formatVoltage,
  labelFromPropertyName,
  normalizeAnalog,
  normalizeCurrent,
  normalizePower,
  normalizePropertySignal,
  normalizeVoltage
} from './formatters.js';

export function createSignalsPanel({ state, signalMonitor, componentDefinitions, getNets, terminalKind }) {
  function renderSignals() {
    const component = state.components.get(state.selectedId);

    if (!component) {
      signalMonitor.innerHTML = '<p class="muted">Selecione um componente para ver sinais derivados das conexões.</p>';
      return;
    }

    const cards = [
      propertySignalCard(component),
      terminalSignalCard(component),
      electricalSignalCard(component)
    ].filter(Boolean);

    signalMonitor.innerHTML = cards.length > 0
      ? cards.join('')
      : '<p class="muted">Este componente ainda não possui sinais derivados do projeto.</p>';
  }

  function propertySignalCard(component) {
    const rows = Object.entries(component.properties ?? {})
      .filter(([, value]) => typeof value === 'boolean' || Number.isFinite(Number(value)))
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return signalRow(labelFromPropertyName(key), value ? 1 : 0, value ? 'ON' : 'OFF');
        }

        return signalRow(labelFromPropertyName(key), normalizePropertySignal(key, Number(value)), formatPropertySignal(key, Number(value)));
      });

    return rows.length > 0 ? signalCard('Propriedades', rows) : null;
  }

  function terminalSignalCard(component) {
    const definition = componentDefinitions[component.type];
    const rows = (definition?.terminals ?? []).map((terminal) => terminalSignalRow(component, terminal));

    return rows.length > 0 ? signalCard('Terminais e conexões', rows) : null;
  }

  function terminalSignalRow(component, terminal) {
    const terminalRef = { componentId: component.id, terminalId: terminal.id };
    const net = netForTerminal(terminalRef);
    const signal = signalForTerminalNet(terminalRef, net);
    const connected = connectedTerminalLabels(component.id, net);
    const label = `${terminal.label ?? terminal.id}${connected ? ` -> ${connected}` : ''}`;

    return signalRow(label, signal.value, signal.text);
  }

  function electricalSignalCard(component) {
    const reading = state.electrical.componentReadings.get(component.id);

    if (!reading) {
      return null;
    }

    return signalCard('Elétrico', [
      signalRow('Tensão', normalizeVoltage(reading.voltageVolts), formatVoltage(reading.voltageVolts)),
      signalRow('Corrente', normalizeCurrent(reading.currentAmps), formatCurrent(reading.currentAmps)),
      signalRow('Potência', normalizePower(reading.powerWatts), formatPower(reading.powerWatts))
    ]);
  }

  function signalForTerminalNet(terminal, net) {
    const directRuntime = runtimeSignalForTerminal(terminal);

    if (directRuntime) {
      return directRuntime;
    }

    const netRuntime = runtimeSignalForNet(net);

    if (netRuntime) {
      return netRuntime;
    }

    const reading = net ? state.electrical.netReadings.get(net.id) : null;

    if (reading) {
      return {
        value: normalizeVoltage(reading.voltageVolts),
        text: reading.voltageVolts === null ? reading.state : `${formatVoltage(reading.voltageVolts)} / ${reading.state}`
      };
    }

    const kind = terminalKind(terminal);

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

  function runtimeSignalForNet(net) {
    if (!net) {
      return null;
    }

    for (const terminal of net.terminals) {
      const signal = runtimeSignalForTerminal(terminal);

      if (signal) {
        return signal;
      }
    }

    return null;
  }

  function runtimeSignalForTerminal(terminal) {
    const digitalPin = digitalPinFromTerminal(terminal);

    if (Number.isInteger(digitalPin) && state.runtime.pinStates[digitalPin]) {
      const pin = state.runtime.pinStates[digitalPin];
      const value = pin.value === 'HIGH' ? 1 : 0;
      return { value, text: `${pin.value} / ${pin.mode}` };
    }

    const analogPin = analogPinFromTerminal(terminal);

    if (Number.isInteger(analogPin) && state.runtime.analogPinStates[analogPin]) {
      const analog = state.runtime.analogPinStates[analogPin];
      return {
        value: normalizeAnalog(analog.value),
        text: `${analog.value} / ${formatVoltage(analog.voltageVolts)}`
      };
    }

    return null;
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

  function netForTerminal(terminal) {
    return getNets().find((net) => {
      return net.terminals.some((item) => item.componentId === terminal.componentId && item.terminalId === terminal.terminalId);
    }) ?? null;
  }

  function digitalPinFromTerminal(terminal) {
    const match = terminal.terminalId.match(/^d(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function analogPinFromTerminal(terminal) {
    const arduinoMatch = terminal.terminalId.match(/^a([0-5])$/);

    if (arduinoMatch) {
      return 14 + Number(arduinoMatch[1]);
    }

    const espMatch = terminal.terminalId.match(/^io(\d+)$/);
    return espMatch ? Number(espMatch[1]) : null;
  }

  function signalCard(title, rows) {
    return `
      <div class="signal-card">
        <div class="signal-card-title">${title}</div>
        ${rows.join('')}
      </div>
    `;
  }

  function signalRow(label, value, text = null) {
    const normalizedValue = Math.max(0, Math.min(1, Number(value) || 0));

    return `
      <div class="signal-row">
        <span>${label}</span>
        <div class="signal-track"><div class="signal-fill" style="width:${Math.round(normalizedValue * 100)}%"></div></div>
        <span class="signal-value">${text ?? (value ? 'HIGH' : 'LOW')}</span>
      </div>
    `;
  }

  return {
    renderSignals
  };
}
