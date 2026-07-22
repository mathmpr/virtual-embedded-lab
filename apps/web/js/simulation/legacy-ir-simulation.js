import {
  applyBoardConstants,
  bindSimulationInputs,
  createSimulationContext,
  finalizeSimulationResult
} from './simulation-engine.js';
import { compileArduinoFirmware, runArduinoFirmware } from './firmware-engine.js';

/**
 * Deprecated IR execution adapter.
 *
 * The web UI is WASM-only. Keep this module isolated for legacy regression tests
 * and temporary comparisons while the old JS IR is being removed/reclassified.
 */
export function runLegacyIrProjectSimulation({ state, nets, terminalKind, code, firmwareProgram = null, firmwareDiagnostics = [], serialRx = [] }) {
  const context = createSimulationContext({ state, nets, terminalKind, serialRx });
  const { graph, runtime, environment, clock, scheduler } = context;
  const firmware = firmwareProgram
    ? { program: firmwareProgram, diagnostics: [] }
    : compileArduinoFirmware(code);
  applyBoardConstants({ graph, program: firmware.program });
  const diagnostics = [
    ...formatFirmwareDiagnostics(firmwareDiagnostics),
    ...formatFirmwareDiagnostics(firmware.diagnostics)
  ];

  bindSimulationInputs({ graph, environment, runtime, clock, scheduler, program: firmware.program, diagnostics });

  const firmwareResult = runArduinoFirmware(runtime, firmware.program, { loopIterations: 3 });

  return finalizeSimulationResult({
    clock,
    graph,
    runtime,
    environment,
    firmwareResult,
    diagnostics,
    pins: firmware.program.pins,
    source: 'legacy-ir'
  });
}

function formatFirmwareDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => {
    const location = diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : '';
    return `[${diagnostic.severity}] ${diagnostic.source ?? 'firmware'}${location}: ${diagnostic.message}`;
  });
}
