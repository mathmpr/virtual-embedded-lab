import { normalizeEnvironmentValue } from './environment-payload.js';
import { Hcsr04Behavior } from './hcsr04-behavior.js';
import {
  resolveAnalogPinConnectedToTerminal,
  resolveChipSelectPinConnectedToTerminal,
  resolveDigitalPinConnectedToTerminal,
  resolveI2cBusConnected,
  resolveSpiBusConnected
} from './pin-capability-resolver.js';

export function registerSensorBehaviorAdapters(registry) {
  registry.register('hcsr04-sensor', bindHcsr04Sensors);
  registry.register('rain-sensor', bindRainSensorAdapter);
  registry.register('light-sensor', bindLightSensorAdapter);
  registry.register('bmp280-sensor', bindBmp280Sensors);
  registry.register('adc-i2c', bindI2cAdcConverters);
  registry.register('adc-spi', bindSpiAdcConverters);
  registry.register('momentary-button', bindMomentaryButtons);
  registry.register('water-pump', bindWaterPumpSystems);
}

export function applyRainSensorInputs({ runtime, environment, rainBindings }) {
  for (const binding of rainBindings) {
    const rain = normalizeWetEnvironmentValue(environment.read(binding.channelId));
    const activeLow = binding.sensor.properties.activeLow !== false;
    const isWet = Boolean(rain?.active);
    const value = isWet
      ? activeLow ? 'LOW' : 'HIGH'
      : activeLow ? 'HIGH' : 'LOW';

    if (Number.isInteger(binding.digitalPin)) {
      runtime.driveInput(binding.digitalPin, value);
    }

    if (Number.isInteger(binding.analogPin)) {
      const wetRaw = Number(binding.sensor.properties[binding.sensor.behavior?.wetAnalogProperty] ?? 300);
      const dryRaw = Number(binding.sensor.properties[binding.sensor.behavior?.dryAnalogProperty] ?? 900);
      const analogRaw = isWet ? wetRaw : dryRaw;
      runtime.driveAnalogInput(binding.analogPin, analogRaw, {
        maxRaw: Number(binding.sensor.behavior?.analogMaxRaw ?? 1023),
        sourceComponentId: binding.sensor.id
      });
    }
  }
}

export function applyWaterPumpSystems({ runtime, environment, clock, waterBindings }) {
  for (const binding of waterBindings ?? []) {
    const relayInput = runtime.getPin(binding.relayInputPin).value;
    const relayActive = binding.activeHigh ? relayInput === 'HIGH' : relayInput === 'LOW';
    const nowUs = clock.nowUs();
    const elapsedHours = Math.max(0, nowUs - binding.lastUpdatedUs) / 3_600_000_000;
    const flowLiters = relayActive ? binding.flowLitersPerHour * elapsedHours : 0;
    const capacityLiters = Math.max(0, Number(binding.reservoir.properties.capacityLiters ?? 0));
    const currentLiters = Math.max(0, Math.min(capacityLiters, Number(binding.reservoir.properties.currentLiters ?? 0) + flowLiters));
    const overflowActive = capacityLiters > 0 && currentLiters >= capacityLiters && relayActive;

    binding.lastUpdatedUs = nowUs;
    binding.relay.properties.active = relayActive;
    binding.relay.properties.inputLevel = relayInput === 'HIGH' ? 1 : 0;
    binding.pump.properties.enabled = relayActive;
    binding.reservoir.properties.currentLiters = Number(currentLiters.toFixed(3));
    binding.reservoir.properties.overflowActive = overflowActive;

    environment.write(`${binding.reservoir.id}.water`, normalizeEnvironmentValue('water', {
      active: overflowActive,
      currentLiters,
      capacityLiters
    }));
  }
}

export function applyLightSensorInputs({ runtime, environment, lightBindings }) {
  for (const binding of lightBindings) {
    const light = normalizeEnvironmentValue('light', environment.read(binding.channelId));
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

export function applyButtonInputs({ runtime, buttonBindings }) {
  for (const binding of buttonBindings) {
    const activeHigh = binding.button.properties[binding.activeHighProperty] !== false;
    const pressed = Boolean(binding.button.properties[binding.activeProperty]);
    const value = pressed
      ? activeHigh ? 'HIGH' : 'LOW'
      : activeHigh ? 'LOW' : 'HIGH';

    runtime.driveInput(binding.pin, value);
  }
}

function bindHcsr04Sensors({ graph, environment, runtime, clock, scheduler, program, diagnostics, components }) {
  const arduino = graph.findComponentsByBehaviorType('microcontroller')[0];

  for (const sensor of components) {
    const sensorBehavior = sensor.behavior ?? {};
    const triggerTerminal = sensorBehavior.triggerTerminal ?? 'trigger';
    const distanceSource = graph.findComponentsByBehaviorChannel(sensorBehavior.environmentChannel ?? 'distance').find((distanceControl) => {
      return graph.areConnected(
        { componentId: distanceControl.id, terminalId: distanceControl.behavior?.outputTerminal ?? distanceControl.behavior?.channel ?? 'distance' },
        { componentId: sensor.id, terminalId: triggerTerminal }
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
      const isSensorTriggerTerminal = terminal.componentId === sensor.id && terminal.terminalId === triggerTerminal;

      if (isSensorTriggerTerminal) {
        behavior.onTrigger(value);
      }
    });
  }
}

function bindBmp280Sensors({ graph, environment, runtime, diagnostics, components }) {
  const climateSources = graph.findComponentsByBehaviorChannel('climate');

  for (const sensor of components) {
    const source = climateSources[0] ?? null;
    const address = Number(sensor.properties[sensor.behavior?.addressProperty] ?? 118);

    if (!source) {
      diagnostics.push(`${sensor.id}: nenhum controle de clima disponível.`);
      continue;
    }

    if (!resolveI2cBusConnected(graph, sensor)) {
      diagnostics.push(`${sensor.id}: SDA/SCL não estão ligados a um barramento I2C conhecido.`);
      continue;
    }

    runtime.registerI2cDevice(address, {
      type: 'bmp280',
      componentId: sensor.id,
      readTemperature() {
        const climate = normalizeEnvironmentValue('climate', environment.read(`${source.id}.climate`));
        return climate.enabled ? climate.temperatureC + Number(sensor.properties[sensor.behavior?.temperatureOffsetProperty] ?? 0) : 0;
      },
      readPressure() {
        const climate = normalizeEnvironmentValue('climate', environment.read(`${source.id}.climate`));
        return climate.enabled ? (climate.pressureHpa + Number(sensor.properties[sensor.behavior?.pressureOffsetProperty] ?? 0)) * 100 : 0;
      },
      readBytes(count) {
        return new Array(Math.max(0, Number(count) || 0)).fill(0);
      }
    });
  }
}

function bindI2cAdcConverters({ graph, environment, runtime, diagnostics, components }) {
  for (const adc of components) {
    const model = adc.behavior?.model;
    const maxRaw = Number(adc.behavior?.maxRaw ?? (adc.electricalModel?.resolutionBits === 12 ? 2047 : 32767));
    const inputTerminal = adc.behavior?.inputTerminals?.[0] ?? 'a0';
    const source = analogSourceForTerminal(graph, { componentId: adc.id, terminalId: inputTerminal });

    if (!source) {
      diagnostics.push(`${adc.id}: canal A0 sem fonte analógica.`);
      continue;
    }

    if (!resolveI2cBusConnected(graph, adc)) {
      diagnostics.push(`${adc.id}: SDA/SCL não estão ligados a um barramento I2C conhecido.`);
      continue;
    }

    runtime.registerI2cDevice(Number(adc.properties[adc.behavior?.addressProperty] ?? 72), {
      type: model,
      componentId: adc.id,
      readChannel(channel) {
        return channel === 0 ? externalAdcRaw({
          voltage: analogVoltage(environment, source.id),
          maxRaw,
          fullScaleVolts: gainToFullScaleVolts(adc.properties[adc.behavior?.gainProperty])
        }) : 0;
      },
      computeVolts(raw) {
        return clamp(Number(raw) / maxRaw, 0, 1) * gainToFullScaleVolts(adc.properties[adc.behavior?.gainProperty]);
      },
      readBytes(count) {
        return new Array(Math.max(0, Number(count) || 0)).fill(0);
      }
    });
  }
}

function bindSpiAdcConverters({ graph, environment, runtime, diagnostics, components }) {
  for (const adc of components) {
    const inputTerminal = adc.behavior?.inputTerminals?.[0] ?? 'ch0';
    const source = analogSourceForTerminal(graph, { componentId: adc.id, terminalId: inputTerminal });
    const chipSelectTerminal = adc.behavior?.chipSelectTerminal ?? 'cs';
    const chipSelectPin = resolveChipSelectPinConnectedToTerminal(graph, { componentId: adc.id, terminalId: chipSelectTerminal });

    if (!source) {
      diagnostics.push(`${adc.id}: canal CH0 sem fonte analógica.`);
      continue;
    }

    if (!Number.isInteger(chipSelectPin)) {
      diagnostics.push(`${adc.id}: CS não está ligado a um pino com capacidade SPI CS/digital.`);
      continue;
    }

    if (!resolveSpiBusConnected(graph, adc)) {
      diagnostics.push(`${adc.id}: CLK/DOUT/DIN não estão ligados a um barramento SPI conhecido.`);
      continue;
    }

    runtime.registerSpiDevice(chipSelectPin, {
      type: 'mcp3008',
      componentId: adc.id,
      readChannel(channel) {
        return channel === 0 ? externalAdcRaw({
          voltage: analogVoltage(environment, source.id),
          maxRaw: Number(adc.behavior?.maxRaw ?? 1023),
          fullScaleVolts: Number(adc.properties[adc.behavior?.referenceVoltageProperty] ?? 5)
        }) : 0;
      }
    });
  }
}

function bindRainSensorAdapter({ graph, environment, runtime, diagnostics, components }) {
  const rainBindings = [];
  const rainSources = [
    ...graph.findComponentsByBehaviorChannel('rain'),
    ...graph.findComponentsByBehaviorChannel('water')
  ];

  for (const sensor of components) {
    const digitalTerminal = sensor.behavior?.digitalOutputTerminal ?? 'do';
    const analogTerminal = sensor.behavior?.analogOutputTerminal ?? 'ao';
    const digitalPin = resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, { componentId: sensor.id, terminalId: digitalTerminal });
    const analogPin = resolveRuntimeAnalogPinConnectedToTerminal(graph, runtime, { componentId: sensor.id, terminalId: analogTerminal });
    const rainSource = rainSourceForSensor({ graph, rainSources, sensor });

    if (!Number.isInteger(digitalPin) && !Number.isInteger(analogPin)) {
      diagnostics.push(`${sensor.id}: DO/AO não está ligado a pino digital ou analógico de microcontrolador.`);
      continue;
    }

    if (!rainSource) {
      diagnostics.push(`${sensor.id}: nenhum controle de chuva disponível.`);
      continue;
    }

    rainBindings.push({
      sensor,
      digitalPin,
      analogPin,
      channelId: `${rainSource.id}.${rainSource.behavior?.channel ?? 'rain'}`
    });
  }

  applyRainSensorInputs({ runtime, environment, rainBindings });
  return { rainBindings };
}

function bindWaterPumpSystems({ graph, runtime, environment, clock, diagnostics, components }) {
  const waterBindings = [];

  for (const pump of components) {
    const relay = relayForPump(graph, pump);
    const reservoir = reservoirForPump(graph, pump);

    if (!relay) {
      diagnostics.push(`${pump.id}: nenhum SSR conectado à bomba.`);
      continue;
    }

    if (!reservoir) {
      diagnostics.push(`${pump.id}: nenhum reservatório conectado à saída de água.`);
      continue;
    }

    const relayInputPin = resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, {
      componentId: relay.id,
      terminalId: relay.behavior?.inputTerminal ?? 'in'
    });

    if (!Number.isInteger(relayInputPin)) {
      continue;
    }

    waterBindings.push({
      pump,
      relay,
      reservoir,
      relayInputPin,
      activeHigh: relay.properties[relay.behavior?.activeHighProperty ?? 'activeHigh'] !== false,
      flowLitersPerHour: Number(pump.properties[pump.behavior?.flowProperty ?? 'flowLitersPerHour'] ?? 0),
      lastUpdatedUs: runtime.clock.nowUs()
    });
  }

  return { waterBindings };
}

function bindLightSensorAdapter({ graph, environment, runtime, diagnostics, components }) {
  const lightBindings = [];
  const lightSources = graph.findComponentsByBehaviorChannel('light');

  for (const sensor of components) {
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

    lightBindings.push({
      sensor,
      channelId: `${source.id}.light`,
      ...divider
    });
  }

  applyLightSensorInputs({ runtime, environment, lightBindings });
  return { lightBindings };
}

function bindMomentaryButtons({ graph, runtime, diagnostics, components }) {
  const buttonBindings = [];

  for (const button of components) {
    const outputTerminal = button.behavior?.outputTerminal ?? 'out';
    const pin = resolveDigitalPinConnectedToTerminal(graph, { componentId: button.id, terminalId: outputTerminal });

    if (!Number.isInteger(pin)) {
      diagnostics.push(`${button.id}: OUT não está ligado a um pino digital do Arduino.`);
      continue;
    }

    buttonBindings.push({
      button,
      pin,
      activeProperty: button.behavior?.activeProperty ?? 'pressed',
      activeHighProperty: button.behavior?.activeHighProperty ?? 'activeHigh'
    });
  }

  applyButtonInputs({ runtime, buttonBindings });
  return { buttonBindings };
}

function rainSourceForSensor({ graph, rainSources, sensor }) {
  const terminals = [
    sensor.behavior?.digitalOutputTerminal ?? 'do',
    sensor.behavior?.analogOutputTerminal ?? 'ao',
    sensor.behavior?.environmentTerminal ?? null
  ].filter(Boolean);

  return rainSources.find((source) => {
    const sourceTerminal = source.behavior?.outputTerminal ?? source.behavior?.channel ?? source.behavior?.waterTerminal ?? 'rain';
    return terminals.some((terminalId) => graph.areConnected(
      { componentId: source.id, terminalId: sourceTerminal },
      { componentId: sensor.id, terminalId }
    ));
  }) ?? rainSources[0] ?? null;
}

function reservoirForPump(graph, pump) {
  const outletTerminal = pump.behavior?.outletTerminal ?? 'outlet';
  const reservoirs = graph.findComponentsByBehaviorType('water-reservoir');

  return reservoirs.find((reservoir) => {
    return graph.areConnected(
      { componentId: pump.id, terminalId: outletTerminal },
      { componentId: reservoir.id, terminalId: reservoir.behavior?.waterTerminal ?? 'water' }
    );
  }) ?? null;
}

function relayForPump(graph, pump) {
  const relays = graph.findComponentsByBehaviorType('solid-state-relay');

  return relays.find((relay) => {
    return graph.areConnected(
      { componentId: relay.id, terminalId: relay.behavior?.loadOutTerminal ?? 'loadOut' },
      { componentId: pump.id, terminalId: pump.behavior?.powerTerminal ?? 'vin' }
    ) || graph.areConnected(
      { componentId: relay.id, terminalId: relay.behavior?.loadInTerminal ?? 'loadIn' },
      { componentId: pump.id, terminalId: pump.behavior?.powerTerminal ?? 'vin' }
    );
  }) ?? null;
}

function resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, terminal) {
  const pin = resolveRuntimePinConnectedToTerminal(graph, runtime, terminal, 'digital', 'number');
  return runtime.componentId ? pin : pin ?? resolveDigitalPinConnectedToTerminal(graph, terminal);
}

function resolveRuntimeAnalogPinConnectedToTerminal(graph, runtime, terminal) {
  const pin = resolveRuntimePinConnectedToTerminal(graph, runtime, terminal, 'analog', 'analogNumber');
  return runtime.componentId ? pin : pin ?? resolveAnalogPinConnectedToTerminal(graph, terminal);
}

function resolveRuntimePinConnectedToTerminal(graph, runtime, terminal, capability, numberField) {
  if (!runtime.componentId) {
    return null;
  }

  const board = graph.components.get(runtime.componentId);
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!board || !net) {
    return null;
  }

  for (const netTerminal of net.terminals) {
    if (netTerminal.componentId !== board.id) {
      continue;
    }

    const pin = board.behavior?.pinMap?.[netTerminal.terminalId];

    if (!pin?.capabilities?.includes(capability)) {
      continue;
    }

    if (Number.isInteger(pin[numberField])) {
      return pin[numberField];
    }

    if (numberField === 'analogNumber' && Number.isInteger(pin.number)) {
      return pin.number;
    }
  }

  return null;
}

function normalizeWetEnvironmentValue(value) {
  if (value?.capacityLiters !== undefined || value?.currentLiters !== undefined) {
    return normalizeEnvironmentValue('water', value);
  }

  return normalizeEnvironmentValue('rain', value);
}

function analogSourceForTerminal(graph, terminal) {
  return graph.findComponentsByBehaviorType('analog-voltage-source').find((source) => {
    return graph.areConnected({ componentId: source.id, terminalId: source.behavior?.outputTerminal ?? 'out' }, terminal);
  }) ?? null;
}

function analogVoltage(environment, sourceId) {
  const value = normalizeEnvironmentValue('analog-voltage', environment.read(`${sourceId}.analog-voltage`));
  return value.enabled ? value.voltageVolts : 0;
}

function externalAdcRaw({ voltage, maxRaw, fullScaleVolts }) {
  return Math.round(clamp(Number(voltage) / Math.max(0.001, Number(fullScaleVolts)), 0, 1) * maxRaw);
}

function gainToFullScaleVolts(gain = '2.048V') {
  const parsed = Number(String(gain).replace('V', ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2.048;
}

function ldrVoltageDivider({ graph, sensor }) {
  const sides = [
    { ldrTerminalId: 'a', midpointTerminalId: 'b', side: 'power' },
    { ldrTerminalId: 'b', midpointTerminalId: 'a', side: 'ground' }
  ];

  for (const candidate of sides) {
    const pin = resolveAnalogPinConnectedToTerminal(graph, {
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

  for (const component of graph.findComponentsByElectricalPrimitive('resistor')) {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
