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
  applyBuzzerStates,
  applyButtonInputs,
  applyLightSensorInputs,
  applyRainSensorInputs,
  applySevenSegmentStates,
  applyWaterPumpSystems,
  registerSensorBehaviorAdapters
} from './sensor-behavior-adapters.js';
import {
  resolveAnalogPinConnectedToTerminal,
  resolveDigitalPinConnectedToTerminal
} from './pin-capability-resolver.js';
import { createSignalSnapshot } from './signal-snapshot.js';
import { EventScheduler, VirtualClock } from './virtual-time.js';
import { createWasmFirmwareSession } from './wasm-firmware-runner.js';
import {
  loadComponentContributionModules,
  registerLoadedComponentContributions
} from '../component-contributions.js';

export async function createProjectWasmSimulationSession({ state, nets, terminalKind, wasmBase64, wasmDiagnostics = [], serialRx = [], network = {} }) {
  const context = createSimulationContext({ state, nets, terminalKind, serialRx, network });
  const { graph, runtime, environment, clock, scheduler } = context;
  const wasmSession = await createWasmFirmwareSession(runtime, wasmBase64);
  const program = programFromWasmConstants(wasmSession.constants);
  const diagnostics = formatFirmwareDiagnostics(wasmDiagnostics);
  let inputBindings = { rainBindings: [], lightBindings: [], buttonBindings: [], buzzerBindings: [], waterBindings: [], sevenSegmentBindings: [] };

  await loadComponentContributionModules('simulationBehaviors');
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
    updateWaterValue(componentId, value) {
      environment.write(`${componentId}.water`, normalizeEnvironmentValue('water', value));
    },
    updateDigitalInputValue(componentId, value) {
      const binding = inputBindings.buttonBindings.find((item) => item.button.id === componentId);

      if (binding) {
        binding.button.properties[binding.activeProperty] = Boolean(value);
        applyButtonInputs({ runtime, buttonBindings: [binding] });
      }
    },
    runFrame({ serialRx: frameSerialRx = [] } = {}) {
      for (const data of frameSerialRx) {
        runtime.serialReceive(data);
      }

      applyWaterPumpSystems({ runtime, environment, clock, waterBindings: inputBindings.waterBindings });
      applyRainSensorInputs({ runtime, environment, rainBindings: inputBindings.rainBindings });
      applyLightSensorInputs({ runtime, environment, lightBindings: inputBindings.lightBindings });
      applyButtonInputs({ runtime, buttonBindings: inputBindings.buttonBindings });

      const firmwareResult = wasmSession.runLoop({ loopIterations: 1, drainEvents: true });
      applyBuzzerStates({ runtime, buzzerBindings: inputBindings.buzzerBindings });
      applySevenSegmentStates({ runtime, sevenSegmentBindings: inputBindings.sevenSegmentBindings });
      applyWaterPumpSystems({ runtime, environment, clock, waterBindings: inputBindings.waterBindings });

      return finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics: [...diagnostics], pins: program.pins, source: 'wasm' });
    }
  };
}

export async function createProjectMultiWasmSimulationSession({ state, nets, terminalKind, wasmByComponentId, wasmDiagnosticsByComponentId = new Map(), serialRx = [], network = {} }) {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const graph = createCircuitGraph({ components: state.components, nets, terminalKind });
  const environment = new EnvironmentEngine();
  const runtimesByComponent = new Map();
  const sessions = [];
  const diagnostics = [];
  const inputBindingsByComponent = new Map();

  bindEnvironmentChannels({ graph, environment, diagnostics });
  await loadComponentContributionModules('simulationBehaviors');

  for (const component of graph.findComponentsByBehaviorType('microcontroller')) {
    const wasm = wasmByComponentId.get(component.id);

    if (!wasm?.wasmBase64) {
      diagnostics.push(`${component.id}: firmware WASM ausente.`);
      continue;
    }

    const runtime = new ArduinoRuntime(clock, scheduler, graph, { componentId: component.id, http: network.http ?? {}, mqtt: network.mqtt ?? {} });
    const wasmSession = await createWasmFirmwareSession(runtime, wasm.wasmBase64);

    runtimesByComponent.set(component.id, runtime);
    sessions.push({
      component,
      runtime,
      wasmSession,
      pins: programFromWasmConstants(wasmSession.constants)
    });
    diagnostics.push(...formatFirmwareDiagnostics(wasmDiagnosticsByComponentId.get(component.id) ?? wasm.diagnostics ?? []));
  }

  for (const message of serialRx) {
    receiveTargetedSerial({ runtimesByComponent, graph, message });
  }

  for (const session of sessions) {
    bindWifiEnvironment({ graph, runtime: session.runtime });
    inputBindingsByComponent.set(session.component.id, bindSimulationInputs({
      graph,
      environment,
      runtime: session.runtime,
      clock,
      scheduler,
      program: session.pins,
      diagnostics
    }));
    wasmSessionSetup(session);
  }

  return {
    runFrame({ serialRx: frameSerialRx = [] } = {}) {
      for (const message of frameSerialRx) {
        receiveTargetedSerial({ runtimesByComponent, graph, message });
      }

      const pinEvents = [];
      const serialEvents = [];
      let firmwareResult = null;

      for (const session of sessions) {
        const inputBindings = inputBindingsByComponent.get(session.component.id) ?? {};
        applyWaterPumpSystems({ runtime: session.runtime, environment, clock, waterBindings: inputBindings.waterBindings ?? [] });
        applyRainSensorInputs({ runtime: session.runtime, environment, rainBindings: inputBindings.rainBindings ?? [] });
        applyLightSensorInputs({ runtime: session.runtime, environment, lightBindings: inputBindings.lightBindings ?? [] });
        applyButtonInputs({ runtime: session.runtime, buttonBindings: inputBindings.buttonBindings ?? [] });

        const result = session.wasmSession.runLoop({ loopIterations: 1, drainEvents: true });
        applyBuzzerStates({ runtime: session.runtime, buzzerBindings: inputBindings.buzzerBindings ?? [] });
        applySevenSegmentStates({ runtime: session.runtime, sevenSegmentBindings: inputBindings.sevenSegmentBindings ?? [] });
        applyWaterPumpSystems({ runtime: session.runtime, environment, clock, waterBindings: inputBindings.waterBindings ?? [] });

        firmwareResult = result;
        pinEvents.push(...result.pinEvents.map((event) => ({ ...event, componentId: session.component.id })));
        serialEvents.push(...result.serial.events.map((event) => ({ ...event, componentId: session.component.id })));
        routeSerialTxToConnectedRx({ graph, runtimesByComponent, sourceComponent: session.component, events: result.serial.events });
      }

      return finalizeMultiSimulationResult({
        clock,
        graph,
        environment,
        runtimesByComponent,
        firmwareResult: firmwareResult ?? emptyFirmwareResult(),
        pinEvents,
        serialEvents,
        diagnostics: [...diagnostics],
        source: 'wasm'
      });
    }
  };
}

export async function runProjectWasmSimulation({ state, nets, terminalKind, wasmBase64, wasmDiagnostics = [], serialRx = [], network = {} }) {
  const context = createSimulationContext({ state, nets, terminalKind, serialRx, network });
  const { graph, runtime, environment, clock, scheduler } = context;
  const wasmSession = await createWasmFirmwareSession(runtime, wasmBase64);
  const program = programFromWasmConstants(wasmSession.constants);
  const diagnostics = formatFirmwareDiagnostics(wasmDiagnostics);

  await loadComponentContributionModules('simulationBehaviors');
  const inputBindings = bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program, diagnostics });
  wasmSession.setup();

  const firmwareResult = wasmSession.runLoop({ loopIterations: 1 });
  applyBuzzerStates({ runtime, buzzerBindings: inputBindings.buzzerBindings });
  applySevenSegmentStates({ runtime, sevenSegmentBindings: inputBindings.sevenSegmentBindings });

  return finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics, pins: program.pins, source: 'wasm' });
}

function wasmSessionSetup(session) {
  session.wasmSession.setup();
}

function receiveTargetedSerial({ runtimesByComponent, graph, message }) {
  const targetComponentId = message?.targetComponentId && runtimesByComponent.has(message.targetComponentId)
    ? message.targetComponentId
    : firstRuntimeComponentId({ graph, runtimesByComponent });
  const runtime = runtimesByComponent.get(targetComponentId);

  runtime?.serialReceive(message);
}

function firstRuntimeComponentId({ graph, runtimesByComponent }) {
  return graph.findComponentsByBehaviorType('microcontroller').find((component) => runtimesByComponent.has(component.id))?.id
    ?? [...runtimesByComponent.keys()][0];
}

function routeSerialTxToConnectedRx({ graph, runtimesByComponent, sourceComponent, events }) {
  const sourceTx = sourceComponent.behavior?.buses?.uart?.[0]?.tx;

  if (!sourceTx) {
    return;
  }

  const sourceNet = graph.findTerminalNet(sourceComponent.id, sourceTx);

  if (!sourceNet) {
    return;
  }

  const data = events
    .filter((event) => event.direction === 'TX' && event.type === 'data')
    .map((event) => event.data)
    .join('');

  if (!data) {
    return;
  }

  for (const component of graph.findComponentsByBehaviorType('microcontroller')) {
    if (component.id === sourceComponent.id) {
      continue;
    }

    const targetRx = component.behavior?.buses?.uart?.[0]?.rx;

    if (!targetRx || !sourceNet.terminals.some((terminal) => terminal.componentId === component.id && terminal.terminalId === targetRx)) {
      continue;
    }

    runtimesByComponent.get(component.id)?.serialReceive({
      data,
      baudRate: events.find((event) => event.baudRate)?.baudRate ?? null,
      routedFromComponentId: sourceComponent.id
    });
  }
}

function finalizeMultiSimulationResult({ clock, graph, environment, runtimesByComponent, firmwareResult, pinEvents, serialEvents, diagnostics, source }) {
  const primaryRuntime = runtimesByComponent.get(firstRuntimeComponentId({ graph, runtimesByComponent })) ?? [...runtimesByComponent.values()][0];
  const electrical = solveElectricalState({ graph, runtime: primaryRuntime, runtimesByComponent });
  const signalSnapshot = createSignalSnapshot({ graph, runtime: primaryRuntime, runtimesByComponent, electrical });

  diagnostics.push(...electrical.diagnostics);
  diagnostics.push(...mqttDiagnostics(firmwareResult.mqtt));

  return {
    source,
    timeUs: clock.nowUs(),
    firmwareResult: {
      ...firmwareResult,
      pinEvents,
      serial: {
        baudRate: serialEvents.findLast((event) => Number.isFinite(event.baudRate))?.baudRate ?? null,
        events: serialEvents,
        supportedBaudRates: primaryRuntime?.getSerialSnapshot().supportedBaudRates ?? []
      },
      pinStatesByComponent: Object.fromEntries([...runtimesByComponent.entries()].map(([componentId, runtime]) => [componentId, runtime.getPinsSnapshot()]))
    },
    signals: {
      trig: 0,
      echo: 0,
      led: [...electrical.ledStates.values()].some(Boolean) ? 1 : 0,
      rain: rainSignal(environment),
      rainDo: 0,
      light: lightSignal(environment),
      lightAnalog: 0
    },
    signalsByComponent: signalSnapshot.signalsByComponent,
    signalsByNet: signalSnapshot.signalsByNet,
    ledStates: electrical.ledStates,
    ledEvents: externalLedEvents({ graph, pinEvents }),
    builtInLedStates: builtInLedStates({ graph, runtime: primaryRuntime, runtimesByComponent }),
    builtInLedEvents: builtInLedEvents({ graph, pinEvents }),
    electrical,
    environment: environment.snapshot(),
    serial: {
      baudRate: serialEvents.findLast((event) => Number.isFinite(event.baudRate))?.baudRate ?? null,
      events: serialEvents,
      supportedBaudRates: primaryRuntime?.getSerialSnapshot().supportedBaudRates ?? []
    },
    diagnostics
  };
}

function emptyFirmwareResult() {
  return {
    echoDuration: 0,
    distanceCm: 0,
    ledValue: 'LOW',
    variables: {},
    checkpoints: [],
    pinStates: {},
    analogPinStates: {},
    pinEvents: [],
    serial: { baudRate: null, events: [], supportedBaudRates: [] },
    i2c: {},
    spi: {},
    wifi: {},
    source: 'wasm'
  };
}

export function createSimulationContext({ state, nets, terminalKind, serialRx = [], network = {} }) {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const graph = createCircuitGraph({ components: state.components, nets, terminalKind });
  const environment = new EnvironmentEngine();
  const runtime = new ArduinoRuntime(clock, scheduler, graph, { http: network.http ?? {}, mqtt: network.mqtt ?? {} });

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
  registerLoadedComponentContributions('simulationBehaviors', registry);

  return registry.bindAll({ graph, environment, runtime, clock, scheduler, program, diagnostics });
}

export function finalizeSimulationResult({ clock, graph, runtime, environment, firmwareResult, diagnostics, pins, source = 'wasm' }) {
  const electrical = solveElectricalState({ graph, runtime });
  const signalSnapshot = createSignalSnapshot({ graph, runtime, electrical });
  diagnostics.push(...electrical.diagnostics);
  diagnostics.push(...mqttDiagnostics(firmwareResult.mqtt));

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
    signalsByComponent: signalSnapshot.signalsByComponent,
    signalsByNet: signalSnapshot.signalsByNet,
    ledStates: electrical.ledStates,
    ledEvents: externalLedEvents({ graph, pinEvents: firmwareResult.pinEvents }),
    builtInLedStates: builtInLedStates({ graph, runtime }),
    builtInLedEvents: builtInLedEvents({ graph, pinEvents: firmwareResult.pinEvents }),
    electrical,
    environment: environment.snapshot(),
    serial: firmwareResult.serial ?? runtime.getSerialSnapshot(),
    diagnostics
  };
}

function mqttDiagnostics(mqtt) {
  if (!mqtt || mqtt.mode !== 'real') {
    return [];
  }

  return (mqtt.errors ?? []).map((error) => {
    return `MQTT real ${error.action}: ${error.error}`;
  });
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

function externalLedEvents({ graph, pinEvents }) {
  const events = [];

  for (const event of pinEvents) {
    const board = boardForPinEvent(graph, event);
    const terminalId = board ? terminalIdForPin(board, event.pin) : null;
    const pinNet = terminalId ? graph.findTerminalNet(board.id, terminalId) : null;

    if (!pinNet) {
      continue;
    }

    for (const led of graph.findComponentsByElectricalPrimitive('led')) {
      if (!pinNetDrivesLedAnode({ graph, pinNet, led })) {
        continue;
      }

      events.push({
        componentId: led.id,
        value: event.value === 'HIGH',
        timeUs: event.timeUs
      });
    }
  }

  return events.sort((left, right) => left.timeUs - right.timeUs);
}

function boardForPinEvent(graph, event) {
  if (event.componentId) {
    return graph.components.get(event.componentId) ?? null;
  }

  return graph.findComponentsByBehaviorType('microcontroller')[0] ?? null;
}

function terminalIdForPin(component, pin) {
  const match = Object.entries(component.behavior?.pinMap ?? {}).find(([, pinConfig]) => {
    return Number(pinConfig.number) === Number(pin);
  });

  return match?.[0] ?? `d${pin}`;
}

function pinNetDrivesLedAnode({ graph, pinNet, led }) {
  const anodeTerminal = led.electricalModel?.anodeTerminal ?? 'anode';

  if (pinNet.terminals.some((terminal) => terminal.componentId === led.id && terminal.terminalId === anodeTerminal)) {
    return true;
  }

  for (const resistor of graph.findComponentsByElectricalPrimitive('resistor')) {
    const resistorTerminals = ['a', 'b'];

    for (const terminalId of resistorTerminals) {
      const otherTerminalId = terminalId === 'a' ? 'b' : 'a';
      const resistorOnPinNet = pinNet.terminals.some((terminal) => {
        return terminal.componentId === resistor.id && terminal.terminalId === terminalId;
      });

      if (!resistorOnPinNet) {
        continue;
      }

      if (graph.areConnected(
        { componentId: resistor.id, terminalId: otherTerminalId },
        { componentId: led.id, terminalId: anodeTerminal }
      )) {
        return true;
      }
    }
  }

  return false;
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

function builtInLedStates({ graph, runtime, runtimesByComponent = null }) {
  const states = new Map();

  for (const component of graph.components.values()) {
    for (const led of component.behavior?.builtInLeds ?? []) {
      const key = `${component.id}.${led.id}`;

      if (!Number.isInteger(led.pin)) {
        states.set(key, Boolean(led.active));
        continue;
      }

      const boardRuntime = runtimesByComponent?.get(component.id) ?? runtime;
      const pinValue = boardRuntime.getPin(led.pin).value;
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
      const pin = resolveAnalogPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId });

      if (Number.isInteger(pin)) {
        return runtime.analogRead(pin) / 1023;
      }
    }
  }

  return 0;
}

function rainDigitalSignal(graph, runtime) {
  for (const sensor of graph.findComponentsByEnvironmentChannel('rain')) {
    const pin = resolveDigitalPinConnectedToTerminal(graph, { componentId: sensor.id, terminalId: sensor.behavior?.digitalOutputTerminal ?? 'do' });

    if (Number.isInteger(pin)) {
      return runtime.digitalRead(pin) === 'HIGH' ? 1 : 0;
    }
  }

  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
