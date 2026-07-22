export function createPinResolver({ componentDefinitions }) {
  function pinForTerminal({ component, terminalId }) {
    const definition = componentDefinitions[component?.type];
    const pin = definition?.pinMap?.[terminalId];

    return pin ? { terminalId, ...pin } : null;
  }

  function runtimePinSignal({ terminal, component, runtime }) {
    const pin = pinForTerminal({ component, terminalId: terminal.terminalId });

    if (!pin) {
      return null;
    }

    if (pin.capabilities?.includes('digital') && Number.isInteger(pin.number) && runtime.pinStates[pin.number]) {
      const state = runtime.pinStates[pin.number];
      return {
        value: state.value === 'HIGH' ? 1 : 0,
        text: `${state.value} / ${state.mode}`,
        name: pin.name ?? `GPIO ${pin.number}`
      };
    }

    if (pin.capabilities?.includes('analog') && Number.isInteger(pin.analogNumber) && runtime.analogPinStates[pin.analogNumber]) {
      const analog = runtime.analogPinStates[pin.analogNumber];
      return {
        value: analog.value,
        voltageVolts: analog.voltageVolts,
        name: pin.name ?? `ADC ${pin.analogNumber}`
      };
    }

    return null;
  }

  return {
    pinForTerminal,
    runtimePinSignal
  };
}
