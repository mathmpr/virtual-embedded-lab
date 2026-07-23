import {
  createProjectMultiWasmSimulationSession,
  createProjectWasmSimulationSession
} from './simulation/simulation-engine.js';
import { analyzeFirmwareWithBackend, compileFirmwareWasmWithBackend } from './simulation/firmware-analysis-client.js';
import { t } from './i18n.js';
import { normalizeProjectCode } from './project-serializer.js';

export function createVisualSimulation({ state, renderSignals, renderSerial, renderProblems, consoleOutput, getNets, terminalKind, codeEditor, consumeSerialRx, clearSerialRx, appendSerialEvents, clearSerialHistory, onSimulationResult, onSimulationStopped = () => {} }) {
  let ledAnimationTimers = [];
  let simulationTimer = null;
  let firmwareAnalysisCache = null;
  let firmwareWasmCache = null;
  let multiFirmwareWasmCache = null;
  let wasmSimulationSession = null;
  let runningFrame = false;
  let previousFrameTimeUs = 0;

  async function runSimulation() {
    if (state.running) {
      stopSimulationTimer();
    }

    state.running = true;
    firmwareAnalysisCache = null;
    firmwareWasmCache = null;
    multiFirmwareWasmCache = null;
    wasmSimulationSession = null;
    previousFrameTimeUs = 0;
    await runSimulationFrame();
  }

  async function runSimulationFrame() {
    if (!state.running || runningFrame) {
      return;
    }

    runningFrame = true;

    try {
      const firmwareAnalysis = firmwareAnalysisCache ?? await analyzeFirmwareWithBackend(codeEditor.value);
      firmwareAnalysisCache = firmwareAnalysis;
      const multiFirmwareSources = firmwareSourcesByComponent();
      const firmwareWasm = multiFirmwareSources.size > 1
        ? await compileMultiFirmwareWasm(multiFirmwareSources)
        : firmwareWasmCache ?? await compileFirmwareWasmWithBackend(codeEditor.value, {
          constants: firmwareConstantsForBoard()
        });

      if (multiFirmwareSources.size <= 1) {
        firmwareWasmCache = firmwareWasm;
      }

      if (firmwareAnalysis.available && firmwareAnalysis.ok === false) {
        state.running = false;
        onSimulationStopped();
        renderProblems(firmwareAnalysis.diagnostics.map(formatDiagnostic));
        consoleOutput.textContent = t('Simulation blocked: Clang found a firmware error.');
        return;
      }

      if (firmwareWasm.ok !== true) {
        state.running = false;
        onSimulationStopped();
        renderProblems((firmwareWasm.diagnostics ?? []).map(formatDiagnostic));
        consoleOutput.textContent = t('Simulation blocked: WASM firmware was not compiled.');
        return;
      }

      const serialRx = consumeSerialRx();
      const result = await runWasmSimulationFrame({ firmwareWasm, serialRx });

      state.signals = result.signals;
      state.signalsByComponent = result.signalsByComponent ?? new Map();
      state.signalsByNet = result.signalsByNet ?? new Map();
      applyLedStates(result.ledStates);
      applyBuiltInLedStates(result.builtInLedStates);
      clearLedAnimation();
      animateLedEvents(result.ledEvents, result.electrical);
      animateBuiltInLedEvents(result.builtInLedEvents);
      onSimulationResult(result);
      consoleOutput.textContent = renderConsole(result);
      renderSignals();
      appendSerialEvents(result.serial.events.filter((event) => event.direction !== 'RX'));
      renderProblems(result.diagnostics.length > 0 ? result.diagnostics : [t('No critical problems reported by the kernel.')]);
      scheduleNextSimulationFrame(result);
    } catch (error) {
      state.running = false;
      onSimulationStopped();
      renderProblems([`${t('Simulation failed')}: ${error.message}`]);
    } finally {
      runningFrame = false;
    }
  }

  function formatDiagnostic(diagnostic) {
    const location = diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : '';
    return `[${diagnostic.severity}] ${diagnostic.source ?? 'firmware'}${location}: ${diagnostic.message}`;
  }

  function pauseSimulation() {
    state.running = false;
    stopSimulationTimer();
    clearLedAnimation();
    onSimulationStopped();
    consoleOutput.textContent += `\n${t('Simulation paused.')}`;
  }

  function resetSimulation() {
    state.running = false;
    stopSimulationTimer();
    onSimulationStopped();
    firmwareAnalysisCache = null;
    firmwareWasmCache = null;
    multiFirmwareWasmCache = null;
    wasmSimulationSession = null;
    previousFrameTimeUs = 0;
    state.signals = { trig: 0, echo: 0, led: 0 };
    state.signalsByComponent = new Map();
    state.signalsByNet = new Map();
    state.electrical = {
      componentReadings: new Map(),
      netReadings: new Map()
    };
    state.runtime = {
      pinStates: {},
      analogPinStates: {}
    };
    clearSerialRx();
    clearSerialHistory();
    clearLedAnimation();
    applyLedStates(new Map());
    applyBuiltInLedStates(new Map());
    onSimulationResult({ electrical: state.electrical });
    consoleOutput.textContent = t('Runtime ready.');
    renderSignals();
    renderSerial();
    renderProblems([t('Circuit not simulated yet.')]);
  }

  function updateDistanceValue(componentId, valueCm) {
    wasmSimulationSession?.updateDistanceValue?.(componentId, valueCm);
  }

  function updateRainValue(componentId, value) {
    wasmSimulationSession?.updateRainValue?.(componentId, value);
  }

  function updateLightValue(componentId, value) {
    wasmSimulationSession?.updateLightValue?.(componentId, value);
  }

  function updateClimateValue(componentId, value) {
    wasmSimulationSession?.updateClimateValue?.(componentId, value);
  }

  function updateAnalogVoltageValue(componentId, value) {
    wasmSimulationSession?.updateAnalogVoltageValue?.(componentId, value);
  }

  function updateDigitalInputValue(componentId, value) {
    wasmSimulationSession?.updateDigitalInputValue?.(componentId, value);

    if (state.running && wasmSimulationSession && !runningFrame) {
      stopSimulationTimer();
      simulationTimer = setTimeout(runSimulationFrame, 0);
    }
  }

  function applyLedStates(ledStates) {
    for (const component of state.components.values()) {
      if (component.electricalPrimitive === 'led' || component.type === 'led') {
        component.element.classList.toggle('on', ledStates.get(component.id) === true);
      }
    }
  }

  function applyBuiltInLedStates(ledStates) {
    for (const component of state.components.values()) {
      component.element.querySelectorAll('[data-built-in-led]').forEach((indicator) => {
        const key = `${component.id}.${indicator.dataset.builtInLed}`;
        const definition = component.behavior?.builtInLeds?.find((led) => led.id === indicator.dataset.builtInLed);
        const isOn = ledStates.has(key) ? ledStates.get(key) === true : Boolean(definition?.active);
        indicator.classList.toggle('on', isOn);
      });
    }
  }

  function animateBuiltInLedEvents(events = []) {
    if (events.length === 0) {
      return;
    }

    const firstTimeUs = events[0].timeUs;
    const timeScale = 1;

    for (const event of events) {
      const timer = setTimeout(() => {
        const indicator = document.querySelector(`[data-id="${event.componentId}"] [data-built-in-led="${event.ledId}"]`);
        indicator?.classList.toggle('on', event.value);
      }, Math.max(0, (event.timeUs - firstTimeUs) / 1000 * timeScale));

      ledAnimationTimers.push(timer);
    }
  }

  function animateLedEvents(events = [], electrical = {}) {
    if (events.length === 0) {
      return;
    }

    const firstTimeUs = events[0].timeUs;
    const timeScale = 1;

    for (const event of events) {
      const timer = setTimeout(() => {
        const component = state.components.get(event.componentId);
        component?.element?.classList.toggle('on', visibleLedEventValue(event, electrical));
      }, Math.max(0, (event.timeUs - firstTimeUs) / 1000 * timeScale));

      ledAnimationTimers.push(timer);
    }
  }

  function visibleLedEventValue(event, electrical = {}) {
    if (event.value !== true) {
      return false;
    }

    const reading = electrical.componentReadings?.get?.(event.componentId);
    const diagnostics = electrical.diagnostics ?? [];
    const hasElectricalProblem = diagnostics.some((diagnostic) => String(diagnostic).includes(`${event.componentId}:`)
      || String(diagnostic).includes(`${event.componentId}/`));

    return !(hasElectricalProblem && !['on', 'overcurrent'].includes(reading?.state));
  }

  function clearLedAnimation() {
    for (const timer of ledAnimationTimers) {
      clearTimeout(timer);
    }

    ledAnimationTimers = [];
  }

  function scheduleNextSimulationFrame(result) {
    if (!state.running) {
      return;
    }

    const frameTimeUs = Math.max(0, result.timeUs - previousFrameTimeUs);
    previousFrameTimeUs = result.timeUs;

    const delayMs = Math.max(16, frameTimeUs / 1000);
    simulationTimer = setTimeout(runSimulationFrame, delayMs);
  }

  function stopSimulationTimer() {
    if (simulationTimer) {
      clearTimeout(simulationTimer);
      simulationTimer = null;
    }
  }

  function renderConsole(result) {
    return [
      'Kernel de simulação executado',
      'Firmware: WASM compilado',
      `Tempo virtual: ${result.timeUs} us`,
      `Serial: ${result.serial.events.length} evento(s), baud ${result.serial.baudRate ?? 'nao iniciado'}`,
      `Canais ambientais: ${result.environment.length}`
    ].join('\n');
  }

  async function runWasmSimulationFrame({ firmwareWasm, serialRx }) {
    if (!wasmSimulationSession) {
      if (firmwareWasm.multi) {
        wasmSimulationSession = await createProjectMultiWasmSimulationSession({
          state,
          nets: getNets(),
          terminalKind,
          wasmByComponentId: firmwareWasm.byComponentId,
          wasmDiagnosticsByComponentId: firmwareWasm.diagnosticsByComponentId,
          serialRx,
          network: state.network ?? {}
        });
        return wasmSimulationSession.runFrame();
      }

      wasmSimulationSession = await createProjectWasmSimulationSession({
        state,
        nets: getNets(),
        terminalKind,
        wasmBase64: firmwareWasm.wasmBase64,
        wasmDiagnostics: firmwareWasm.diagnostics ?? [],
        serialRx,
        network: state.network ?? {}
      });
      return wasmSimulationSession.runFrame();
    }

    return wasmSimulationSession.runFrame({ serialRx });
  }

  async function compileMultiFirmwareWasm(sourcesByComponentId) {
    const cacheKey = JSON.stringify([...sourcesByComponentId.entries()]);

    if (multiFirmwareWasmCache?.cacheKey === cacheKey) {
      return multiFirmwareWasmCache.result;
    }

    const byComponentId = new Map();
    const diagnosticsByComponentId = new Map();
    let ok = true;

    for (const [componentId, code] of sourcesByComponentId) {
      const component = state.components.get(componentId);
      const result = await compileFirmwareWasmWithBackend(code, {
        constants: firmwareConstantsForBoard(component)
      });

      byComponentId.set(componentId, result);
      diagnosticsByComponentId.set(componentId, result.diagnostics ?? []);
      ok = ok && result.ok === true;
    }

    const result = {
      multi: true,
      ok,
      byComponentId,
      diagnosticsByComponentId,
      diagnostics: [...diagnosticsByComponentId.entries()].flatMap(([componentId, diagnostics]) => {
        return diagnostics.map((diagnostic) => ({
          ...diagnostic,
          message: `${componentId}: ${diagnostic.message}`
        }));
      })
    };

    multiFirmwareWasmCache = { cacheKey, result };
    return result;
  }

  function firmwareSourcesByComponent() {
    const firmwares = state.firmwares instanceof Map
      ? state.firmwares
      : new Map(Object.entries(state.firmwares ?? {}));

    if (firmwares.size === 0) {
      return new Map();
    }

    const sources = new Map();
    for (const component of state.components.values()) {
      if (component.behavior?.type !== 'microcontroller') {
        continue;
      }

      const firmware = firmwares.get(component.id);
      const code = component.id === state.activeFirmwareComponentId
        ? codeEditor.value
        : firmwareCodeOrEmpty(firmware);

      sources.set(component.id, code);
    }

    return sources;
  }

  function firmwareCodeOrEmpty(firmware) {
    return normalizeProjectCode(firmware?.files?.[firmware.entry] ?? '');
  }

  function firmwareConstantsForBoard(component = null) {
    const led = component
      ? component.behavior?.builtInLeds?.find((item) => Number.isInteger(item.pin))
      : firstProgrammableBuiltInLed();

    return Number.isInteger(led?.pin)
      ? { LED_BUILTIN: led.pin }
      : {};
  }

  function firstProgrammableBuiltInLed() {
    for (const component of state.components.values()) {
      const led = component.behavior?.builtInLeds?.find((item) => Number.isInteger(item.pin));

      if (led) {
        return led;
      }
    }

    return null;
  }

  function firstMicrocontroller() {
    return [...state.components.values()].find((component) => component.behavior?.type === 'microcontroller') ?? null;
  }

  return {
    runSimulation,
    pauseSimulation,
    resetSimulation,
    updateDistanceValue,
    updateRainValue,
    updateLightValue,
    updateClimateValue,
    updateAnalogVoltageValue,
    updateDigitalInputValue
  };
}
