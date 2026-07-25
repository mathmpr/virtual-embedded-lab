export function solveElectricalState({ graph, runtime, runtimesByComponent = null }) {
  const diagnostics = [];
  const ledStates = new Map();
  const componentReadings = new Map();
  const netReadings = new Map();
  const arduino = graph.findComponentsByBehaviorType('microcontroller')[0] ?? null;
  const drivenHighPins = findDrivenHighPins({ graph, runtime, arduino, runtimesByComponent });
  const netlist = createElectricalNetlist({ graph, runtime, drivenHighPins });

  detectShorts({ graph, arduino, drivenHighPins, diagnostics, netReadings });
  applyGenericVoltageSources({ graph, netlist, diagnostics, netReadings });
  applyGenericResistors({ graph, netlist, diagnostics, componentReadings });
  applyGenericCapacitors({ graph, netlist, diagnostics, componentReadings });
  applySensorModuleLimits({ graph, netlist, diagnostics, componentReadings });
  applyBjtTransistorRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings });
  applyMosfetRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings });
  applySwitchModuleRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings });
  applyOptoisolatorRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings });
  applyDarlingtonArrayRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings });
  diagnoseFloatingInputs({ graph, netlist, runtime, diagnostics });

  for (const led of findElectricalComponents(graph, 'led', 'diode-led')) {
    const solved = solveLedPath({ graph, netlist, componentReadings, arduino, led, drivenHighPins });

    ledStates.set(led.id, solved.isLit);
    componentReadings.set(led.id, solved.ledReading);

    if (solved.resistorReading) {
      componentReadings.set(solved.resistorReading.componentId, solved.resistorReading);
    }

    diagnostics.push(...solved.diagnostics);
  }

  for (const led of findElectricalComponents(graph, 'rgb-led')) {
    const solved = solveRgbLed({ graph, led, runtime, runtimesByComponent });

    ledStates.set(led.id, solved.isLit);
    componentReadings.set(led.id, solved.reading);
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

function solveRgbLed({ graph, led, runtime, runtimesByComponent }) {
  const model = led.electricalModel ?? {};
  const commonTerminal = model.commonTerminal ?? 'cathode';
  const activeMode = model.commonMode ?? 'cathode';
  const channels = model.channels ?? {
    red: { terminal: 'red' },
    green: { terminal: 'green' },
    blue: { terminal: 'blue' }
  };
  const diagnostics = [];
  const grounded = activeMode === 'cathode'
    ? isTerminalConnectedToGround(graph, { componentId: led.id, terminalId: commonTerminal })
    : false;

  if (!grounded) {
    diagnostics.push(`${led.id}: terminal comum do LED RGB não está conectado ao GND.`);
  }

  const values = Object.fromEntries(Object.entries(channels).map(([color, channel]) => {
    return [color, grounded ? rgbChannelDuty({ graph, led, channel, runtime, runtimesByComponent }) : 0];
  }));
  const red = clamp(Math.round((values.red ?? 0) * 255), 0, 255);
  const green = clamp(Math.round((values.green ?? 0) * 255), 0, 255);
  const blue = clamp(Math.round((values.blue ?? 0) * 255), 0, 255);
  const brightness = Math.max(red, green, blue) / 255;
  const color = rgbHex(red, green, blue);

  return {
    isLit: brightness > 0,
    reading: {
      componentId: led.id,
      type: 'rgb-led',
      red,
      green,
      blue,
      color,
      brightness,
      state: brightness > 0 ? 'on' : 'off'
    },
    diagnostics
  };
}

function rgbChannelDuty({ graph, led, channel, runtime, runtimesByComponent }) {
  const terminalId = channel.terminal;
  const terminalNet = graph.findTerminalNet(led.id, terminalId);

  if (!terminalNet) {
    return 0;
  }

  const directDuty = drivenDutyOnNet({ graph, net: terminalNet, runtime, runtimesByComponent });

  if (directDuty > 0) {
    return directDuty;
  }

  for (const resistor of findElectricalComponents(graph, 'resistor', 'resistor')) {
    const resistorAConnected = graph.areConnected(
      { componentId: resistor.id, terminalId: 'a' },
      { componentId: led.id, terminalId }
    );
    const resistorBConnected = graph.areConnected(
      { componentId: resistor.id, terminalId: 'b' },
      { componentId: led.id, terminalId }
    );

    if (!resistorAConnected && !resistorBConnected) {
      continue;
    }

    const otherTerminalId = resistorAConnected ? 'b' : 'a';
    const otherNet = graph.findTerminalNet(resistor.id, otherTerminalId);
    const resistorDuty = otherNet ? drivenDutyOnNet({ graph, net: otherNet, runtime, runtimesByComponent }) : 0;

    if (resistorDuty > 0) {
      return resistorDuty;
    }
  }

  return 0;
}

function drivenDutyOnNet({ graph, net, runtime, runtimesByComponent }) {
  let maxDuty = 0;

  for (const terminal of net.terminals) {
    const component = graph.components.get(terminal.componentId);
    const pin = component?.behavior?.pinMap?.[terminal.terminalId];

    if (!pin || !Number.isInteger(pin.number)) {
      continue;
    }

    const boardRuntime = runtimesByComponent?.get(component.id) ?? runtime;
    const state = boardRuntime?.getPin(pin.number);

    if (state?.mode !== 'OUTPUT') {
      continue;
    }

    const duty = Number.isFinite(Number(state.pwmValue))
      ? Number(state.pwmValue) / 255
      : state.value === 'HIGH' ? 1 : 0;
    maxDuty = Math.max(maxDuty, clamp(duty, 0, 1));
  }

  return maxDuty;
}

function rgbHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function solveLedPath({ graph, netlist, componentReadings, arduino, led, drivenHighPins }) {
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

  const grounded = isTerminalConnectedToGround(graph, { componentId: led.id, terminalId: cathodeTerminal });
  const switchedGround = !grounded
    ? lowSideSwitchedGroundForTerminal({ graph, componentReadings, componentId: led.id, terminalId: cathodeTerminal })
    : null;

  if (!grounded && switchedGround?.known && !switchedGround.active) {
    return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
  }

  if (!grounded && !switchedGround?.active) {
    diagnostics.push(`${led.id}: catodo não está conectado ao GND.`);
    return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
  }

  if (drivenHighPins.length === 0 && !switchedGround?.active) {
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
    const poweredPath = switchedGround?.active
      ? findPoweredSeriesPath({ graph, resistor, led, anodeTerminal })
      : null;

    if (!path && !poweredPath) {
      continue;
    }

    const electrical = solveLedSeriesCircuit({
      supplyVoltage: poweredPath?.supplyVoltage ?? supplyVoltageForDrivenTerminal({ graph, arduino, terminal: path }),
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

  return { isLit: false, ledReading: defaultReading, resistorReading: null, diagnostics };
}

function findPoweredSeriesPath({ graph, resistor, led, anodeTerminal }) {
  const anodeFromA = graph.areConnected({ componentId: resistor.id, terminalId: 'a' }, { componentId: led.id, terminalId: anodeTerminal });
  const anodeFromB = graph.areConnected({ componentId: resistor.id, terminalId: 'b' }, { componentId: led.id, terminalId: anodeTerminal });

  if (!anodeFromA && !anodeFromB) {
    return null;
  }

  const supplyTerminalId = anodeFromA ? 'b' : 'a';
  const supplyNet = graph.findTerminalNet(resistor.id, supplyTerminalId);
  const supplyTerminal = supplyNet?.terminals.find((terminal) => graph.terminalKind(terminal) === 'power');

  if (!supplyTerminal) {
    return null;
  }

  return {
    componentId: supplyTerminal.componentId,
    terminalId: supplyTerminal.terminalId,
    supplyVoltage: powerTerminalVoltage(graph, supplyTerminal)
  };
}

function lowSideSwitchedGroundForTerminal({ graph, componentReadings, componentId, terminalId }) {
  const net = graph.findTerminalNet(componentId, terminalId);
  let known = false;

  if (!net) {
    return { known: false, active: false };
  }

  for (const terminal of net.terminals) {
    if (terminal.componentId === componentId && terminal.terminalId === terminalId) {
      continue;
    }

    const component = graph.components.get(terminal.componentId);
    const reading = componentReadings.get(terminal.componentId);

    if (!component || !reading) {
      continue;
    }

    if (component.electricalModel?.type === 'bjt-transistor' && terminal.terminalId === 'collector') {
      known = true;
      if (reading.state === 'saturated' && isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'emitter' })) {
        return { known: true, active: true, componentId: component.id };
      }
    }

    if (component.electricalModel?.type === 'mosfet' && terminal.terminalId === 'drain') {
      known = true;
      if (reading.state === 'on' && isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'source' })) {
        return { known: true, active: true, componentId: component.id };
      }
    }

    if (component.electricalModel?.primitive === 'mosfet-module' && terminal.terminalId === 'loadOut') {
      known = true;
      if (reading.state === 'active') {
        return { known: true, active: true, componentId: component.id };
      }
    }

    if ((component.electricalModel?.primitive === 'pc817' || component.electricalModel?.type === 'optoisolator') && terminal.terminalId === 'collector') {
      known = true;
      if (reading.state === 'conducting' && isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'emitter' })) {
        return { known: true, active: true, componentId: component.id };
      }
    }

    if (component.electricalModel?.type === 'darlington-array') {
      const match = terminal.terminalId.match(/^out(\d+)$/);

      if (match) {
        known = true;
        const channel = reading.channels?.find((item) => Number(item.channel) === Number(match[1]));

        if (channel?.active) {
          return { known: true, active: true, componentId: component.id };
        }
      }
    }

    if (['relay', 'ssr'].includes(component.electricalModel?.primitive)) {
      const match = terminal.terminalId.match(/^(no|nc)(\d+)$/);

      if (match) {
        known = true;
        const contact = match[1].toUpperCase();
        const channelNumber = Number(match[2]);
        const channel = reading.channels?.find((item) => Number(item.channel) === channelNumber);
        const closed = channel && (channel.active && contact === 'NO' || !channel.active && contact === 'NC');

        if (closed && isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: `com${channelNumber}` })) {
          return { known: true, active: true, componentId: component.id };
        }
      }
    }
  }

  return { known, active: false };
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

function terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId, terminalId }) {
  const terminalNet = graph.findTerminalNet(componentId, terminalId);
  const result = {
    connected: Boolean(terminalNet),
    active: false,
    voltageVolts: 0,
    hasSeriesResistor: false,
    resistorOhms: null,
    hasPullDown: false,
    source: null
  };

  if (!terminalNet) {
    return result;
  }

  result.hasPullDown = terminalNet.terminals.some((terminal) => {
    if (terminal.componentId === componentId && terminal.terminalId === terminalId) {
      return false;
    }

    const component = graph.components.get(terminal.componentId);
    return component?.electricalModel?.primitive === 'resistor'
      && resistorOtherTerminalHasKind(graph, component.id, terminal.terminalId, 'ground');
  });

  const directDrive = runtimeDriveOnNet({ graph, runtime, runtimesByComponent, net: terminalNet });

  if (directDrive) {
    return {
      ...result,
      active: directDrive.value === 'HIGH',
      voltageVolts: directDrive.value === 'HIGH' ? directDrive.voltageVolts : 0,
      source: directDrive
    };
  }

  for (const terminal of terminalNet.terminals) {
    if (terminal.componentId === componentId && terminal.terminalId === terminalId) {
      continue;
    }

    const resistor = graph.components.get(terminal.componentId);

    if (resistor?.electricalModel?.primitive !== 'resistor') {
      continue;
    }

    const otherTerminalId = terminal.terminalId === 'a' ? 'b' : terminal.terminalId === 'b' ? 'a' : null;
    const otherNet = otherTerminalId ? graph.findTerminalNet(resistor.id, otherTerminalId) : null;
    const drive = otherNet ? runtimeDriveOnNet({ graph, runtime, runtimesByComponent, net: otherNet }) : null;

    if (!drive) {
      continue;
    }

    return {
      ...result,
      active: drive.value === 'HIGH',
      voltageVolts: drive.value === 'HIGH' ? drive.voltageVolts : 0,
      hasSeriesResistor: true,
      resistorOhms: Math.max(1, Number(resistor.properties.resistanceOhms ?? 220)),
      source: drive
    };
  }

  return result;
}

function runtimeDriveOnNet({ graph, runtime, runtimesByComponent, net }) {
  for (const terminal of net.terminals) {
    const component = graph.components.get(terminal.componentId);
    const pin = component?.behavior?.pinMap?.[terminal.terminalId];

    if (!pin || !Number.isInteger(pin.number)) {
      continue;
    }

    const boardRuntime = runtimesByComponent?.get(component.id) ?? runtime;
    const state = boardRuntime?.getPin(pin.number);

    if (state?.mode !== 'OUTPUT') {
      continue;
    }

    return {
      componentId: component.id,
      terminalId: terminal.terminalId,
      pin: pin.number,
      value: state.value,
      pwmValue: state.pwmValue,
      voltageVolts: Number(pin.highVoltageVolts ?? component.electricalModel?.logicVoltage ?? 5)
    };
  }

  return null;
}

function loadPathAnalysis({ graph, netlist, componentId, terminalId, oppositeRailKind }) {
  const terminalNet = graph.findTerminalNet(componentId, terminalId);

  if (!terminalNet) {
    return {
      hasPath: false,
      voltageVolts: 0,
      resistanceOhms: null,
      currentAmps: 0,
      loadComponentId: null
    };
  }

  const directRail = terminalNet.terminals.some((terminal) => {
    return !(terminal.componentId === componentId && terminal.terminalId === terminalId)
      && graph.terminalKind(terminal) === oppositeRailKind;
  });

  if (directRail) {
    const voltageVolts = Math.abs((voltageForNet(netlist, terminalNet.id) ?? 0) - railVoltageForKind(oppositeRailKind));
    return {
      hasPath: true,
      voltageVolts,
      resistanceOhms: 0,
      currentAmps: Number.POSITIVE_INFINITY,
      loadComponentId: null
    };
  }

  for (const terminal of terminalNet.terminals) {
    const resistor = graph.components.get(terminal.componentId);

    if (resistor?.electricalModel?.primitive !== 'resistor') {
      continue;
    }

    const otherTerminalId = terminal.terminalId === 'a' ? 'b' : terminal.terminalId === 'b' ? 'a' : null;
    const otherNet = otherTerminalId ? graph.findTerminalNet(resistor.id, otherTerminalId) : null;

    if (!otherNet || !otherNet.terminals.some((candidate) => graph.terminalKind(candidate) === oppositeRailKind)) {
      continue;
    }

    const terminalVoltageVolts = voltageForNet(netlist, terminalNet.id) ?? 0;
    const railVoltageVolts = voltageForNet(netlist, otherNet.id) ?? railVoltageForKind(oppositeRailKind);
    const voltageVolts = Math.abs(railVoltageVolts - terminalVoltageVolts);
    const resistanceOhms = Math.max(0, Number(resistor.properties.resistanceOhms ?? 220));

    return {
      hasPath: true,
      voltageVolts,
      resistanceOhms,
      currentAmps: resistanceOhms > 0 ? voltageVolts / resistanceOhms : Number.POSITIVE_INFINITY,
      loadComponentId: resistor.id
    };
  }

  const ledLoad = ledLoadPathFromSinkNet({ graph, netlist, sinkNet: terminalNet, sinkComponentId: componentId });

  if (ledLoad) {
    return ledLoad;
  }

  return {
    hasPath: false,
    voltageVolts: 0,
    resistanceOhms: null,
    currentAmps: 0,
    loadComponentId: null
  };
}

function switchLoadAnalysis({ graph, netlist, componentId, inputTerminal, outputTerminal }) {
  const inputNet = graph.findTerminalNet(componentId, inputTerminal);
  const outputNet = graph.findTerminalNet(componentId, outputTerminal);
  const inputVoltage = voltageForNet(netlist, inputNet?.id);
  const outputVoltage = voltageForNet(netlist, outputNet?.id);
  const load = outputNet ? loadConnectedToSwitchTerminal({ graph, netlist, componentId, terminalId: outputTerminal }) : null;
  const voltageVolts = inputVoltage !== null && outputVoltage !== null
    ? Math.abs(inputVoltage - outputVoltage)
    : load?.voltageVolts ?? 0;
  const currentAmps = load?.resistanceOhms
    ? voltageVolts / load.resistanceOhms
    : load?.hasPath ? Number.POSITIVE_INFINITY : 0;

  return {
    hasLoad: Boolean(load?.hasPath),
    voltageVolts,
    currentAmps,
    loadComponentId: load?.loadComponentId ?? null
  };
}

function loadConnectedToSwitchTerminal({ graph, netlist, componentId, terminalId }) {
  const net = graph.findTerminalNet(componentId, terminalId);

  if (!net) {
    return null;
  }

  for (const terminal of net.terminals) {
    if (terminal.componentId === componentId && terminal.terminalId === terminalId) {
      continue;
    }

    const resistor = graph.components.get(terminal.componentId);

    if (resistor?.electricalModel?.primitive !== 'resistor') {
      continue;
    }

    const otherTerminalId = terminal.terminalId === 'a' ? 'b' : terminal.terminalId === 'b' ? 'a' : null;
    const otherNet = otherTerminalId ? graph.findTerminalNet(resistor.id, otherTerminalId) : null;

    if (!otherNet) {
      continue;
    }

    const otherVoltage = voltageForNet(netlist, otherNet.id);

    if (otherVoltage === null) {
      continue;
    }

    return {
      hasPath: true,
      voltageVolts: Math.abs(otherVoltage - (voltageForNet(netlist, net.id) ?? 0)),
      resistanceOhms: Math.max(0, Number(resistor.properties.resistanceOhms ?? 220)),
      loadComponentId: resistor.id
    };
  }

  const ledLoad = ledLoadPathFromSinkNet({ graph, netlist, sinkNet: net, sinkComponentId: componentId });

  if (ledLoad) {
    return ledLoad;
  }

  return null;
}

function ledLoadPathFromSinkNet({ graph, netlist, sinkNet, sinkComponentId }) {
  for (const terminal of sinkNet.terminals) {
    if (terminal.componentId === sinkComponentId) {
      continue;
    }

    const led = graph.components.get(terminal.componentId);

    if (!['led', 'diode-led'].includes(led?.electricalModel?.primitive)) {
      continue;
    }

    const cathodeTerminal = led.electricalModel?.cathodeTerminal ?? 'cathode';
    const anodeTerminal = led.electricalModel?.anodeTerminal ?? 'anode';

    if (terminal.terminalId !== cathodeTerminal) {
      continue;
    }

    for (const resistor of findElectricalComponents(graph, 'resistor', 'resistor')) {
      const anodeFromA = graph.areConnected({ componentId: resistor.id, terminalId: 'a' }, { componentId: led.id, terminalId: anodeTerminal });
      const anodeFromB = graph.areConnected({ componentId: resistor.id, terminalId: 'b' }, { componentId: led.id, terminalId: anodeTerminal });

      if (!anodeFromA && !anodeFromB) {
        continue;
      }

      const supplyTerminalId = anodeFromA ? 'b' : 'a';
      const supplyNet = graph.findTerminalNet(resistor.id, supplyTerminalId);
      const supplyTerminal = supplyNet?.terminals.find((candidate) => graph.terminalKind(candidate) === 'power');

      if (!supplyTerminal) {
        continue;
      }

      const supplyVoltage = powerTerminalVoltage(graph, supplyTerminal);
      const forwardVoltage = Number(led.properties.forwardVoltage ?? 2);
      const resistanceOhms = Math.max(0, Number(resistor.properties.resistanceOhms ?? 220));

      return {
        hasPath: true,
        voltageVolts: Math.max(0, supplyVoltage - forwardVoltage),
        resistanceOhms,
        currentAmps: resistanceOhms > 0 ? Math.max(0, supplyVoltage - forwardVoltage) / resistanceOhms : Number.POSITIVE_INFINITY,
        loadComponentId: led.id
      };
    }
  }

  return null;
}

function ledInputAnalysis({ graph, netlist, runtime, runtimesByComponent, componentId, anodeTerminal, cathodeTerminal }) {
  const grounded = isTerminalConnectedToGround(graph, { componentId, terminalId: cathodeTerminal });
  const drive = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId, terminalId: anodeTerminal });
  const forwardVoltage = 1.2;
  const currentAmps = grounded && drive.active
    ? drive.resistorOhms ? Math.max(0, (drive.voltageVolts - forwardVoltage) / drive.resistorOhms) : Number.POSITIVE_INFINITY
    : 0;

  return {
    active: currentAmps > 0,
    currentAmps,
    hasSeriesResistor: drive.hasSeriesResistor,
    voltageVolts: drive.voltageVolts
  };
}

function bjtBaseCurrent({ isPnp, baseDrive, emitterVoltage, baseEmitterVoltage }) {
  if (!baseDrive.connected) {
    return 0;
  }

  if (baseDrive.resistorOhms) {
    const voltageDrop = isPnp
      ? emitterVoltage - baseDrive.voltageVolts - baseEmitterVoltage
      : baseDrive.voltageVolts - emitterVoltage - baseEmitterVoltage;

    return Math.max(0, voltageDrop / baseDrive.resistorOhms);
  }

  if (isPnp) {
    return baseDrive.source?.value === 'LOW' ? Number.POSITIVE_INFINITY : 0;
  }

  return baseDrive.active ? Number.POSITIVE_INFINITY : 0;
}

function isPoweredModule({ graph, netlist, component }) {
  const vcc = graph.findTerminalNet(component.id, 'vcc');
  const gnd = graph.findTerminalNet(component.id, 'gnd');
  const vccVoltage = voltageForNet(netlist, vcc?.id);
  const gndVoltage = voltageForNet(netlist, gnd?.id);

  return vccVoltage !== null && (gndVoltage === 0 || isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'gnd' }));
}

function validateSwitchLoad({ component, terminalLabel, load, active, ratedCurrentAmps, ratedVoltageVolts, diagnostics }) {
  if (!active) {
    return;
  }

  if (!load.hasLoad) {
    diagnostics.push(`${component.id}.${terminalLabel}: chave ativa sem carga detectável no contato/saída.`);
  }

  if (ratedVoltageVolts > 0 && load.voltageVolts > ratedVoltageVolts) {
    diagnostics.push(`${component.id}.${terminalLabel}: tensão ${load.voltageVolts.toFixed(2)} V excede tensão nominal ${ratedVoltageVolts.toFixed(2)} V.`);
  }

  if (ratedCurrentAmps > 0 && load.currentAmps > ratedCurrentAmps) {
    diagnostics.push(`${component.id}.${terminalLabel}: corrente estimada ${formatAmps(load.currentAmps)} excede corrente nominal ${formatAmps(ratedCurrentAmps)}.`);
  }
}

function terminalVoltage({ graph, netlist, componentId, terminalId }) {
  const net = graph.findTerminalNet(componentId, terminalId);
  return voltageForNet(netlist, net?.id);
}

function terminalHasKind(graph, terminal, kind) {
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  return Boolean(net?.terminals.some((candidate) => graph.terminalKind(candidate) === kind));
}

function resistorOtherTerminalHasKind(graph, resistorId, terminalId, kind) {
  const otherTerminalId = terminalId === 'a' ? 'b' : terminalId === 'b' ? 'a' : null;
  const otherNet = otherTerminalId ? graph.findTerminalNet(resistorId, otherTerminalId) : null;

  return Boolean(otherNet?.terminals.some((terminal) => graph.terminalKind(terminal) === kind));
}

function railVoltageForKind(kind) {
  return kind === 'ground' ? 0 : 5;
}

function findElectricalComponents(graph, ...primitives) {
  return [...graph.components.values()].filter((component) => {
    return primitives.includes(component.electricalPrimitive) || primitives.includes(component.electricalModel?.primitive);
  });
}

function applyBjtTransistorRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.model.type === 'bjt-transistor')) {
    const component = primitive.component;
    const polarity = String(primitive.model.polarity ?? component.properties.polarity ?? 'NPN').toUpperCase();
    const isPnp = polarity.includes('PNP');
    const emitterGrounded = isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'emitter' });
    const emitterPowered = terminalHasKind(graph, { componentId: component.id, terminalId: 'emitter' }, 'power');
    const collectorGrounded = isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'collector' });
    const baseDrive = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId: component.id, terminalId: 'base' });
    const collectorLoad = loadPathAnalysis({ graph, netlist, componentId: component.id, terminalId: 'collector', oppositeRailKind: isPnp ? 'ground' : 'power' });
    const maxCollectorCurrentAmps = Number(component.properties[primitive.model.maxCollectorCurrentProperty ?? 'maxCollectorCurrentAmps'] ?? 0);
    const gainHfe = Math.max(1, Number(component.properties[primitive.model.gainProperty ?? 'gainHfe'] ?? 100));
    const baseEmitterVoltage = polarity.includes('DARLINGTON') ? 1.2 : 0.7;
    const emitterVoltage = terminalVoltage({ graph, netlist, componentId: component.id, terminalId: 'emitter' }) ?? (isPnp ? 5 : 0);
    const baseCurrentAmps = bjtBaseCurrent({
      isPnp,
      baseDrive,
      emitterVoltage,
      baseEmitterVoltage
    });
    const estimatedCollectorCurrentAmps = collectorLoad.resistanceOhms
      ? Math.max(0, (collectorLoad.voltageVolts - 0.2) / collectorLoad.resistanceOhms)
      : collectorLoad.hasPath ? Number.POSITIVE_INFINITY : 0;
    const requiredBaseCurrentAmps = estimatedCollectorCurrentAmps > 0 && Number.isFinite(estimatedCollectorCurrentAmps)
      ? estimatedCollectorCurrentAmps / Math.min(gainHfe, 100)
      : 0;
    const driven = isPnp ? baseDrive.connected && baseDrive.source?.value === 'LOW' : baseDrive.active;
    const emitterOk = isPnp ? emitterPowered : emitterGrounded;
    const saturated = emitterOk
      && driven
      && baseCurrentAmps >= requiredBaseCurrentAmps
      && collectorLoad.hasPath;
    const state = !driven ? 'off' : saturated ? 'saturated' : 'under-driven';

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'bjt-transistor',
      state,
      polarity,
      baseCurrentAmps,
      collectorCurrentAmps: saturated ? estimatedCollectorCurrentAmps : 0,
      requiredBaseCurrentAmps,
      maxCollectorCurrentAmps
    });

    if (!isPnp && collectorGrounded && !emitterGrounded) {
      diagnostics.push(`${component.id}: coletor ligado ao GND e emissor não aterrado; provável inversão C/E para chaveamento NPN.`);
    }

    if (driven && !baseDrive.hasSeriesResistor) {
      diagnostics.push(`${component.id}.base: base acionada sem resistor em série; corrente de base pode exceder o pino do microcontrolador.`);
    }

    if (driven && !isPnp && !emitterGrounded) {
      diagnostics.push(`${component.id}.emitter: emissor NPN deve estar no GND para chaveamento low-side.`);
    }

    if (driven && isPnp && !emitterPowered) {
      diagnostics.push(`${component.id}.emitter: emissor PNP deve estar em VCC para chaveamento high-side.`);
    }

    if (driven && !collectorLoad.hasPath) {
      diagnostics.push(`${component.id}.collector: coletor sem carga detectável até uma alimentação.`);
    }

    if (driven && collectorLoad.hasPath && baseCurrentAmps < requiredBaseCurrentAmps) {
      diagnostics.push(`${component.id}.base: corrente de base ${formatAmps(baseCurrentAmps)} insuficiente para saturar carga estimada de ${formatAmps(estimatedCollectorCurrentAmps)}.`);
    }

    if (maxCollectorCurrentAmps > 0 && estimatedCollectorCurrentAmps > maxCollectorCurrentAmps) {
      diagnostics.push(`${component.id}.collector: corrente estimada ${formatAmps(estimatedCollectorCurrentAmps)} excede limite ${formatAmps(maxCollectorCurrentAmps)}.`);
    }
  }
}

function applyMosfetRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.model.type === 'mosfet')) {
    const component = primitive.component;
    const gateDrive = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId: component.id, terminalId: 'gate' });
    const sourceVoltage = terminalVoltage({ graph, netlist, componentId: component.id, terminalId: 'source' }) ?? 0;
    const drainLoad = loadPathAnalysis({ graph, netlist, componentId: component.id, terminalId: 'drain', oppositeRailKind: 'power' });
    const gateVoltage = gateDrive.connected ? gateDrive.voltageVolts : null;
    const threshold = Number(component.properties.gateThresholdVolts ?? primitive.model.gateThresholdVolts ?? 2.5);
    const maxDrainCurrentAmps = Number(component.properties[primitive.model.maxDrainCurrentProperty ?? 'maxDrainCurrentAmps'] ?? 0);
    const vgs = gateVoltage === null ? null : gateVoltage - sourceVoltage;
    const on = vgs !== null && vgs >= threshold;
    const drainCurrentAmps = on && drainLoad.resistanceOhms
      ? Math.max(0, drainLoad.voltageVolts / drainLoad.resistanceOhms)
      : on && drainLoad.hasPath ? Number.POSITIVE_INFINITY : 0;

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'mosfet',
      state: on ? 'on' : gateVoltage === null ? 'floating-gate' : 'off',
      gateVoltageVolts: gateVoltage,
      sourceVoltageVolts: sourceVoltage,
      vgsVolts: vgs,
      drainCurrentAmps,
      maxDrainCurrentAmps
    });

    if (!gateDrive.connected) {
      diagnostics.push(`${component.id}.gate: gate flutuante; adicione driver e resistor pull-down/pull-up conforme o circuito.`);
    } else if (!gateDrive.hasPullDown && gateDrive.active) {
      diagnostics.push(`${component.id}.gate: gate sem resistor de pull-down detectável; o MOSFET pode ligar sozinho em hardware real.`);
    }

    if (!isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'source' })) {
      diagnostics.push(`${component.id}.source: fonte de MOSFET canal N deve referenciar GND em chaveamento low-side.`);
    }

    if (gateDrive.active && gateVoltage !== null && vgs < threshold) {
      diagnostics.push(`${component.id}.gate: Vgs ${vgs.toFixed(2)} V abaixo do limiar ${threshold.toFixed(2)} V; MOSFET não conduz adequadamente.`);
    }

    if (on && !drainLoad.hasPath) {
      diagnostics.push(`${component.id}.drain: dreno sem carga detectável até uma alimentação.`);
    }

    if (maxDrainCurrentAmps > 0 && drainCurrentAmps > maxDrainCurrentAmps) {
      diagnostics.push(`${component.id}.drain: corrente estimada ${formatAmps(drainCurrentAmps)} excede limite ${formatAmps(maxDrainCurrentAmps)}.`);
    }
  }
}

function applySwitchModuleRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => ['relay', 'ssr', 'mosfet-module'].includes(item.kind))) {
    const component = primitive.component;
    const model = primitive.model;
    const channels = Number(model.channels ?? component.properties.channels ?? 1);
    const powered = isPoweredModule({ graph, netlist, component });
    const activeHigh = component.properties.activeHigh !== false;
    const ratedCurrentAmps = Number(component.properties[model.ratedCurrentProperty ?? 'ratedCurrentAmps'] ?? 0);
    const ratedVoltageVolts = Number(component.properties[model.ratedVoltageProperty ?? 'ratedVoltageVolts'] ?? 0);
    const channelReadings = [];

    if (!powered) {
      diagnostics.push(`${component.id}: módulo sem VCC/GND válidos; entradas não devem acionar a saída.`);
    }

    if (primitive.kind === 'mosfet-module') {
      const input = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId: component.id, terminalId: 'sig' });
      const active = powered && (activeHigh ? input.active : input.connected && !input.active);
      const load = switchLoadAnalysis({ graph, netlist, componentId: component.id, inputTerminal: 'loadIn', outputTerminal: 'loadOut' });

      channelReadings.push({ channel: 1, active, inputLevel: input.active ? 'HIGH' : 'LOW', ...load });
      validateSwitchLoad({ component, terminalLabel: 'load', load, active, ratedCurrentAmps, ratedVoltageVolts, diagnostics });
    } else {
      for (let index = 1; index <= channels; index++) {
        const input = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId: component.id, terminalId: `in${index}` });
        const active = powered && (activeHigh ? input.active : input.connected && !input.active);
        const load = switchLoadAnalysis({ graph, netlist, componentId: component.id, inputTerminal: `com${index}`, outputTerminal: active ? `no${index}` : `nc${index}` });

        channelReadings.push({ channel: index, active, contact: active ? 'NO' : 'NC', inputLevel: input.active ? 'HIGH' : 'LOW', ...load });
        validateSwitchLoad({ component, terminalLabel: `ch${index}`, load, active, ratedCurrentAmps, ratedVoltageVolts, diagnostics });
      }
    }

    componentReadings.set(component.id, {
      componentId: component.id,
      type: primitive.kind,
      state: channelReadings.some((channel) => channel.active) ? 'active' : powered ? 'idle' : 'unpowered',
      powered,
      channels: channelReadings,
      ratedCurrentAmps,
      ratedVoltageVolts
    });
  }
}

function applyOptoisolatorRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.kind === 'pc817' || item.model.type === 'optoisolator')) {
    const component = primitive.component;
    const input = ledInputAnalysis({ graph, netlist, runtime, runtimesByComponent, componentId: component.id, anodeTerminal: 'anode', cathodeTerminal: 'cathode' });
    const ctr = Number(component.properties.currentTransferRatioPercent ?? 100) / 100;
    const collectorLoad = loadPathAnalysis({ graph, netlist, componentId: component.id, terminalId: 'collector', oppositeRailKind: 'power' });
    const emitterGrounded = isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'emitter' });
    const outputCurrentAmps = input.currentAmps * ctr;
    const state = input.active && emitterGrounded ? 'conducting' : input.active ? 'input-active-output-floating' : 'off';

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'optoisolator',
      state,
      inputCurrentAmps: input.currentAmps,
      outputCurrentAmps,
      currentTransferRatio: ctr
    });

    if (input.active && !input.hasSeriesResistor) {
      diagnostics.push(`${component.id}.anode: LED interno do PC817 acionado sem resistor em série.`);
    }

    if (input.active && !emitterGrounded) {
      diagnostics.push(`${component.id}.emitter: emissor do fototransistor sem referência de GND.`);
    }

    if (input.active && !collectorLoad.hasPath) {
      diagnostics.push(`${component.id}.collector: coletor sem carga/pull-up detectável.`);
    }
  }
}

function applyDarlingtonArrayRules({ graph, netlist, runtime, runtimesByComponent, diagnostics, componentReadings }) {
  for (const primitive of netlist.primitives.filter((item) => item.model.type === 'darlington-array')) {
    const component = primitive.component;
    const channels = Number(primitive.model.channels ?? component.properties.channels ?? 7);
    const grounded = isTerminalConnectedToGround(graph, { componentId: component.id, terminalId: 'gnd' });
    const maxChannelCurrentAmps = Number(component.properties[primitive.model.maxChannelCurrentProperty ?? 'maxChannelCurrentAmps'] ?? 0);
    const channelReadings = [];

    if (!grounded) {
      diagnostics.push(`${component.id}.gnd: ULN precisa de GND comum com o microcontrolador.`);
    }

    for (let index = 1; index <= channels; index++) {
      const input = terminalDriveAnalysis({ graph, runtime, runtimesByComponent, componentId: component.id, terminalId: `in${index}` });
      const load = loadPathAnalysis({ graph, netlist, componentId: component.id, terminalId: `out${index}`, oppositeRailKind: 'power' });
      const active = grounded && input.active;
      const currentAmps = active && load.resistanceOhms
        ? Math.max(0, load.voltageVolts / load.resistanceOhms)
        : active && load.hasPath ? Number.POSITIVE_INFINITY : 0;

      channelReadings.push({ channel: index, active, inputLevel: input.active ? 'HIGH' : 'LOW', currentAmps });

      if (active && !load.hasPath) {
        diagnostics.push(`${component.id}.out${index}: saída open-collector ativa sem carga detectável até VCC.`);
      }

      if (maxChannelCurrentAmps > 0 && currentAmps > maxChannelCurrentAmps) {
        diagnostics.push(`${component.id}.out${index}: corrente estimada ${formatAmps(currentAmps)} excede limite por canal ${formatAmps(maxChannelCurrentAmps)}.`);
      }
    }

    componentReadings.set(component.id, {
      componentId: component.id,
      type: 'darlington-array',
      state: channelReadings.some((channel) => channel.active) ? 'active' : grounded ? 'idle' : 'unpowered',
      grounded,
      channels: channelReadings,
      maxChannelCurrentAmps
    });
  }
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

function findDrivenHighPins({ graph, runtime, arduino, runtimesByComponent }) {
  const boards = runtimesByComponent
    ? graph.findComponentsByBehaviorType('microcontroller')
    : [arduino].filter(Boolean);
  const pins = [];

  for (const board of boards) {
    const boardRuntime = runtimesByComponent?.get(board.id) ?? runtime;

    if (!boardRuntime) {
      continue;
    }

    pins.push(...Object.entries(board.behavior?.pinMap ?? {})
      .filter(([, pin]) => {
        return pin.capabilities?.includes('digital')
          && Number.isInteger(pin.number)
          && boardRuntime.getPin(pin.number).mode === 'OUTPUT'
          && boardRuntime.getPin(pin.number).value === 'HIGH';
      })
      .map(([terminalId]) => ({ componentId: board.id, terminalId })));
  }

  return pins;
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

      if (netHasUartPeer({ graph, net, ownerComponentId: component.id })) {
        continue;
      }

      const node = netlist.nodes.get(net.id);

      if (node?.state === 'floating') {
        diagnostics.push(`${component.id}.${terminalId} (${net.id}): entrada conectada a net flutuante.`);
      }
    }
  }
}

function netHasUartPeer({ graph, net, ownerComponentId }) {
  const ownerTerminal = net.terminals.find((terminal) => terminal.componentId === ownerComponentId);
  const ownerComponent = graph.components.get(ownerComponentId);
  const ownerCapabilities = ownerComponent?.behavior?.pinMap?.[ownerTerminal?.terminalId]?.capabilities ?? [];

  if (!ownerCapabilities.some((capability) => capability === 'uart-rx' || capability === 'uart-tx')) {
    return false;
  }

  return net.terminals.some((terminal) => {
    if (terminal.componentId === ownerComponentId) {
      return false;
    }

    const component = graph.components.get(terminal.componentId);
    const capabilities = component?.behavior?.pinMap?.[terminal.terminalId]?.capabilities ?? [];

    return ownerCapabilities.includes('uart-rx') && capabilities.includes('uart-tx')
      || ownerCapabilities.includes('uart-tx') && capabilities.includes('uart-rx');
  });
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
      || isBehaviorOutputTerminal(component, terminal.terminalId)
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

function isBehaviorOutputTerminal(component, terminalId) {
  return component.behavior?.outputTerminal === terminalId
    && ['momentary-button', 'analog-voltage-source'].includes(component.behavior?.type);
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
