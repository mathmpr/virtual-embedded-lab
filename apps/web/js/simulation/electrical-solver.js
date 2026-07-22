export function solveElectricalState({ graph, runtime }) {
  const diagnostics = [];
  const ledStates = new Map();
  const componentReadings = new Map();
  const netReadings = new Map();
  const arduino = graph.findComponentsByType('arduino')[0] ?? null;
  const drivenHighPins = findDrivenHighPins({ runtime, arduino });

  detectShorts({ graph, arduino, drivenHighPins, diagnostics, netReadings });

  for (const led of findElectricalComponents(graph, 'led', 'led')) {
    const solved = solveLedPath({ graph, arduino, led, drivenHighPins });

    ledStates.set(led.id, solved.isLit);
    componentReadings.set(led.id, solved.ledReading);

    if (solved.resistorReading) {
      componentReadings.set(solved.resistorReading.componentId, solved.resistorReading);
    }

    diagnostics.push(...solved.diagnostics);
  }

  return {
    ledStates,
    componentReadings,
    netReadings,
    diagnostics
  };
}

function solveLedPath({ graph, arduino, led, drivenHighPins }) {
  const diagnostics = [];
  const defaultReading = {
    componentId: led.id,
    type: 'led',
    voltageVolts: 0,
    currentAmps: 0,
    powerWatts: 0,
    brightness: 0,
    state: 'off'
  };

  if (!arduino || drivenHighPins.length === 0) {
    return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
  }

  const grounded = isTerminalConnectedToGround(graph, { componentId: led.id, terminalId: 'cathode' });

  if (!grounded) {
    diagnostics.push(`${led.id}: catodo não está conectado ao GND.`);
    return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
  }

  if (isLedAnodeDirectlyDriven({ graph, led, drivenHighPins })) {
    diagnostics.push(`${led.id}: LED ligado a saída HIGH sem resistor em série.`);
    return {
      isLit: true,
      ledReading: {
        ...defaultReading,
        currentAmps: Number.POSITIVE_INFINITY,
        brightness: 1,
        state: 'overcurrent'
      },
      resistorReading: null,
      diagnostics
    };
  }

  for (const resistor of findElectricalComponents(graph, 'resistor', 'resistor')) {
    const path = findSeriesPath({ graph, resistor, led, drivenHighPins });

    if (!path) {
      continue;
    }

    const electrical = solveLedSeriesCircuit({
      supplyVoltage: 5,
      forwardVoltage: Number(led.properties.forwardVoltage ?? 2),
      resistanceOhms: Number(resistor.properties.resistanceOhms ?? 220),
      recommendedCurrentAmps: Number(led.properties.recommendedCurrent ?? 0.01),
      minimumVisibleCurrentAmps: Number(led.properties.minimumVisibleCurrent ?? 0.001),
      maximumCurrentAmps: Number(led.properties.maximumCurrent ?? 0.02),
      resistorMaximumPowerWatts: Number(resistor.properties.maximumPowerWatts ?? 0.25)
    });

    diagnostics.push(...electrical.diagnostics.map((diagnostic) => `${led.id}/${resistor.id}: ${diagnostic.message}`));

    return {
      isLit: electrical.ledIsVisible,
      ledReading: {
        componentId: led.id,
        type: 'led',
        voltageVolts: electrical.ledVoltageDrop,
        currentAmps: electrical.ledCurrentAmps,
        powerWatts: electrical.ledCurrentAmps * electrical.ledVoltageDrop,
        brightness: electrical.ledBrightness,
        state: electrical.ledState
      },
      resistorReading: {
        componentId: resistor.id,
        type: 'resistor',
        voltageVolts: electrical.resistorVoltageDrop,
        currentAmps: electrical.ledCurrentAmps,
        powerWatts: electrical.resistorPowerWatts,
        resistanceOhms: Number(resistor.properties.resistanceOhms ?? 220),
        state: electrical.resistorPowerWatts > Number(resistor.properties.maximumPowerWatts ?? 0.25) ? 'overpower' : 'ok'
      },
      diagnostics
    };
  }

  diagnostics.push(`${led.id}: nenhum resistor em série encontrado entre saída HIGH e anodo.`);
  return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
}

function findSeriesPath({ graph, resistor, led, drivenHighPins }) {
  return drivenHighPins.find((pinTerminal) => {
    const pinToA = graph.areConnected(pinTerminal, { componentId: resistor.id, terminalId: 'a' });
    const pinToB = graph.areConnected(pinTerminal, { componentId: resistor.id, terminalId: 'b' });
    const anodeFromA = graph.areConnected({ componentId: resistor.id, terminalId: 'a' }, { componentId: led.id, terminalId: 'anode' });
    const anodeFromB = graph.areConnected({ componentId: resistor.id, terminalId: 'b' }, { componentId: led.id, terminalId: 'anode' });

    return (pinToA && anodeFromB) || (pinToB && anodeFromA);
  }) ?? null;
}

function isLedAnodeDirectlyDriven({ graph, led, drivenHighPins }) {
  return drivenHighPins.some((pinTerminal) => {
    return graph.areConnected(pinTerminal, { componentId: led.id, terminalId: 'anode' });
  });
}

function findElectricalComponents(graph, primitive, legacyType) {
  return [...graph.components.values()].filter((component) => {
    return component.electricalPrimitive === primitive || component.type === legacyType;
  });
}

function isTerminalConnectedToGround(graph, terminal) {
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!net) {
    return false;
  }

  return net.terminals.some((candidate) => {
    const sameTerminal = candidate.componentId === terminal.componentId && candidate.terminalId === terminal.terminalId;
    return !sameTerminal && graph.terminalKind(candidate) === 'ground';
  });
}

function findDrivenHighPins({ runtime, arduino }) {
  if (!arduino) {
    return [];
  }

  return [...Array(20).keys()]
    .filter((pin) => runtime.getPin(pin).mode === 'OUTPUT' && runtime.getPin(pin).value === 'HIGH')
    .map((pin) => ({ componentId: arduino.id, terminalId: `d${pin}` }));
}

function detectShorts({ graph, arduino, drivenHighPins, diagnostics, netReadings }) {
  for (const net of graph.nets) {
    const hasPower = net.terminals.some((terminal) => graph.terminalKind(terminal) === 'power');
    const hasGround = net.terminals.some((terminal) => graph.terminalKind(terminal) === 'ground');
    const hasDrivenHigh = drivenHighPins.some((pinTerminal) => {
      return net.terminals.some((terminal) => terminal.componentId === pinTerminal.componentId && terminal.terminalId === pinTerminal.terminalId);
    });

    if (hasPower && hasGround) {
      diagnostics.push(`${net.id}: curto direto entre 5V e GND.`);
      netReadings.set(net.id, { voltageVolts: 0, state: 'short' });
      continue;
    }

    if (arduino && hasDrivenHigh && hasGround) {
      diagnostics.push(`${net.id}: saída HIGH conectada diretamente ao GND.`);
      netReadings.set(net.id, { voltageVolts: 0, state: 'short' });
      continue;
    }

    if (hasPower || hasDrivenHigh) {
      netReadings.set(net.id, { voltageVolts: 5, state: 'driven-high' });
    } else if (hasGround) {
      netReadings.set(net.id, { voltageVolts: 0, state: 'ground' });
    } else {
      netReadings.set(net.id, { voltageVolts: null, state: 'floating' });
    }
  }
}

function solveLedSeriesCircuit(input) {
  const diagnostics = [];

  if (input.resistanceOhms <= 0) {
    return {
      ledCurrentAmps: Number.POSITIVE_INFINITY,
      ledVoltageDrop: input.forwardVoltage,
      resistorVoltageDrop: input.supplyVoltage - input.forwardVoltage,
      resistorPowerWatts: Number.POSITIVE_INFINITY,
      ledBrightness: 1,
      ledIsVisible: true,
      ledState: 'overcurrent',
      diagnostics: [
        { severity: 'error', code: 'LED_WITHOUT_RESISTOR', message: 'LED conectado sem resistência efetiva de limitação de corrente.' }
      ]
    };
  }

  const resistorVoltageDrop = Math.max(input.supplyVoltage - input.forwardVoltage, 0);
  const ledCurrentAmps = resistorVoltageDrop / input.resistanceOhms;
  const resistorPowerWatts = ledCurrentAmps * ledCurrentAmps * input.resistanceOhms;
  const ledBrightness = clamp(ledCurrentAmps / input.recommendedCurrentAmps, 0, 1);
  const ledIsVisible = ledCurrentAmps >= input.minimumVisibleCurrentAmps;
  const ledVoltageDrop = resistorVoltageDrop > 0 ? input.forwardVoltage : input.supplyVoltage;
  const ledState = ledIsVisible ? 'on' : ledCurrentAmps > 0 ? 'low-current' : 'off';

  if (input.supplyVoltage < input.forwardVoltage) {
    diagnostics.push({
      severity: 'warning',
      code: 'LED_INSUFFICIENT_VOLTAGE',
      message: `tensão de alimentação ${input.supplyVoltage.toFixed(2)} V abaixo da tensão direta ${input.forwardVoltage.toFixed(2)} V.`
    });
  }

  if (ledCurrentAmps > 0 && ledCurrentAmps < input.minimumVisibleCurrentAmps) {
    diagnostics.push({
      severity: 'warning',
      code: 'LED_CURRENT_TOO_LOW',
      message: `corrente do LED ${formatAmps(ledCurrentAmps)} abaixo do mínimo visível ${formatAmps(input.minimumVisibleCurrentAmps)}; resistência provavelmente excessiva.`
    });
  }

  if (ledCurrentAmps > input.maximumCurrentAmps) {
    diagnostics.push({
      severity: 'error',
      code: 'LED_OVERCURRENT',
      message: `corrente do LED ${formatAmps(ledCurrentAmps)} excede o máximo ${formatAmps(input.maximumCurrentAmps)}.`
    });
  }

  if (resistorPowerWatts > input.resistorMaximumPowerWatts) {
    diagnostics.push({
      severity: 'warning',
      code: 'RESISTOR_POWER_EXCEEDED',
      message: `potência no resistor ${resistorPowerWatts.toFixed(3)} W excede ${input.resistorMaximumPowerWatts.toFixed(3)} W.`
    });
  }

  return {
    ledCurrentAmps,
    ledVoltageDrop,
    resistorVoltageDrop,
    resistorPowerWatts,
    ledBrightness,
    ledIsVisible,
    ledState,
    diagnostics
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatAmps(value) {
  return `${(value * 1000).toFixed(1)} mA`;
}
