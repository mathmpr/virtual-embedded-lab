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
  let rainBindings = [];

  rainBindings = bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program, diagnostics });
  wasmSession.setup();

  return {
    updateDistanceValue(componentId, valueCm) {
      environment.write(`${componentId}.distance`, Number(valueCm));
    },
    updateRainValue(componentId, value) {
      environment.write(`${componentId}.rain`, normalizeRainValue(value));
      applyRainSensorInputs({ runtime, environment, rainBindings });
    },
    runFrame({ serialRx: frameSerialRx = [] } = {}) {
      for (const data of frameSerialRx) {
        runtime.serialReceive(data);
      }

      applyRainSensorInputs({ runtime, environment, rainBindings });

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
  return bindRainSensors({ graph, environment, runtime, diagnostics });
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
      rainDo: rainDigitalSignal(graph, runtime)
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
  for (const distanceControl of graph.findComponentsByType('distance')) {
    const channelId = `${distanceControl.id}.distance`;
    environment.createChannel({
      id: channelId,
      type: 'distance',
      value: Number(distanceControl.properties.valueCm ?? 150),
      unit: 'cm',
      sourceComponentId: distanceControl.id
    });
  }

  if (graph.findComponentsByType('hcsr04').length > 0 && graph.findComponentsByType('distance').length === 0) {
    diagnostics.push('Nenhum controle de distância no projeto.');
  }

  for (const rainControl of graph.findComponentsByType('rain-toggle')) {
    environment.createChannel({
      id: `${rainControl.id}.rain`,
      type: 'rain',
      value: normalizeRainValue({
        active: rainControl.properties.active ?? false,
        intensityPercent: rainControl.properties.intensityPercent ?? 100
      }),
      sourceComponentId: rainControl.id
    });
  }

  if (graph.findComponentsByType('fc37-rain-sensor').length > 0 && graph.findComponentsByType('rain-toggle').length === 0) {
    diagnostics.push('Nenhum controle de chuva no projeto.');
  }
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

function rainSignal(environment) {
  return environment.snapshot().some((channel) => channel.type === 'rain' && channel.value?.active) ? 1 : 0;
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
