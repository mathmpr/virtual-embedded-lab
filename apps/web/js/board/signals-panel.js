import { terminalReference } from '../components.js';
import { stateText, t } from '../i18n.js';
import { createPinResolver } from './pin-resolver.js';
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
  const pinResolver = createPinResolver({ componentDefinitions });

  function renderSignals() {
    const component = state.components.get(state.selectedId);

    if (!component) {
      signalMonitor.innerHTML = `<p class="muted">${t('Select a component to view derived connection signals.')}</p>`;
      return;
    }

    const snapshot = state.signalsByComponent?.get(component.id);
    const cards = snapshot
      ? signalCardsForComponentSnapshot(snapshot)
      : [
          propertySignalCard(component),
          terminalSignalCard(component),
          electricalSignalCard(component)
        ].filter(Boolean);

    signalMonitor.innerHTML = cards.length > 0
      ? cards.join('')
      : `<p class="muted">${t('This component does not have derived project signals yet.')}</p>`;
  }

  function signalCardsForComponentSnapshot(snapshot) {
    return [
      snapshotSignalCard(t('Properties'), snapshot.properties),
      snapshotSignalCard(t('Terminals and connections'), snapshot.terminals),
      snapshotSignalCard(t('Electrical'), snapshot.electrical)
    ].filter(Boolean);
  }

  function snapshotSignalCard(title, signals) {
    const rows = (signals ?? []).map((signal) => signalRow(signal.label, signal.value, signal.text));

    return rows.length > 0 ? signalCard(title, rows) : null;
  }

  function propertySignalCard(component) {
    const rows = Object.entries(component.properties ?? {})
      .filter(([, value]) => typeof value === 'boolean' || Number.isFinite(Number(value)))
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return signalRow(labelFromPropertyName(key), value ? 1 : 0, value ? stateText('ON') : stateText('OFF'));
        }

        return signalRow(labelFromPropertyName(key), normalizePropertySignal(key, Number(value)), formatPropertySignal(key, Number(value)));
      });

    return rows.length > 0 ? signalCard(t('Properties'), rows) : null;
  }

  function terminalSignalCard(component) {
    const definition = componentDefinitions[component.type];
    const rows = (definition?.terminals ?? []).map((terminal) => terminalSignalRow(component, terminal));

    return rows.length > 0 ? signalCard(t('Terminals and connections'), rows) : null;
  }

  function terminalSignalRow(component, terminal) {
    const terminalRef = { componentId: component.id, terminalId: terminal.id };
    const net = netForTerminal(terminalRef);
    const signal = signalForTerminalNet(terminalRef, net);
    const connected = connectedTerminalLabels(component.id, net);
    const pinLabel = signal.name ? ` (${signal.name})` : '';
    const label = `${terminal.label ?? terminal.id}${pinLabel}${connected ? ` -> ${connected}` : ''}`;

    return signalRow(label, signal.value, signal.text);
  }

  function electricalSignalCard(component) {
    const reading = state.electrical.componentReadings.get(component.id);

    if (!reading) {
      return null;
    }

    return signalCard(t('Electrical'), [
      signalRow(t('Voltage'), normalizeVoltage(reading.voltageVolts), formatVoltage(reading.voltageVolts)),
      signalRow(t('Current'), normalizeCurrent(reading.currentAmps), formatCurrent(reading.currentAmps)),
      signalRow(t('Power'), normalizePower(reading.powerWatts), formatPower(reading.powerWatts))
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

    const netSignal = net ? state.signalsByNet?.get(net.id) : null;

    if (netSignal) {
      return netSignal;
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
    const component = state.components.get(terminal.componentId);
    const signal = pinResolver.runtimePinSignal({ terminal, component, runtime: state.runtime });

    if (signal?.voltageVolts !== undefined) {
      return {
        value: normalizeAnalog(signal.value),
        text: `${signal.value} / ${formatVoltage(signal.voltageVolts)}`
      };
    }

    return signal;
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
        <span class="signal-value">${text ?? (value ? stateText('HIGH') : stateText('LOW'))}</span>
      </div>
    `;
  }

  return {
    renderSignals
  };
}
