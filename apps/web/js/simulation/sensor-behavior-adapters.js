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
  registry.register('buzzer', bindBuzzers);
  registry.register('water-pump', bindWaterPumpSystems);
  registry.register('lcd-16x2-i2c', bindLcd16x2Displays);
  registry.register('seven-segment-display', bindSevenSegmentDisplays);
  registry.register('shift-register-74hc595', bindShiftRegisters74hc595);
  registry.register('dht-sensor', bindDhtSensors);
  registry.register('servo-motor', bindServoMotors);
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

export function applyBuzzerStates({ runtime, buzzerBindings }) {
  for (const binding of buzzerBindings ?? []) {
    const pinState = runtime.getPin(binding.pin);
    const pinValue = pinState.value;
    const active = binding.activeHigh ? pinValue === 'HIGH' : pinValue === 'LOW';
    const frequencyHz = Number(pinState.frequencyHz);

    binding.buzzer.properties[binding.activeProperty] = active;
    binding.buzzer.properties[binding.inputLevelProperty] = pinValue === 'HIGH' ? 1 : 0;

    if (active && Number.isFinite(frequencyHz) && frequencyHz > 0) {
      binding.buzzer.properties.frequencyHz = frequencyHz;
    }
  }
}

export function applySevenSegmentStates({ runtime, sevenSegmentBindings }) {
  for (const binding of sevenSegmentBindings ?? []) {
    const commonType = binding.display.properties[binding.commonTypeProperty] ?? 'cathode';

    for (const segment of binding.segments) {
      const pinValue = segmentDigitalValue({ graph: binding.graph, runtime, display: binding.display, segment });
      const active = commonType === 'anode'
        ? binding.hasPowerCommon && pinValue === 'LOW'
        : binding.hasGroundCommon && pinValue === 'HIGH';

      binding.display.properties[segment.property] = active;
    }
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

export function bindBmp280Sensors({ graph, environment, runtime, diagnostics, components }) {
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

export function bindLcd16x2Displays({ graph, runtime, diagnostics, components }) {
  for (const display of components) {
    const address = Number(display.properties[display.behavior?.addressProperty] ?? 39);

    if (!resolveI2cBusConnected(graph, display)) {
      diagnostics.push(`${display.id}: SDA/SCL não estão ligados a um barramento I2C conhecido.`);
      continue;
    }

    runtime.registerI2cDevice(address, {
      type: 'lcd-16x2-i2c',
      componentId: display.id,
      component: display,
      columns: Number(display.properties[display.behavior?.columnsProperty] ?? 16),
      rows: Number(display.properties[display.behavior?.rowsProperty] ?? 2),
      cursorColumn: 0,
      cursorRow: 0,
      backlight: display.properties[display.behavior?.backlightProperty] !== false,
      backlightProperty: display.behavior?.backlightProperty ?? 'backlight',
      lineProperties: display.behavior?.lineProperties ?? ['line1', 'line2'],
      readBytes(count) {
        return new Array(Math.max(0, Number(count) || 0)).fill(0);
      }
    });
    runtime.lcdBegin(address, display.properties[display.behavior?.columnsProperty] ?? 16, display.properties[display.behavior?.rowsProperty] ?? 2);
  }
}

function bindSevenSegmentDisplays({ graph, runtime, diagnostics, components }) {
  const sevenSegmentBindings = [];

  for (const display of components) {
    const segmentTerminals = display.behavior?.segmentTerminals ?? {};
    const segments = Object.entries(segmentTerminals).map(([terminalId, property]) => ({
      terminalId,
      property,
      pin: resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, {
        componentId: display.id,
        terminalId
      }),
      connected: Boolean(graph.findTerminalNet(display.id, terminalId))
    }));
    const connectedSegments = segments.filter((segment) => Number.isInteger(segment.pin));

    if (connectedSegments.length === 0 && !segments.some((segment) => segment.connected)) {
      diagnostics.push(`${display.id}: nenhum segmento ligado a pino digital de microcontrolador.`);
      continue;
    }

    sevenSegmentBindings.push({
      display,
      graph,
      segments,
      commonTypeProperty: display.behavior?.commonTypeProperty ?? 'commonType',
      hasGroundCommon: hasCommonRail(graph, display, 'ground'),
      hasPowerCommon: hasCommonRail(graph, display, 'power')
    });
  }

  applySevenSegmentStates({ runtime, sevenSegmentBindings });
  return { sevenSegmentBindings };
}

function bindShiftRegisters74hc595({ graph, components }) {
  for (const shiftRegister of components) {
    const state = {
      data: 'LOW',
      clock: 'LOW',
      latch: 'LOW',
      outputEnable: terminalNetHasKind(graph, { componentId: shiftRegister.id, terminalId: shiftRegister.behavior?.outputEnableTerminal ?? 'oe' }, 'ground') ? 'LOW' : 'HIGH',
      masterReset: terminalNetHasKind(graph, { componentId: shiftRegister.id, terminalId: shiftRegister.behavior?.masterResetTerminal ?? 'mr' }, 'ground') ? 'LOW' : 'HIGH'
    };

    syncShiftRegisterOutputs({ graph, shiftRegister, state });

    graph.onTerminalDriven((terminal, value) => {
      if (terminal.componentId !== shiftRegister.id) {
        return;
      }

      handleShiftRegisterTerminal({ graph, shiftRegister, state, terminalId: terminal.terminalId, value });
    });
  }
}

export function bindDhtSensors({ graph, environment, runtime, diagnostics, components }) {
  const climateSources = graph.findComponentsByBehaviorChannel('climate');

  for (const sensor of components) {
    const dataTerminal = sensor.behavior?.dataTerminal ?? 'data';
    const pin = resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, {
      componentId: sensor.id,
      terminalId: dataTerminal
    });
    const climateSource = climateSourceForSensor({ graph, climateSources, sensor });
    const dhtType = sensor.behavior?.model === 'DHT11' ? 11 : 22;

    if (!Number.isInteger(pin)) {
      diagnostics.push(`${sensor.id}: DATA não está ligado a pino digital de microcontrolador.`);
      continue;
    }

    if (!climateSource) {
      diagnostics.push(`${sensor.id}: nenhum controle de clima/umidade disponível.`);
      continue;
    }

    runtime.registerDhtSensor(pin, {
      type: dhtType,
      componentId: sensor.id,
      readTemperature() {
        const climate = normalizeEnvironmentValue('climate', environment.read(`${climateSource.id}.climate`));
        const value = climate.enabled ? climate.temperatureC : 0;
        sensor.properties[sensor.behavior?.temperatureProperty ?? 'temperatureCelsius'] = value;
        return value;
      },
      readHumidity() {
        const climate = normalizeEnvironmentValue('climate', environment.read(`${climateSource.id}.climate`));
        const value = climate.enabled ? climate.humidityPercent : 0;
        sensor.properties[sensor.behavior?.humidityProperty ?? 'humidityPercent'] = value;
        return value;
      }
    });
  }
}

export function bindServoMotors({ graph, runtime, diagnostics, components }) {
  for (const servo of components) {
    const inputTerminal = servo.behavior?.inputTerminal ?? 'sig';
    const pin = resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, {
      componentId: servo.id,
      terminalId: inputTerminal
    });

    if (!Number.isInteger(pin)) {
      diagnostics.push(`${servo.id}: SIG não está ligado a pino digital/PWM de microcontrolador.`);
      continue;
    }

    runtime.registerServoMotor(pin, {
      component: servo,
      angleProperty: servo.behavior?.angleProperty ?? 'angleDegrees',
      attachedProperty: servo.behavior?.attachedProperty ?? 'attached',
      minPulseProperty: servo.behavior?.minPulseProperty ?? 'minPulseUs',
      maxPulseProperty: servo.behavior?.maxPulseProperty ?? 'maxPulseUs'
    });
  }
}

export function bindI2cAdcConverters({ graph, environment, runtime, diagnostics, components }) {
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

export function bindSpiAdcConverters({ graph, environment, runtime, diagnostics, components }) {
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

export function bindBuzzers({ graph, runtime, diagnostics, components }) {
  const buzzerBindings = [];

  for (const buzzer of components) {
    const inputTerminal = buzzer.behavior?.inputTerminal ?? 'sig';
    const pin = resolveRuntimeDigitalPinConnectedToTerminal(graph, runtime, {
      componentId: buzzer.id,
      terminalId: inputTerminal
    });

    if (!Number.isInteger(pin)) {
      diagnostics.push(`${buzzer.id}: SIG não está ligado a pino digital de microcontrolador.`);
      continue;
    }

    buzzerBindings.push({
      buzzer,
      pin,
      activeHigh: buzzer.properties[buzzer.behavior?.activeHighProperty ?? 'activeHigh'] !== false,
      activeProperty: buzzer.behavior?.activeProperty ?? 'active',
      inputLevelProperty: buzzer.behavior?.inputLevelProperty ?? 'inputLevel'
    });
  }

  applyBuzzerStates({ runtime, buzzerBindings });
  return { buzzerBindings };
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

function hasCommonRail(graph, component, kind) {
  return (component.behavior?.commonTerminals ?? []).some((terminalId) => {
    return terminalNetHasKind(graph, { componentId: component.id, terminalId }, kind);
  });
}

function pinValueFromTerminalSignal(graph, component, terminalId) {
  return graph.terminalSignal?.(component.id, terminalId) ?? 'LOW';
}

function segmentDigitalValue({ graph, runtime, display, segment }) {
  if (Number.isInteger(segment.pin)) {
    return runtime.getPin(segment.pin).value;
  }

  return pinValueFromTerminalSignal(graph, display, segment.terminalId);
}

function handleShiftRegisterTerminal({ graph, shiftRegister, state, terminalId, value }) {
  const behavior = shiftRegister.behavior ?? {};
  const dataTerminal = behavior.dataTerminal ?? 'ds';
  const clockTerminal = behavior.clockTerminal ?? 'shcp';
  const latchTerminal = behavior.latchTerminal ?? 'stcp';
  const outputEnableTerminal = behavior.outputEnableTerminal ?? 'oe';
  const masterResetTerminal = behavior.masterResetTerminal ?? 'mr';

  if (terminalId === dataTerminal) {
    state.data = value;
  }

  if (terminalId === outputEnableTerminal) {
    state.outputEnable = value;
    syncShiftRegisterOutputs({ graph, shiftRegister, state });
  }

  if (terminalId === masterResetTerminal) {
    state.masterReset = value;
    if (shiftRegister.properties[behavior.clearActiveLowProperty ?? 'clearActiveLow'] !== false && value === 'LOW') {
      shiftRegister.properties[behavior.shiftValueProperty ?? 'shiftValue'] = 0;
      shiftRegister.properties[behavior.latchedValueProperty ?? 'latchedValue'] = 0;
      syncShiftRegisterOutputs({ graph, shiftRegister, state });
    }
  }

  if (terminalId === clockTerminal) {
    const rising = state.clock !== 'HIGH' && value === 'HIGH';
    state.clock = value;

    if (rising) {
      const previousValue = Number(shiftRegister.properties[behavior.shiftValueProperty ?? 'shiftValue']) & 0xff;
      const shiftedOut = previousValue & 0x80 ? 'HIGH' : 'LOW';

      shiftRegister.properties[behavior.shiftValueProperty ?? 'shiftValue'] = ((previousValue << 1) & 0xff) | (state.data === 'HIGH' ? 1 : 0);
      graph.driveComponentTerminal?.(shiftRegister.id, behavior.serialOutTerminal ?? 'q7s', shiftedOut);
    }
  }

  if (terminalId === latchTerminal) {
    const rising = state.latch !== 'HIGH' && value === 'HIGH';
    state.latch = value;

    if (rising) {
      shiftRegister.properties[behavior.latchedValueProperty ?? 'latchedValue'] = Number(shiftRegister.properties[behavior.shiftValueProperty ?? 'shiftValue']) & 0xff;
      syncShiftRegisterOutputs({ graph, shiftRegister, state });
    }
  }
}

function syncShiftRegisterOutputs({ graph, shiftRegister, state }) {
  const behavior = shiftRegister.behavior ?? {};
  const outputTerminals = behavior.outputTerminals ?? ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
  const outputEnabled = state.outputEnable === 'LOW';
  const resetActive = shiftRegister.properties[behavior.clearActiveLowProperty ?? 'clearActiveLow'] !== false && state.masterReset === 'LOW';
  const value = resetActive ? 0 : Number(shiftRegister.properties[behavior.latchedValueProperty ?? 'latchedValue']) & 0xff;

  shiftRegister.properties[behavior.outputEnabledProperty ?? 'outputEnabled'] = outputEnabled;

  for (const [index, terminalId] of outputTerminals.entries()) {
    const active = outputEnabled && Boolean(value & (1 << index));
    shiftRegister.properties[terminalId] = active;
    graph.driveComponentTerminal?.(shiftRegister.id, terminalId, active ? 'HIGH' : 'LOW');
  }
}

function climateSourceForSensor({ graph, climateSources, sensor }) {
  return climateSources.find((source) => {
    return graph.areConnected(
      { componentId: source.id, terminalId: source.behavior?.channel ?? 'climate' },
      { componentId: sensor.id, terminalId: sensor.behavior?.environmentTerminal ?? 'env' }
    );
  }) ?? climateSources[0] ?? null;
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
