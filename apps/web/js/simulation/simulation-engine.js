import { ArduinoRuntime } from './arduino-runtime.js';
import { createCircuitGraph } from './circuit-graph.js';
import { EnvironmentEngine } from './environment-engine.js';
import {
  environmentPayloadForComponent,
  environmentUnitForComponent,
  normalizeEnvironmentValue,
  wifiEnvironmentPayload
} from './environment-payload.js';
import { solveElectricalState } from './electrical-solver.js';
import { createSimulationBehaviorRegistry } from './behavior-registry.js';
import {
  applyLightSensorInputs,
  applyRainSensorInputs,
  registerSensorBehaviorAdapters
} from './sensor-behavior-adapters.js';
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
      environment.write(`${componentId}.distance`, normalizeEnvironmentValue('distance', valueCm));
    },
    updateRainValue(componentId, value) {
      environment.write(`${componentId}.rain`, normalizeEnvironmentValue('rain', value));
      applyRainSensorInputs({ runtime, environment, rainBindings: inputBindings.rainBindings });
    },
    updateLightValue(componentId, value) {
      environment.write(`${componentId}.light`, normalizeEnvironmentValue('light', value));
      applyLightSensorInputs({ runtime, environment, lightBindings: inputBindings.lightBindings });
    },
    updateClimateValue(componentId, value) {
      environment.write(`${componentId}.climate`, normalizeEnvironmentValue('climate', value));
    },
    updateAnalogVoltageValue(componentId, value) {
      environment.write(`${componentId}.analog-voltage`, normalizeEnvironmentValue('analog-voltage', value));
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

  const registry = createSimulationBehaviorRegistry();
  registerSensorBehaviorAdapters(registry);

  return registry.bindAll({ graph, environment, runtime, clock, scheduler, program, diagnostics });
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
      value: environmentPayloadForComponent(component),
      unit: environmentUnitForComponent(component),
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

function bindWifiEnvironment({ graph, runtime }) {
  const wifiSignals = graph.findComponentsByBehaviorType('wireless-environment')
    .filter((component) => component.behavior?.capability === 'wifi');

  runtime.configureWifiEnvironment(wifiEnvironmentPayload(wifiSignals));
}

function analogPinConnectedToTerminal(graph, terminal) {
  const microcontrollers = graph.findComponentsByBehaviorType('microcontroller');
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

      if (board.electricalModel?.logicVoltage === 5 && unoMatch) {
        return 14 + Number(unoMatch[1]);
      }

      const espMatch = netTerminal.terminalId.match(/^io(\d+)$/);

      if (board.electricalModel?.logicVoltage === 3.3 && espMatch) {
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
  const arduino = graph.findComponentsByBehaviorType('microcontroller')[0];

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

function rainSignal(environment) {
  return environment.snapshot().some((channel) => channel.type === 'rain' && channel.value?.active) ? 1 : 0;
}

function lightSignal(environment) {
  const light = environment.snapshot().find((channel) => channel.type === 'light')?.value;
  const normalized = normalizeEnvironmentValue('light', light);
  return normalized.enabled ? normalized.intensityPercent / 100 : 0;
}

function lightAnalogSignal(graph, runtime) {
  for (const sensor of graph.findComponentsByEnvironmentChannel('light')) {
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
  for (const sensor of graph.findComponentsByEnvironmentChannel('rain')) {
    const pin = digitalPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId: sensor.behavior?.digitalOutputTerminal ?? 'do' });

    if (Number.isInteger(pin)) {
      return runtime.digitalRead(pin) === 'HIGH' ? 1 : 0;
    }
  }

  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
