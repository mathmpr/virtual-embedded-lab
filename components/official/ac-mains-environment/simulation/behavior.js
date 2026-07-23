export function register(registry) {
  registry.register('ac-mains-environment', bindAcMainsEnvironments);
  registry.register('ac-voltage-sensor', bindAcVoltageSensors);
  registry.register('sct-current-transformer', bindSctCurrentTransformers);
}

function bindAcMainsEnvironments({ environment, components }) {
  for (const mains of components) {
    const value = mainsEnvironmentValue(mains);
    ensureChannel(environment, `${mains.id}.ac-mains`, value);
  }
}

function bindAcVoltageSensors({ graph, environment, components }) {
  const mains = firstAcMains(graph);

  for (const sensor of components) {
    const phase = normalizedPhase(sensor.properties.phase);
    const mainsValue = mainsEnvironmentValue(mains);
    const phaseVoltageVrms = phaseVoltage(mainsValue, phase, Number(sensor.properties.inputVoltageVrms ?? 127));
    const phaseDeg = (mainsValue.phaseOffsetsDeg[phase] ?? 0) + Number(sensor.properties.phaseShiftDeg ?? 0);
    const amplitudeV = Number(sensor.properties.outputPeakToPeakV ?? 2) / 2 * Number(sensor.properties.gain ?? 1);

    ensureChannel(environment, `${sensor.id}.analog-voltage`, {
      enabled: true,
      voltageVolts: Number(sensor.properties.adcBiasV ?? 1.65),
      source: 'ac-voltage',
      phase,
      phaseVoltageVrms,
      waveform: {
        type: 'sine',
        biasV: Number(sensor.properties.adcBiasV ?? 1.65),
        amplitudeV,
        frequencyHz: mainsValue.frequencyHz,
        phaseDeg,
        noisePercent: Number(sensor.properties.noisePercent ?? 0)
      }
    });
  }
}

function bindSctCurrentTransformers({ graph, environment, components }) {
  const mains = firstAcMains(graph);
  const mainsValue = mainsEnvironmentValue(mains);
  const phaseMetrics = loadMetricsByPhase(graph, mainsValue);

  for (const sensor of components) {
    const phase = normalizedPhase(sensor.properties.phase);
    const metrics = phaseMetrics[phase] ?? emptyPhaseMetrics(phase);
    const outputVrms = metrics.irms * Number(sensor.properties.outputVoltageVrmsAtRatedCurrent ?? 1) / Math.max(0.001, Number(sensor.properties.ratedCurrentA ?? 100));
    const orientationDeg = sensor.properties.orientation === 'inverted' ? 180 : 0;

    ensureChannel(environment, `${sensor.id}.analog-voltage`, {
      enabled: true,
      voltageVolts: Number(sensor.properties.adcBiasV ?? 1.65),
      source: 'ac-current',
      phase,
      currentRms: metrics.irms,
      activePowerW: metrics.realPowerW,
      apparentPowerVA: metrics.apparentPowerVA,
      powerFactor: metrics.powerFactor,
      waveform: {
        type: 'sine',
        biasV: Number(sensor.properties.adcBiasV ?? 1.65),
        amplitudeV: outputVrms * Math.SQRT2,
        frequencyHz: mainsValue.frequencyHz,
        phaseDeg: metrics.currentPhaseDeg + orientationDeg + Number(sensor.properties.phaseShiftDeg ?? 0),
        noisePercent: Number(sensor.properties.noisePercent ?? 0)
      }
    });
  }
}

function ensureChannel(environment, id, value) {
  try {
    environment.read(id);
    environment.write(id, value);
  } catch {
    environment.createChannel({ id, value });
  }
}

function firstAcMains(graph) {
  return graph.findComponentsByBehaviorType('ac-mains-environment')[0] ?? null;
}

function mainsEnvironmentValue(mains) {
  const properties = mains?.properties ?? {};
  const sag = clamp(Number(properties.voltageSagPercent ?? 0) / 100, 0, 0.95);

  return {
    frequencyHz: Number(properties.frequencyHz ?? 60),
    phaseNeutralVoltage: Number(properties.phaseNeutralVoltage ?? 127) * (1 - sag),
    phasePhaseVoltage: Number(properties.phasePhaseVoltage ?? 220) * (1 - sag),
    threePhaseVoltage: Number(properties.threePhaseVoltage ?? 380) * (1 - sag),
    phaseOffsetsDeg: {
      A: Number(properties.phaseAOffsetDeg ?? 0),
      B: Number(properties.phaseBOffsetDeg ?? -120),
      C: Number(properties.phaseCOffsetDeg ?? 120)
    },
    voltageNoisePercent: Number(properties.voltageNoisePercent ?? 0),
    voltageSagPercent: Number(properties.voltageSagPercent ?? 0)
  };
}

function loadMetricsByPhase(graph, mainsValue) {
  const metrics = {
    A: emptyPhaseMetrics('A'),
    B: emptyPhaseMetrics('B'),
    C: emptyPhaseMetrics('C')
  };

  for (const load of graph.findComponentsByBehaviorType('ac-load')) {
    if (load.properties.enabled === false) {
      continue;
    }

    for (const contribution of loadContributions(load, mainsValue)) {
      const target = metrics[contribution.phase];
      target.realPowerW += contribution.realPowerW;
      target.apparentPowerVA += contribution.apparentPowerVA;
    }
  }

  for (const phase of Object.keys(metrics)) {
    const item = metrics[phase];
    item.powerFactor = item.apparentPowerVA > 0 ? clamp(item.realPowerW / item.apparentPowerVA, -1, 1) : 0;
    item.irms = item.apparentPowerVA / Math.max(1, mainsValue.phaseNeutralVoltage);
    item.currentPhaseDeg = (mainsValue.phaseOffsetsDeg[phase] ?? 0) - radiansToDegrees(Math.acos(clamp(Math.abs(item.powerFactor), 0, 1)));
  }

  return metrics;
}

function loadContributions(load, mainsValue) {
  const connection = String(load.properties.connection ?? 'A_N').toUpperCase();
  const power = Number(load.properties.activePowerW ?? 0);
  const powerFactor = load.properties.loadType === 'resistive' ? 1 : clamp(Number(load.properties.powerFactor ?? 1), 0.1, 1);
  const apparentPowerVA = power / powerFactor;

  if (connection === 'A_B') {
    return [
      { phase: 'A', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 },
      { phase: 'B', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 }
    ];
  }

  if (connection === 'B_C') {
    return [
      { phase: 'B', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 },
      { phase: 'C', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 }
    ];
  }

  if (connection === 'C_A') {
    return [
      { phase: 'C', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 },
      { phase: 'A', realPowerW: power / 2, apparentPowerVA: apparentPowerVA / 2 }
    ];
  }

  return [{ phase: normalizedPhase(connection[0]), realPowerW: power, apparentPowerVA }];
}

function phaseVoltage(mainsValue, phase, fallback) {
  return Number.isFinite(mainsValue.phaseNeutralVoltage) ? mainsValue.phaseNeutralVoltage : fallback;
}

function emptyPhaseMetrics(phase) {
  return {
    phase,
    irms: 0,
    realPowerW: 0,
    apparentPowerVA: 0,
    powerFactor: 0,
    currentPhaseDeg: 0
  };
}

function normalizedPhase(value) {
  const phase = String(value ?? 'A').trim().toUpperCase()[0];
  return ['A', 'B', 'C'].includes(phase) ? phase : 'A';
}

function radiansToDegrees(radians) {
  return radians * 180 / Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
