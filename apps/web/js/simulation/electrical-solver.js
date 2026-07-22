export function solveElectricalState({ graph, runtime }) {
  const diagnostics = [];
  const ledStates = new Map();
  const componentReadings = new Map();
  const netReadings = new Map();
  const arduino = graph.findComponentsByBehaviorType('microcontroller')[0] ?? null;
  const drivenHighPins = findDrivenHighPins({ runtime, arduino });
  const netlist = createElectricalNetlist({ graph, runtime, drivenHighPins });

  detectShorts({ graph, arduino, drivenHighPins, diagnostics, netReadings });
  applyGenericVoltageSources({ graph, netlist, diagnostics, netReadings });
  applyGenericResistors({ graph, netlist, diagnostics, componentReadings });
  applyGenericCapacitors({ graph, netlist, diagnostics, componentReadings });
  applySensorModuleLimits({ graph, netlist, diagnostics, componentReadings });
  diagnoseFloatingInputs({ graph, netlist, runtime, diagnostics });

  for (const led of findElectricalComponents(graph, 'led', 'diode-led')) {
    const solved = solveLedPath({ graph, arduino, led, drivenHighPins });

    ledStates.set(led.id, solved.isLit);
    componentReadings.set(led.id, solved.ledReading);

    if (solved.resistorReading) {
      componentReadings.set(solved.resistorReading.componentId, solved.resistorReading);
    }

    diagnostics.push(...solved.diagnostics);
  }

  return {
    netlist,
    ledStates,
    componentReadings,
    netReadings,
    diagnostics
  };
}

function solveLedPath({ graph, arduino, led, drivenHighPins }) {
  const diagnostics = [];
  const anodeTerminal = led.electricalModel?.anodeTerminal ?? 'anode';
  const cathodeTerminal = led.electricalModel?.cathodeTerminal ?? 'cathode';
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

  const grounded = isTerminalConnectedToGround(graph, { componentId: led.id, terminalId: cathodeTerminal });

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
    const path = findSeriesPath({ graph, resistor, led, drivenHighPins, anodeTerminal });

    if (!path) {
      continue;
    }

    const electrical = solveLedSeriesCircuit({
      supplyVoltage: supplyVoltageForDrivenTerminal({ graph, arduino, terminal: path }),
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

function findSeriesPath({ graph, resistor, led, drivenHighPins, anodeTerminal }) {
  return drivenHighPins.find((pinTerminal) => {
    const pinToA = graph.areConnected(pinTerminal, { componentId: resistor.id, terminalId: 'a' });
    const pinToB = graph.areConnected(pinTerminal, { componentId: resistor.id, terminalId: 'b' });
    const anodeFromA = graph.areConnected({ componentId: resistor.id, terminalId: 'a' }, { componentId: led.id, terminalId: anodeTerminal });
    const anodeFromB = graph.areConnected({ componentId: resistor.id, terminalId: 'b' }, { componentId: led.id, terminalId: anodeTerminal });

    return (pinToA && anodeFromB) || (pinToB && anodeFromA);
  }) ?? null;
}

function supplyVoltageForDrivenTerminal({ graph, arduino, terminal }) {
  const board = graph.components.get(terminal.componentId) ?? arduino;
  const pin = board?.behavior?.pinMap?.[terminal.terminalId];

  return Number(pin?.highVoltageVolts ?? board?.electricalModel?.logicVoltage ?? 5);
}

function isLedAnodeDirectlyDriven({ graph, led, drivenHighPins }) {
  const anodeTerminal = led.electricalModel?.anodeTerminal ?? 'anode';

  return drivenHighPins.some((pinTerminal) => {
    return graph.areConnected(pinTerminal, { componentId: led.id, terminalId: anodeTerminal });
  });
}

function findElectricalComponents(graph, ...primitives) {
  return [...graph.components.values()].filter((component) => {
    return primitives.includes(component.electricalPrimitive) || primitives.includes(component.electricalModel?.primitive);
  });
}

function terminalsForComponent(graph, component) {
  const terminalIds = new Set();

  for (const net of graph.nets) {
    for (const terminal of net.terminals) {
      if (terminal.componentId === component.id) {
        terminalIds.add(terminal.terminalId);
      }
    }
  }

  if (component.terminals) {
    for (const terminal of component.terminals) {
      terminalIds.add(terminal.id);
    }
  }

  return [...terminalIds].map((terminalId) => ({
    terminalId,
    kind: graph.terminalKind({ componentId: component.id, terminalId }),
    type: terminalTypeForComponent(component, terminalId)
  }));
}

function terminalTypeForComponent(component, terminalId) {
  const manifestTerminal = component.terminals?.find((terminal) => terminal.id === terminalId);

  if (manifestTerminal?.type) {
    return manifestTerminal.type;
  }

  if (/gnd|ground/i.test(terminalId)) {
    return 'ground';
  }

  if (/vcc|vdd|5v|3v3|vin/i.test(terminalId)) {
    return 'power-input';
  }

  return 'signal';
}

function voltageForNet(netlist, netId) {
  if (!netId) {
    return null;
  }

  const voltage = netlist.nodes.get(netId)?.voltageVolts;
  return Number.isFinite(voltage) ? voltage : null;
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

  return Object.entries(arduino.behavior?.pinMap ?? {})
    .filter(([, pin]) => {
      return pin.capabilities?.includes('digital')
        && Number.isInteger(pin.number)
        && runtime.getPin(pin.number).mode === 'OUTPUT'
        && runtime.getPin(pin.number).value === 'HIGH';
    })
    .map(([terminalId]) => ({ componentId: arduino.id, terminalId }));
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
      netReadings.set(net.id, { voltageVolts: voltageForDrivenNet({ graph, arduino, net, drivenHighPins }), state: hasPower ? 'power' : 'driven-high' });
    } else if (hasGround) {
      netReadings.set(net.id, { voltageVolts: 0, state: 'ground' });
    } else {
      netReadings.set(net.id, { voltageVolts: null, state: 'floating' });
    }
  }
}

function inferredNetVoltage({ graph, runtime, net, drivenHighPins }) {
  const groundTerminal = net.terminals.find((terminal) => graph.terminalKind(terminal) === 'ground');

  if (groundTerminal) {
    return 0;
  }

  const powerTerminal = net.terminals.find((terminal) => graph.terminalKind(terminal) === 'power');

  if (powerTerminal) {
    return powerTerminalVoltage(graph, powerTerminal);
  }

  const highTerminal = drivenHighPins.find((pinTerminal) => {
    return net.terminals.some((terminal) => terminal.componentId === pinTerminal.componentId && terminal.terminalId === pinTerminal.terminalId);
  });

  if (highTerminal) {
    const board = graph.components.get(highTerminal.componentId);
    const pin = board?.behavior?.pinMap?.[highTerminal.terminalId];
    return Number(pin?.highVoltageVolts ?? board?.electricalModel?.logicVoltage ?? 5);
  }

  const analogSourceTerminal = net.terminals.find((terminal) => {
    const component = graph.components.get(terminal.componentId);
    const model = component?.electricalModel;
    const outputTerminal = component?.behavior?.outputTerminal ?? 'out';
    return model?.type === 'voltage-source' && terminal.terminalId === outputTerminal && component.properties?.[component.behavior?.activeProperty] !== false;
  });

  if (analogSourceTerminal) {
    const component = graph.components.get(analogSourceTerminal.componentId);
    const property = component.electricalModel.outputVoltageProperty ?? component.behavior?.voltageProperty;
    return Number(component.properties[property] ?? 0);
  }

  return null;
}

function inferredNetState({ graph, net, drivenHighPins }) {
  if (net.terminals.some((terminal) => graph.terminalKind(terminal) === 'ground')) {
    return 'ground';
  }

  if (net.terminals.some((terminal) => graph.terminalKind(terminal) === 'power')) {
    return 'power';
  }

  if (drivenHighPins.some((pinTerminal) => net.terminals.some((terminal) => terminal.componentId === pinTerminal.componentId && terminal.terminalId === pinTerminal.terminalId))) {
    return 'driven-high';
  }

  return 'floating';
}

function voltageForDrivenNet({ graph, arduino, net, drivenHighPins }) {
  const powerTerminal = net.terminals.find((terminal) => graph.terminalKind(terminal) === 'power');

  if (powerTerminal) {
    return powerTerminalVoltage(graph, powerTerminal);
  }

  const highTerminal = drivenHighPins.find((pinTerminal) => {
    return net.terminals.some((terminal) => terminal.componentId === pinTerminal.componentId && terminal.terminalId === pinTerminal.terminalId);
  });

  if (highTerminal) {
    const board = graph.components.get(highTerminal.componentId) ?? arduino;
    const pin = board?.behavior?.pinMap?.[highTerminal.terminalId];
    return Number(pin?.highVoltageVolts ?? board?.electricalModel?.logicVoltage ?? 5);
  }

  return Number(arduino?.electricalModel?.logicVoltage ?? 5);
}

function powerTerminalVoltage(graph, terminal) {
  const component = graph.components.get(terminal.componentId);
  const explicit = component?.behavior?.pinMap?.[terminal.terminalId]?.voltageVolts;

  if (Number.isFinite(explicit)) {
    return explicit;
  }

  if (/3v3|3\.3/i.test(terminal.terminalId)) {
    return 3.3;
  }

  if (/5v/i.test(terminal.terminalId)) {
    return 5;
  }

  return Number(component?.electricalModel?.logicVoltage ?? 5);
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

function createElectricalNetlist({ graph, runtime, drivenHighPins }) {
  const nodes = new Map();
  const primitives = [];

  for (const net of graph.nets) {
    nodes.set(net.id, {
      id: net.id,
      terminals: net.terminals,
      voltageVolts: inferredNetVoltage({ graph, runtime, net, drivenHighPins }),
      state: inferredNetState({ graph, net, drivenHighPins })
    });
  }

  for (const component of graph.components.values()) {
    const model = component.electricalModel ?? null;

    if (!model) {
      continue;
    }

    primitives.push({
      component,
      model,
      kind: model.primitive ?? model.type,
      terminals: terminalsForComponent(graph, component)
    });
  }

  return { nodes, primitives };
}

function applyGenericVoltageSources({ graph, netlist, diagnostics, netReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.model.type === 'voltage-source')) {
    const component = primitive.component;
    const outputTerminal = component.behavior?.outputTerminal
      ?? primitive.terminals.find((terminal) => terminal.kind !== 'ground')?.terminalId
      ?? 'out';
    const outputNet = graph.findTerminalNet(component.id, outputTerminal);

    if (!outputNet) {
      diagnostics.push(`${component.id}.${outputTerminal}: fonte de tensão sem net de saída.`);
      continue;
    }

    const enabledProperty = component.behavior?.activeProperty;
    const enabled = enabledProperty ? component.properties[enabledProperty] !== false : true;

    if (!enabled) {
      netReadings.set(outputNet.id, { voltageVolts: null, state: 'disabled-source' });
      continue;
    }

    const voltageProperty = primitive.model.outputVoltageProperty ?? component.behavior?.voltageProperty;
    const voltageVolts = clamp(Number(component.properties[voltageProperty] ?? 0), 0, Number.POSITIVE_INFINITY);
    const node = netlist.nodes.get(outputNet.id);

    if (node) {
      node.voltageVolts = voltageVolts;
      node.state = 'voltage-source';
    }

    const current = netReadings.get(outputNet.id);

    if (current?.state !== 'short') {
      netReadings.set(outputNet.id, { voltageVolts, state: 'voltage-source', componentId: component.id, terminalId: outputTerminal });
    }
  }
}

function applyGenericResistors({ graph, netlist, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.kind === 'resistor')) {
    const component = primitive.component;
    const left = graph.findTerminalNet(component.id, 'a');
    const right = graph.findTerminalNet(component.id, 'b');
    const resistanceOhms = Math.max(0, Number(component.properties[primitive.model.resistanceProperty ?? 'resistanceOhms'] ?? 0));
    const maximumPowerWatts = Number(component.properties.maximumPowerWatts ?? 0.25);
    const leftVoltage = voltageForNet(netlist, left?.id);
    const rightVoltage = voltageForNet(netlist, right?.id);

    if (!left || !right) {
      componentReadings.set(component.id, {
        componentId: component.id,
        type: 'resistor',
        voltageVolts: 0,
        currentAmps: 0,
        powerWatts: 0,
        resistanceOhms,
        state: 'open'
      });
      continue;
    }

    if (leftVoltage === null || rightVoltage === null || resistanceOhms <= 0) {
      continue;
    }

    const voltageDrop = Math.abs(leftVoltage - rightVoltage);
    const currentAmps = resistanceOhms > 0 ? voltageDrop / resistanceOhms : Number.POSITIVE_INFINITY;
    const powerWatts = currentAmps * currentAmps * resistanceOhms;
    const state = powerWatts > maximumPowerWatts ? 'overpower' : 'ok';

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'resistor',
      voltageVolts: voltageDrop,
      currentAmps,
      powerWatts,
      resistanceOhms,
      state
    });

    if (powerWatts > maximumPowerWatts) {
      diagnostics.push(`${component.id}: potência ${powerWatts.toFixed(3)} W excede limite ${maximumPowerWatts.toFixed(3)} W.`);
    }
  }
}

function applyGenericCapacitors({ graph, netlist, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.kind === 'capacitor')) {
    const component = primitive.component;
    const left = graph.findTerminalNet(component.id, 'a');
    const right = graph.findTerminalNet(component.id, 'b');
    const leftVoltage = voltageForNet(netlist, left?.id);
    const rightVoltage = voltageForNet(netlist, right?.id);
    const maximumVoltageVolts = Number(component.properties.maximumVoltageVolts ?? 16);
    const voltageVolts = leftVoltage === null || rightVoltage === null ? null : Math.abs(leftVoltage - rightVoltage);
    const state = voltageVolts === null ? 'floating' : voltageVolts > maximumVoltageVolts ? 'overvoltage' : 'ok';

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'capacitor',
      voltageVolts,
      currentAmps: 0,
      powerWatts: 0,
      capacitanceMicrofarads: Number(component.properties[primitive.model.capacitanceProperty ?? 'capacitanceMicrofarads'] ?? 0),
      state
    });

    if (voltageVolts === null) {
      diagnostics.push(`${component.id}: capacitor com terminal em tensão flutuante; validação transiente ainda não implementada.`);
    } else if (voltageVolts > maximumVoltageVolts) {
      diagnostics.push(`${component.id}: tensão ${voltageVolts.toFixed(2)} V excede limite do capacitor ${maximumVoltageVolts.toFixed(2)} V.`);
    }
  }
}

function applySensorModuleLimits({ graph, netlist, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.model.type === 'sensor-module' || item.model.type === 'adc')) {
    const component = primitive.component;
    const model = primitive.model;
    const powerTerminal = primitive.terminals.find((terminal) => terminal.type.includes('power-input'))?.terminalId ?? 'vcc';
    const groundTerminal = primitive.terminals.find((terminal) => terminal.kind === 'ground')?.terminalId ?? 'gnd';
    const powerNet = graph.findTerminalNet(component.id, powerTerminal);
    const groundNet = graph.findTerminalNet(component.id, groundTerminal);
    const powerVoltage = voltageForNet(netlist, powerNet?.id);
    const groundVoltage = voltageForNet(netlist, groundNet?.id) ?? 0;
    const voltageVolts = powerVoltage === null ? null : Math.max(0, powerVoltage - groundVoltage);
    const currentAmps = Number(model.inputCurrentAmps ?? 0);
    const maximumCurrentAmps = Number(model.maximumCurrentAmps ?? component.properties.maximumCurrentAmps ?? 0);
    const state = voltageVolts === null
      ? 'unpowered'
      : maximumCurrentAmps > 0 && currentAmps > maximumCurrentAmps ? 'overcurrent' : 'powered';

    componentReadings.set(component.id, {
      componentId: component.id,
      type: model.type,
      voltageVolts,
      currentAmps,
      powerWatts: voltageVolts === null ? 0 : voltageVolts * currentAmps,
      state
    });

    if (voltageVolts === null) {
      diagnostics.push(`${component.id}.${powerTerminal}: módulo sem alimentação detectável.`);
      continue;
    }

    const logicVoltage = Number(model.logicVoltage ?? model.maximumVoltageVolts ?? 0);

    if (logicVoltage > 0 && voltageVolts > logicVoltage + 0.25 && model.toleratesFiveVoltPower === false) {
      diagnostics.push(`${component.id}.${powerTerminal} (${powerNet?.id ?? 'sem-net'}): tensão ${voltageVolts.toFixed(2)} V incompatível com limite lógico ${logicVoltage.toFixed(2)} V.`);
    }

    if (maximumCurrentAmps > 0 && currentAmps > maximumCurrentAmps) {
      diagnostics.push(`${component.id}.${powerTerminal} (${powerNet?.id ?? 'sem-net'}): corrente ${formatAmps(currentAmps)} excede limite do módulo ${formatAmps(maximumCurrentAmps)}.`);
    }

    diagnoseTerminalLogicVoltage({ graph, netlist, component, model, diagnostics });
  }
}

function diagnoseTerminalLogicVoltage({ graph, netlist, component, model, diagnostics }) {
  const logicVoltage = Number(model.logicVoltage ?? model.maximumSignalVoltageVolts ?? 0);

  if (logicVoltage <= 0) {
    return;
  }

  for (const terminal of terminalsForComponent(graph, component)) {
    if (terminal.kind === 'ground' || terminal.type.includes('power')) {
      continue;
    }

    const net = graph.findTerminalNet(component.id, terminal.terminalId);
    const voltage = voltageForNet(netlist, net?.id);

    if (voltage !== null && voltage > logicVoltage + 0.25) {
      diagnostics.push(`${component.id}.${terminal.terminalId} (${net.id}): sinal ${voltage.toFixed(2)} V excede lógica ${logicVoltage.toFixed(2)} V.`);
    }
  }
}

function diagnoseFloatingInputs({ graph, netlist, runtime, diagnostics }) {
  for (const component of graph.components.values()) {
    const pinMap = component.behavior?.pinMap ?? {};

    for (const [terminalId, pin] of Object.entries(pinMap)) {
      if (!pin.capabilities?.some((capability) => ['digital', 'analog', 'i2c-sda', 'i2c-scl'].includes(capability))) {
        continue;
      }

      if (Number.isInteger(pin.number) && runtime.getPin(pin.number).mode === 'OUTPUT') {
        continue;
      }

      const net = graph.findTerminalNet(component.id, terminalId);

      if (!net) {
        continue;
      }

      if (netHasRuntimeDriverOrPassivePath({ graph, net, ownerComponentId: component.id })) {
        continue;
      }

      const node = netlist.nodes.get(net.id);

      if (node?.state === 'floating') {
        diagnostics.push(`${component.id}.${terminalId} (${net.id}): entrada conectada a net flutuante.`);
      }
    }
  }
}

function netHasRuntimeDriverOrPassivePath({ graph, net, ownerComponentId }) {
  return net.terminals.some((terminal) => {
    if (terminal.componentId === ownerComponentId) {
      return false;
    }

    const component = graph.components.get(terminal.componentId);

    if (!component) {
      return false;
    }

    return isRuntimeDrivenTerminal(component, terminal.terminalId)
      || isBusTerminal(component, terminal.terminalId)
      || isPassiveElectricalTerminal(component);
  });
}

function isRuntimeDrivenTerminal(component, terminalId) {
  const behavior = component.behavior ?? {};

  return [
    behavior.outputTerminal,
    behavior.echoTerminal,
    behavior.digitalOutputTerminal,
    behavior.analogOutputTerminal
  ].includes(terminalId);
}

function isBusTerminal(component, terminalId) {
  const busTerminals = [
    component.behavior?.sdaTerminal ?? 'sda',
    component.behavior?.sclTerminal ?? 'scl',
    ...(component.behavior?.inputTerminals ?? [])
  ];

  return ['i2c', 'spi'].includes(component.behavior?.bus) && busTerminals.includes(terminalId);
}

function isPassiveElectricalTerminal(component) {
  return ['resistor', 'capacitor', 'ldr'].includes(component.electricalModel?.primitive);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatAmps(value) {
  return `${(value * 1000).toFixed(1)} mA`;
}
