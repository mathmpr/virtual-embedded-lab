import { ArduinoRuntime } from './arduino-runtime.js';
import { createCircuitGraph } from './circuit-graph.js';
import { EnvironmentEngine } from './environment-engine.js';
import { solveElectricalState } from './electrical-solver.js';
import { Hcsr04Behavior } from './hcsr04-behavior.js';
import { EventScheduler, VirtualClock } from './virtual-time.js';
import { createWasmFirmwareSession } from './wasm-firmware-runner.js';

export async function createProjectWasmSimulationSession({ state, nets, terminalKind, wasmBase64, wasmDiagnostics = [], serialRx = [] }) {
  const context = createSimulationContext({ state, nets, terminalKind, serialRx });
  const { graph, runtime, environment, clock, scheduler } = context;
  const wasmSession = await createWasmFirmwareSession(runtime, wasmBase64);
  const program = programFromWasmConstants(wasmSession.constants);
  const diagnostics = formatFirmwareDiagnostics(wasmDiagnostics);
  let inputBindings = { rainBindings: [], lightBindings: [] };

  inputBindings = bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program, diagnostics });
  wasmSession.setup();

  return {
    updateDistanceValue(componentId, valueCm) {
      environment.write(`${componentId}.distance`, Number(valueCm));
    },
    updateRainValue(componentId, value) {
      environment.write(`${componentId}.rain`, normalizeRainValue(value));
      applyRainSensorInputs({ runtime, environment, rainBindings: inputBindings.rainBindings });
    },
    updateLightValue(componentId, value) {
      environment.write(`${componentId}.light`, normalizeLightValue(value));
      applyLightSensorInputs({ runtime, environment, lightBindings: inputBindings.lightBindings });
    },
    updateClimateValue(componentId, value) {
      environment.write(`${componentId}.climate`, normalizeClimateValue(value));
    },
    updateAnalogVoltageValue(componentId, value) {
      environment.write(`${componentId}.analog-voltage`, normalizeAnalogVoltageValue(value));
    },
    runFrame({ serialRx: frameSerialRx = [] } = {}) {
      for (const data of frameSerialRx) {
        runtime.serialReceive(data);
      }

      applyRainSensorInputs({ runtime, environment, rainBindings: inputBindings.rainBindings });
      applyLightSensorInputs({ runtime, environment, lightBindings: inputBindings.lightBindings });

      const firmwareResult = wasmSession.runLoop({ loopIterations: 3, drainEvents: true });

      return finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics: [...diagnostics], pins: program.pins, source: 'wasm' });
    }
  };
}

export async function runProjectWasmSimulation({ state, nets, terminalKind, wasmBase64, wasmDiagnostics = [], serialRx = [] }) {
  const context = createSimulationContext({ state, nets, terminalKind, serialRx });
  const { graph, runtime, environment, clock, scheduler } = context;
  const wasmSession = await createWasmFirmwareSession(runtime, wasmBase64);
  const program = programFromWasmConstants(wasmSession.constants);
  const diagnostics = formatFirmwareDiagnostics(wasmDiagnostics);

  bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program, diagnostics });
  wasmSession.setup();

  const firmwareResult = wasmSession.runLoop({ loopIterations: 3 });

  return finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics, pins: program.pins, source: 'wasm' });
}

export function createSimulationContext({ state, nets, terminalKind, serialRx = [] }) {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const graph = createCircuitGraph({ components: state.components, nets, terminalKind });
  const environment = new EnvironmentEngine();
  const runtime = new ArduinoRuntime(clock, scheduler, graph);

  for (const data of serialRx) {
    runtime.serialReceive(data);
  }

  return {
    clock,
    scheduler,
    graph,
    environment,
    runtime
  };
}

function programFromWasmConstants(constants = {}) {
  const pins = {};

  if (Number.isInteger(constants.TRIGGER_PIN)) {
    pins.trigger = constants.TRIGGER_PIN;
  }

  if (Number.isInteger(constants.ECHO_PIN)) {
    pins.echo = constants.ECHO_PIN;
  }

  if (Number.isInteger(constants.LED_PIN)) {
    pins.led = constants.LED_PIN;
  } else if (Number.isInteger(constants.PIN)) {
    pins.led = constants.PIN;
  } else if (Number.isInteger(constants.LED_BUILTIN)) {
    pins.led = constants.LED_BUILTIN;
  }

  return {
    pins,
    constants,
    inferredConstants: {}
  };
}

export function bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program, diagnostics }) {
  bindEnvironmentChannels({ graph, environment, diagnostics });
  bindWifiEnvironment({ graph, runtime });
  bindHcsr04Sensors({ graph, environment, runtime, clock, scheduler, program, diagnostics });
  bindBmp280Sensors({ graph, environment, runtime, diagnostics });
  bindAdcConverters({ graph, environment, runtime, diagnostics });
  return {
    rainBindings: bindRainSensors({ graph, environment, runtime, diagnostics }),
    lightBindings: bindLightSensors({ graph, environment, runtime, diagnostics })
  };
}

export function finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics, pins, source = 'wasm' }) {
  const electrical = solveElectricalState({ graph, runtime });
  diagnostics.push(...electrical.diagnostics);

  return {
    source,
    timeUs: clock.nowUs(),
    firmwareResult,
    signals: {
      trig: Number.isInteger(pins.trigger) && runtime.getPin(pins.trigger).value === 'HIGH' ? 1 : 0,
      echo: firmwareResult.echoDuration > 0 ? Math.min(firmwareResult.echoDuration / 30_000, 1) : 0,
      led: [...electrical.ledStates.values()].some(Boolean) ? 1 : 0,
      rain: rainSignal(environment),
      rainDo: rainDigitalSignal(graph, runtime),
      light: lightSignal(environment),
      lightAnalog: lightAnalogSignal(graph, runtime)
    },
    ledStates: electrical.ledStates,
    builtInLedStates: builtInLedStates({ graph, runtime }),
    builtInLedEvents: builtInLedEvents({ graph, pinEvents: firmwareResult.pinEvents }),
    electrical,
    environment: environment.snapshot(),
    serial: firmwareResult.serial ?? runtime.getSerialSnapshot(),
    diagnostics
  };
}

export function applyBoardConstants({ graph, program }) {
  const builtInLed = firstProgrammableBuiltInLed(graph);

  if (Number.isInteger(builtInLed?.pin)) {
    program.constants = {
      ...program.constants,
      LED_BUILTIN: builtInLed.pin
    };

    if (program.inferredConstants?.LED_PIN || program.inferredConstants?.PIN) {
      if (program.inferredConstants?.LED_PIN) {
        program.constants.LED_PIN = builtInLed.pin;
      }

      if (program.inferredConstants?.PIN) {
        program.constants.PIN = builtInLed.pin;
      }

      program.pins.led = builtInLed.pin;
    }
  }
}

function builtInLedEvents({ graph, pinEvents }) {
  const events = [];

  for (const component of graph.components.values()) {
    for (const led of component.behavior?.builtInLeds ?? []) {
      if (!Number.isInteger(led.pin)) {
        continue;
      }

      for (const event of pinEvents.filter((item) => item.pin === led.pin)) {
        events.push({
          componentId: component.id,
          ledId: led.id,
          value: led.activeHigh === false ? event.value === 'LOW' : event.value === 'HIGH',
          timeUs: event.timeUs
        });
      }
    }
  }

  return events.sort((left, right) => left.timeUs - right.timeUs);
}

function firstProgrammableBuiltInLed(graph) {
  const boards = [...graph.components.values()].filter((component) => component.behavior?.type === 'microcontroller');

  for (const board of boards) {
    const led = board.behavior?.builtInLeds?.find((item) => Number.isInteger(item.pin));

    if (led) {
      return led;
    }
  }

  return null;
}

function builtInLedStates({ graph, runtime }) {
  const states = new Map();

  for (const component of graph.components.values()) {
    for (const led of component.behavior?.builtInLeds ?? []) {
      const key = `${component.id}.${led.id}`;

      if (!Number.isInteger(led.pin)) {
        states.set(key, Boolean(led.active));
        continue;
      }

      const pinValue = runtime.getPin(led.pin).value;
      const isOn = led.activeHigh === false ? pinValue === 'LOW' : pinValue === 'HIGH';
      states.set(key, isOn);
    }
  }

  return states;
}

function formatFirmwareDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => {
    const location = diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : '';
    return `[${diagnostic.severity}] ${diagnostic.source ?? 'firmware'}${location}: ${diagnostic.message}`;
  });
}

function bindEnvironmentChannels({ graph, environment, diagnostics }) {
  const channels = new Set();

  for (const component of graph.components.values()) {
    const channel = component.behavior?.channel;

    if (!channel || (component.simulation && component.simulation.kind !== 'environment-source')) {
      continue;
    }

    environment.createChannel({
      id: `${component.id}.${channel}`,
      type: channel,
      value: environmentChannelValue(component),
      unit: environmentChannelUnit(component),
      sourceComponentId: component.id
    });
    channels.add(channel);
  }

  for (const component of graph.components.values()) {
    const requiredChannel = component.behavior?.environmentChannel;

    if (requiredChannel && !channels.has(requiredChannel)) {
      diagnostics.push(`${component.id}: nenhum controle ambiental '${requiredChannel}' disponível.`);
    }
  }
}

function environmentChannelValue(component) {
  const behavior = component.behavior ?? {};

  if (behavior.channel === 'distance') {
    return Number(component.properties[behavior.valueProperty] ?? 150);
  }

  if (behavior.channel === 'rain') {
    return normalizeRainValue({
      active: component.properties[behavior.activeProperty] ?? false,
      intensityPercent: component.properties[behavior.intensityProperty] ?? 100
    });
  }

  if (behavior.channel === 'light') {
    return normalizeLightValue({
      enabled: component.properties[behavior.activeProperty] ?? true,
      intensityPercent: component.properties[behavior.intensityProperty] ?? 50
    });
  }

  if (behavior.channel === 'climate') {
    return normalizeClimateValue({
      enabled: component.properties[behavior.activeProperty] ?? true,
      temperatureC: component.properties[behavior.temperatureProperty] ?? 25,
      pressureHpa: component.properties[behavior.pressureProperty] ?? 1013.25
    });
  }

  if (behavior.channel === 'analog-voltage') {
    return normalizeAnalogVoltageValue({
      enabled: component.properties[behavior.activeProperty] ?? true,
      voltageVolts: component.properties[behavior.voltageProperty] ?? 0
    });
  }

  return component.properties[behavior.valueProperty] ?? null;
}

function environmentChannelUnit(component) {
  const behavior = component.behavior ?? {};
  const propertyName = behavior.valueProperty ?? behavior.voltageProperty ?? behavior.temperatureProperty;
  return component.propertySchema?.[propertyName]?.unit ?? null;
}

function bindWifiEnvironment({ graph, runtime }) {
  const wifiSignals = graph.findComponentsByType('wifi-signal');

  runtime.configureWifiEnvironment({
    networks: wifiSignals.map((wifiSignal) => ({
      ssid: wifiSignal.properties.ssid ?? 'VirtualLab',
      internetAvailable: wifiSignal.properties.connected ?? false,
      strengthPercent: wifiSignal.properties.strengthPercent ?? 0
    }))
  });
}

function bindHcsr04Sensors({ graph, environment, runtime, clock, scheduler, program, diagnostics }) {
  const arduino = graph.findComponentsByType('arduino')[0];

  for (const sensor of graph.findComponentsByType('hcsr04')) {
    const distanceSource = graph.findComponentsByType('distance').find((distanceControl) => {
      return graph.areConnected(
        { componentId: distanceControl.id, terminalId: 'distance' },
        { componentId: sensor.id, terminalId: 'trigger' }
      );
    });

    if (!distanceSource) {
      diagnostics.push(`${sensor.id}: nenhum controle de distância ligado ao TRIG.`);
      continue;
    }

    if (!arduino) {
      diagnostics.push(`${sensor.id}: Arduino não encontrado para mapear TRIG/ECHO.`);
      continue;
    }

    if (!Number.isInteger(program.pins.trigger) || !Number.isInteger(program.pins.echo)) {
      diagnostics.push(`${sensor.id}: firmware não exportou constantes TRIGGER_PIN/ECHO_PIN para mapear TRIG/ECHO.`);
      continue;
    }

    const behavior = new Hcsr04Behavior({
      component: sensor,
      clock,
      scheduler,
      environment,
      runtime,
      graph,
      channelId: `${distanceSource.id}.distance`,
      pins: program.pins
    });

    graph.onTerminalDriven((terminal, value) => {
      const isSensorTriggerTerminal = terminal.componentId === sensor.id && terminal.terminalId === 'trigger';

      if (isSensorTriggerTerminal) {
        behavior.onTrigger(value);
      }
    });
  }
}

function bindBmp280Sensors({ graph, environment, runtime, diagnostics }) {
  const climateSources = graph.findComponentsByType('climate-environment');

  for (const sensor of graph.findComponentsByType('bmp280-sensor')) {
    const source = climateSources[0] ?? null;
    const address = Number(sensor.properties.i2cAddress ?? 118);

    if (!source) {
      diagnostics.push(`${sensor.id}: nenhum controle de clima disponível.`);
      continue;
    }

    if (!bmp280HasI2cBus(graph, sensor)) {
      diagnostics.push(`${sensor.id}: SDA/SCL não estão ligados a um barramento I2C conhecido.`);
      continue;
    }

    runtime.registerI2cDevice(address, {
      type: 'bmp280',
      componentId: sensor.id,
      readTemperature() {
        const climate = normalizeClimateValue(environment.read(`${source.id}.climate`));
        return climate.enabled ? climate.temperatureC + Number(sensor.properties.temperatureOffsetC ?? 0) : 0;
      },
      readPressure() {
        const climate = normalizeClimateValue(environment.read(`${source.id}.climate`));
        return climate.enabled ? (climate.pressureHpa + Number(sensor.properties.pressureOffsetHpa ?? 0)) * 100 : 0;
      },
      readBytes(count) {
        return new Array(Math.max(0, Number(count) || 0)).fill(0);
      }
    });
  }
}

function bindAdcConverters({ graph, environment, runtime, diagnostics }) {
  for (const adc of [...graph.findComponentsByType('ads1015-adc'), ...graph.findComponentsByType('ads1115-adc')]) {
    const model = adc.type === 'ads1015-adc' ? 'ads1015' : 'ads1115';
    const maxRaw = model === 'ads1015' ? 2047 : 32767;
    const source = analogSourceForTerminal(graph, { componentId: adc.id, terminalId: 'a0' });

    if (!source) {
      diagnostics.push(`${adc.id}: canal A0 sem fonte analógica.`);
      continue;
    }

    if (!i2cBusConnected(graph, adc)) {
      diagnostics.push(`${adc.id}: SDA/SCL não estão ligados a um barramento I2C conhecido.`);
      continue;
    }

    runtime.registerI2cDevice(Number(adc.properties.i2cAddress ?? 72), {
      type: model,
      componentId: adc.id,
      readChannel(channel) {
        return channel === 0 ? externalAdcRaw({
          voltage: analogVoltage(environment, source.id),
          maxRaw,
          fullScaleVolts: gainToFullScaleVolts(adc.properties.gain)
        }) : 0;
      },
      computeVolts(raw) {
        return clamp(Number(raw) / maxRaw, 0, 1) * gainToFullScaleVolts(adc.properties.gain);
      },
      readBytes(count) {
        return new Array(Math.max(0, Number(count) || 0)).fill(0);
      }
    });
  }

  for (const adc of graph.findComponentsByType('mcp3008-adc')) {
    const source = analogSourceForTerminal(graph, { componentId: adc.id, terminalId: 'ch0' });
    const chipSelectPin = digitalPinConnectedToTerminal(graph, { componentId: adc.id, terminalId: 'cs' });

    if (!source) {
      diagnostics.push(`${adc.id}: canal CH0 sem fonte analógica.`);
      continue;
    }

    if (!Number.isInteger(chipSelectPin)) {
      diagnostics.push(`${adc.id}: CS não está ligado a um pino digital do Arduino.`);
      continue;
    }

    runtime.registerSpiDevice(chipSelectPin, {
      type: 'mcp3008',
      componentId: adc.id,
      readChannel(channel) {
        return channel === 0 ? externalAdcRaw({
          voltage: analogVoltage(environment, source.id),
          maxRaw: 1023,
          fullScaleVolts: Number(adc.properties.referenceVoltageVolts ?? 5)
        }) : 0;
      }
    });
  }
}

function hasExternalAdc(graph) {
  return graph.findComponentsByType('ads1015-adc').length > 0
    || graph.findComponentsByType('ads1115-adc').length > 0
    || graph.findComponentsByType('mcp3008-adc').length > 0;
}

function i2cBusConnected(graph, component) {
  return [...graph.findComponentsByType('arduino'), ...graph.findComponentsByType('esp32-devkit')].some((board) => {
    if (board.type === 'arduino') {
      return graph.areConnected({ componentId: board.id, terminalId: 'a4' }, { componentId: component.id, terminalId: 'sda' })
        && graph.areConnected({ componentId: board.id, terminalId: 'a5' }, { componentId: component.id, terminalId: 'scl' });
    }

    return graph.areConnected({ componentId: board.id, terminalId: 'io21' }, { componentId: component.id, terminalId: 'sda' })
      && graph.areConnected({ componentId: board.id, terminalId: 'io22' }, { componentId: component.id, terminalId: 'scl' });
  });
}

function analogSourceForTerminal(graph, terminal) {
  return graph.findComponentsByType('analog-voltage-source').find((source) => {
    return graph.areConnected({ componentId: source.id, terminalId: 'out' }, terminal);
  }) ?? null;
}

function analogVoltage(environment, sourceId) {
  const value = normalizeAnalogVoltageValue(environment.read(`${sourceId}.analog-voltage`));
  return value.enabled ? value.voltageVolts : 0;
}

function externalAdcRaw({ voltage, maxRaw, fullScaleVolts }) {
  return Math.round(clamp(Number(voltage) / Math.max(0.001, Number(fullScaleVolts)), 0, 1) * maxRaw);
}

function gainToFullScaleVolts(gain = '2.048V') {
  const parsed = Number(String(gain).replace('V', ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2.048;
}

function bmp280HasI2cBus(graph, sensor) {
  const boards = [
    ...graph.findComponentsByType('arduino'),
    ...graph.findComponentsByType('esp32-devkit')
  ];

  return boards.some((board) => {
    if (board.type === 'arduino') {
      return graph.areConnected({ componentId: board.id, terminalId: 'a4' }, { componentId: sensor.id, terminalId: 'sda' })
        && graph.areConnected({ componentId: board.id, terminalId: 'a5' }, { componentId: sensor.id, terminalId: 'scl' });
    }

    if (board.type === 'esp32-devkit') {
      return graph.areConnected({ componentId: board.id, terminalId: 'io21' }, { componentId: sensor.id, terminalId: 'sda' })
        && graph.areConnected({ componentId: board.id, terminalId: 'io22' }, { componentId: sensor.id, terminalId: 'scl' });
    }

    return false;
  });
}

function bindRainSensors({ graph, environment, runtime, diagnostics }) {
  const bindings = [];
  const rainSources = graph.findComponentsByType('rain-toggle');
  const rainSensors = graph.findComponentsByType('fc37-rain-sensor');

  for (const sensor of rainSensors) {
    const pin = digitalPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId: 'do' });
    const rainSource = rainSourceForSensor({ graph, rainSources, sensor });

    if (!Number.isInteger(pin)) {
      diagnostics.push(`${sensor.id}: DO não está ligado a um pino digital do Arduino.`);
      continue;
    }

    if (!rainSource) {
      diagnostics.push(`${sensor.id}: nenhum controle de chuva disponível.`);
      continue;
    }

    bindings.push({
      sensor,
      pin,
      channelId: `${rainSource.id}.rain`
    });
  }

  applyRainSensorInputs({ runtime, environment, rainBindings: bindings });
  return bindings;
}

function rainSourceForSensor({ graph, rainSources, sensor }) {
  return rainSources.find((source) => {
    return graph.areConnected(
      { componentId: source.id, terminalId: 'rain' },
      { componentId: sensor.id, terminalId: 'do' }
    );
  }) ?? rainSources[0] ?? null;
}

function applyRainSensorInputs({ runtime, environment, rainBindings }) {
  for (const binding of rainBindings) {
    const rain = environment.read(binding.channelId);
    const activeLow = binding.sensor.properties.activeLow !== false;
    const isWet = Boolean(rain?.active);
    const value = isWet
      ? activeLow ? 'LOW' : 'HIGH'
      : activeLow ? 'HIGH' : 'LOW';

    runtime.driveInput(binding.pin, value);
  }
}

function bindLightSensors({ graph, environment, runtime, diagnostics }) {
  const bindings = [];
  const lightSources = graph.findComponentsByType('light-level');
  const lightSensors = graph.findComponentsByType('ldr-light-sensor');

  for (const sensor of lightSensors) {
    const source = lightSources[0] ?? null;
    const divider = ldrVoltageDivider({ graph, sensor });

    if (!source) {
      diagnostics.push(`${sensor.id}: nenhum controle de luminosidade disponível.`);
      continue;
    }

    if (!divider) {
      diagnostics.push(`${sensor.id}: divisor de tensão incompleto para leitura analógica.`);
      continue;
    }

    bindings.push({
      sensor,
      channelId: `${source.id}.light`,
      ...divider
    });
  }

  applyLightSensorInputs({ runtime, environment, lightBindings: bindings });
  return bindings;
}

function applyLightSensorInputs({ runtime, environment, lightBindings }) {
  for (const binding of lightBindings) {
    const light = normalizeLightValue(environment.read(binding.channelId));
    const ldrResistance = ldrResistanceOhms(binding.sensor, light);
    const reading = voltageDividerReading({
      ldrResistanceOhms: ldrResistance,
      fixedResistanceOhms: binding.fixedResistanceOhms,
      ldrSide: binding.ldrSide
    });

    runtime.driveAnalogInput(binding.pin, reading.raw, {
      voltageVolts: reading.voltageVolts,
      resistanceOhms: ldrResistance,
      sourceComponentId: binding.sensor.id
    });
  }
}

function ldrVoltageDivider({ graph, sensor }) {
  const sides = [
    { ldrTerminalId: 'a', midpointTerminalId: 'b', side: 'power' },
    { ldrTerminalId: 'b', midpointTerminalId: 'a', side: 'ground' }
  ];

  for (const candidate of sides) {
    const pin = analogPinConnectedToTerminal(graph, {
      componentId: sensor.id,
      terminalId: candidate.midpointTerminalId
    });
    const resistor = resistorFromMidpointToOppositeRail(graph, {
      midpoint: { componentId: sensor.id, terminalId: candidate.midpointTerminalId },
      expectedRailKind: candidate.side === 'power' ? 'ground' : 'power'
    });
    const ldrRail = terminalNetHasKind(graph, { componentId: sensor.id, terminalId: candidate.ldrTerminalId }, candidate.side);

    if (Number.isInteger(pin) && resistor && ldrRail) {
      return {
        pin,
        fixedResistanceOhms: Number(resistor.component.properties.resistanceOhms ?? 10000),
        ldrSide: candidate.side
      };
    }
  }

  return null;
}

function resistorFromMidpointToOppositeRail(graph, { midpoint, expectedRailKind }) {
  const midpointNet = graph.findTerminalNet(midpoint.componentId, midpoint.terminalId);

  if (!midpointNet) {
    return null;
  }

  for (const component of graph.findComponentsByType('resistor')) {
    const terminals = ['a', 'b'];

    for (const terminalId of terminals) {
      const otherTerminalId = terminalId === 'a' ? 'b' : 'a';
      const connectedToMidpoint = midpointNet.terminals.some((terminal) => terminal.componentId === component.id && terminal.terminalId === terminalId);

      if (!connectedToMidpoint) {
        continue;
      }

      if (terminalNetHasKind(graph, { componentId: component.id, terminalId: otherTerminalId }, expectedRailKind)) {
        return { component, terminalId, otherTerminalId };
      }
    }
  }

  return null;
}

function terminalNetHasKind(graph, terminal, kind) {
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!net) {
    return false;
  }

  return net.terminals.some((item) => graph.terminalKind(item) === kind);
}

function analogPinConnectedToTerminal(graph, terminal) {
  const microcontrollers = [
    ...graph.findComponentsByType('arduino'),
    ...graph.findComponentsByType('esp32-devkit')
  ];
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!net) {
    return null;
  }

  for (const board of microcontrollers) {
    for (const netTerminal of net.terminals) {
      if (netTerminal.componentId !== board.id) {
        continue;
      }

      const unoMatch = netTerminal.terminalId.match(/^a([0-5])$/);

      if (board.type === 'arduino' && unoMatch) {
        return 14 + Number(unoMatch[1]);
      }

      const espMatch = netTerminal.terminalId.match(/^io(\d+)$/);

      if (board.type === 'esp32-devkit' && espMatch) {
        return Number(espMatch[1]);
      }
    }
  }

  return null;
}

function ldrResistanceOhms(sensor, light) {
  const dark = clamp(Number(sensor.properties.darkResistanceOhms ?? 100000), 1, 10_000_000);
  const bright = clamp(Number(sensor.properties.brightResistanceOhms ?? 1000), 1, dark);
  const gamma = clamp(Number(sensor.properties.gamma ?? 0.7), 0.1, 2);
  const intensity = light.enabled ? clamp(Number(light.intensityPercent ?? 0) / 100, 0, 1) : 0;
  const curved = Math.pow(intensity, gamma);

  return dark * Math.pow(bright / dark, curved);
}

function voltageDividerReading({ ldrResistanceOhms, fixedResistanceOhms, ldrSide }) {
  const fixedResistance = Math.max(1, Number(fixedResistanceOhms) || 10000);
  const totalResistance = Math.max(1, ldrResistanceOhms + fixedResistance);
  const voltageVolts = ldrSide === 'power'
    ? 5 * fixedResistance / totalResistance
    : 5 * ldrResistanceOhms / totalResistance;

  return {
    voltageVolts,
    raw: Math.round(clamp(voltageVolts / 5, 0, 1) * 1023)
  };
}

function digitalPinConnectedToTerminal(graph, terminal) {
  const arduino = graph.findComponentsByType('arduino')[0];

  if (!arduino) {
    return null;
  }

  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!net) {
    return null;
  }

  for (const netTerminal of net.terminals) {
    if (netTerminal.componentId !== arduino.id) {
      continue;
    }

    const match = netTerminal.terminalId.match(/^d(\d+)$/);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function normalizeRainValue(value) {
  return {
    active: Boolean(value?.active),
    intensityPercent: Math.max(0, Math.min(100, Number(value?.intensityPercent ?? 100)))
  };
}

function normalizeLightValue(value) {
  return {
    enabled: Boolean(value?.enabled ?? true),
    intensityPercent: clamp(Number(value?.intensityPercent ?? 50), 0, 100)
  };
}

function normalizeClimateValue(value) {
  return {
    enabled: Boolean(value?.enabled ?? true),
    temperatureC: clamp(Number(value?.temperatureC ?? 25), -40, 85),
    pressureHpa: clamp(Number(value?.pressureHpa ?? 1013.25), 300, 1100)
  };
}

function normalizeAnalogVoltageValue(value) {
  return {
    enabled: Boolean(value?.enabled ?? true),
    voltageVolts: clamp(Number(value?.voltageVolts ?? 0), 0, 5)
  };
}

function rainSignal(environment) {
  return environment.snapshot().some((channel) => channel.type === 'rain' && channel.value?.active) ? 1 : 0;
}

function lightSignal(environment) {
  const light = environment.snapshot().find((channel) => channel.type === 'light')?.value;
  const normalized = normalizeLightValue(light);
  return normalized.enabled ? normalized.intensityPercent / 100 : 0;
}

function lightAnalogSignal(graph, runtime) {
  for (const sensor of graph.findComponentsByType('ldr-light-sensor')) {
    for (const terminalId of ['a', 'b']) {
      const pin = analogPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId });

      if (Number.isInteger(pin)) {
        return runtime.analogRead(pin) / 1023;
      }
    }
  }

  return 0;
}

function rainDigitalSignal(graph, runtime) {
  for (const sensor of graph.findComponentsByType('fc37-rain-sensor')) {
    const pin = digitalPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId: 'do' });

    if (Number.isInteger(pin)) {
      return runtime.digitalRead(pin) === 'HIGH' ? 1 : 0;
    }
  }

  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
