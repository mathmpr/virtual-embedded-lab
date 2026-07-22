import { createProjectWasmSimulationSession } from './simulation/simulation-engine.js';
import { analyzeFirmwareWithBackend, compileFirmwareWasmWithBackend } from './simulation/firmware-analysis-client.js';

export function createVisualSimulation({ state, renderSignals, renderSerial, renderProblems, consoleOutput, getNets, terminalKind, codeEditor, consumeSerialRx, clearSerialRx, appendSerialEvents, clearSerialHistory, onSimulationResult }) {
  let builtInLedAnimationTimers = [];
  let simulationTimer = null;
  let firmwareAnalysisCache = null;
  let firmwareWasmCache = null;
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
      const firmwareWasm = firmwareWasmCache ?? await compileFirmwareWasmWithBackend(codeEditor.value, {
        constants: firmwareConstantsForBoard()
      });
      firmwareWasmCache = firmwareWasm;

      if (firmwareAnalysis.available && firmwareAnalysis.ok === false) {
        state.running = false;
        renderProblems(firmwareAnalysis.diagnostics.map(formatDiagnostic));
        consoleOutput.textContent = 'Simulação bloqueada: Clang encontrou erro no firmware.';
        return;
      }

      if (firmwareWasm.ok !== true) {
        state.running = false;
        renderProblems((firmwareWasm.diagnostics ?? []).map(formatDiagnostic));
        consoleOutput.textContent = 'Simulação bloqueada: firmware WASM não foi compilado.';
        return;
      }

      const serialRx = consumeSerialRx();
      const result = await runWasmSimulationFrame({ firmwareWasm, serialRx });

      state.signals = result.signals;
      applyLedStates(result.ledStates);
      applyBuiltInLedStates(result.builtInLedStates);
      animateBuiltInLedEvents(result.builtInLedEvents);
      onSimulationResult(result);
      consoleOutput.textContent = renderConsole(result);
      renderSignals();
      appendSerialEvents(result.serial.events.filter((event) => event.direction !== 'RX'));
      renderProblems(result.diagnostics.length > 0 ? result.diagnostics : ['Nenhum problema crítico reportado pelo kernel.']);
      scheduleNextSimulationFrame(result);
    } catch (error) {
      state.running = false;
      renderProblems([`Falha de simulação: ${error.message}`]);
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
    clearBuiltInLedAnimation();
    consoleOutput.textContent += '\nSimulação pausada.';
  }

  function resetSimulation() {
    state.running = false;
    stopSimulationTimer();
    firmwareAnalysisCache = null;
    firmwareWasmCache = null;
    wasmSimulationSession = null;
    previousFrameTimeUs = 0;
    state.signals = { trig: 0, echo: 0, led: 0 };
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
    clearBuiltInLedAnimation();
    applyLedStates(new Map());
    applyBuiltInLedStates(new Map());
    onSimulationResult({ electrical: state.electrical });
    consoleOutput.textContent = 'Runtime pronto.';
    renderSignals();
    renderSerial();
    renderProblems(['Circuito ainda não simulado.']);
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
    clearBuiltInLedAnimation();

    if (events.length === 0) {
      return;
    }

    const firstTimeUs = events[0].timeUs;
    const timeScale = 0.12;

    for (const event of events) {
      const timer = setTimeout(() => {
        const indicator = document.querySelector(`[data-id="${event.componentId}"] [data-built-in-led="${event.ledId}"]`);
        indicator?.classList.toggle('on', event.value);
      }, Math.max(0, (event.timeUs - firstTimeUs) / 1000 * timeScale));

      builtInLedAnimationTimers.push(timer);
    }
  }

  function clearBuiltInLedAnimation() {
    for (const timer of builtInLedAnimationTimers) {
      clearTimeout(timer);
    }

    builtInLedAnimationTimers = [];
  }

  function scheduleNextSimulationFrame(result) {
    if (!state.running) {
      return;
    }

    const frameTimeUs = Math.max(0, result.timeUs - previousFrameTimeUs);
    previousFrameTimeUs = result.timeUs;

    const delayMs = Math.max(16, Math.min(1200, frameTimeUs / 1000 * 0.12 + 30));
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
      wasmSimulationSession = await createProjectWasmSimulationSession({
        state,
        nets: getNets(),
        terminalKind,
        wasmBase64: firmwareWasm.wasmBase64,
        wasmDiagnostics: firmwareWasm.diagnostics ?? [],
        serialRx
      });
      return wasmSimulationSession.runFrame();
    }

    return wasmSimulationSession.runFrame({ serialRx });
  }

  function firmwareConstantsForBoard() {
    const led = firstProgrammableBuiltInLed();

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

  return {
    runSimulation,
    pauseSimulation,
    resetSimulation,
    updateDistanceValue,
    updateRainValue,
    updateLightValue,
    updateClimateValue,
    updateAnalogVoltageValue
  };
}
