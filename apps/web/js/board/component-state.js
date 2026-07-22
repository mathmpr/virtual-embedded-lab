export function createComponentState({
  state,
  componentDefinitions,
  simulation,
  renderSignals,
  recordHistory,
  syncInspectorPropertyControls
}) {
  function applyRainSensorStates() {
    const isWet = Boolean(state.signals.rain);

    for (const component of state.components.values()) {
      if (component.type !== 'fc37-rain-sensor') {
        continue;
      }

      component.element.classList.toggle('wet', isWet);
      const stateOutput = component.element.querySelector('[data-rain-sensor-state]');

      if (stateOutput) {
        stateOutput.textContent = isWet ? 'WET' : 'DRY';
      }
    }
  }

  function applyLdrSensorStates() {
    const raw = Math.round((state.signals.lightAnalog ?? 0) * 1023);
    const label = raw < 300 ? 'DARK' : raw < 700 ? 'DIM' : 'BRIGHT';

    for (const component of state.components.values()) {
      if (component.type !== 'ldr-light-sensor') {
        continue;
      }

      component.element.classList.toggle('dark', label === 'DARK');
      component.element.classList.toggle('dim', label === 'DIM');
      component.element.classList.toggle('bright', label === 'BRIGHT');
      const stateOutput = component.element.querySelector('[data-ldr-state]');

      if (stateOutput) {
        stateOutput.textContent = label;
      }
    }
  }

  function applyBmp280SensorStates() {
    const climate = firstClimateComponent();

    for (const component of state.components.values()) {
      if (component.type !== 'bmp280-sensor') {
        continue;
      }

      const enabled = Boolean(climate?.properties.enabled ?? false);
      const temperature = enabled
        ? Number(climate.properties.temperatureC ?? 25) + Number(component.properties.temperatureOffsetC ?? 0)
        : 0;
      const pressure = enabled
        ? Number(climate.properties.pressureHpa ?? 1013.25) + Number(component.properties.pressureOffsetHpa ?? 0)
        : 0;

      component.element.classList.toggle('online', enabled);
      component.element.classList.toggle('offline', !enabled);
      const stateOutput = component.element.querySelector('[data-bmp280-state]');
      const temperatureOutput = component.element.querySelector('[data-bmp280-temp]');
      const pressureOutput = component.element.querySelector('[data-bmp280-pressure]');

      if (stateOutput) {
        stateOutput.textContent = enabled ? `0x${Number(component.properties.i2cAddress).toString(16).toUpperCase()}` : 'OFF';
      }

      if (temperatureOutput) {
        temperatureOutput.textContent = `${temperature.toFixed(1)} °C`;
      }

      if (pressureOutput) {
        pressureOutput.textContent = `${pressure.toFixed(0)} hPa`;
      }
    }
  }

  function applyAdcStates() {
    for (const component of state.components.values()) {
      if (!isAdcComponent(component)) {
        continue;
      }

      const source = firstAnalogSourceComponent();
      const voltage = source?.properties.enabled ? Number(source.properties.voltageVolts ?? 0) : 0;
      const raw = adcRawForComponent(component, voltage);

      component.element.classList.toggle('online', Boolean(source?.properties.enabled));
      const stateOutput = component.element.querySelector('[data-adc-state]');
      const rawOutput = component.element.querySelector('[data-adc-raw]');
      const voltageOutput = component.element.querySelector('[data-adc-voltage]');

      if (stateOutput) {
        stateOutput.textContent = 'CH0';
      }

      if (rawOutput) {
        rawOutput.textContent = `${raw} raw`;
      }

      if (voltageOutput) {
        voltageOutput.textContent = `${voltage.toFixed(3)} V`;
      }
    }
  }

  function updateComponentProperty(component, propertyName, value, shouldRecord = false) {
    const definition = componentDefinitions[component.type];
    const propertySchema = definition?.propertySchema?.[propertyName] ?? {};
    component.properties[propertyName] = normalizePropertyValue(propertyName, value, propertySchema);

    syncComponentControls(component);
    syncInspectorPropertyControls(component);
    renderSignals();
    applyDependentVisualStates(component);

    if (state.running) {
      applySimulationUpdate(component, propertyName);
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function syncComponentControls(component) {
    const definition = componentDefinitions[component.type];
    const controls = flattenVisualControls(definition?.controls ?? []);

    component.element.querySelectorAll('[data-property]').forEach((input) => {
      const value = component.properties[input.dataset.property];

      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
        return;
      }

      input.value = String(value ?? '');
    });

    for (const control of controls) {
      if (!control.property) {
        continue;
      }

      component.element.querySelectorAll(`[data-property-output="${control.property}"]`).forEach((output) => {
        output.textContent = formatInlinePropertyValue(control, component);
      });
    }
  }

  function normalizePropertyValue(propertyName, value, propertySchema) {
    if (propertySchema.type === 'boolean') {
      return Boolean(value);
    }

    if (propertySchema.type === 'number') {
      const min = Number.isFinite(Number(propertySchema.minimum)) ? Number(propertySchema.minimum) : Number.NEGATIVE_INFINITY;
      const max = Number.isFinite(Number(propertySchema.maximum)) ? Number(propertySchema.maximum) : Number.POSITIVE_INFINITY;
      return Math.max(min, Math.min(max, Number(value)));
    }

    if (propertySchema.type === 'string') {
      const normalized = String(value ?? '').trim();
      return propertyName === 'ssid' ? normalized || 'VirtualLab' : normalized;
    }

    return value;
  }

  function applySimulationUpdate(component, propertyName) {
    const definition = componentDefinitions[component.type];
    const updateMode = propertySimulationUpdateMode(definition, propertyName);

    if (updateMode === 'live') {
      applyLiveRuntimeUpdate(component, definition);
      return;
    }

    if (updateMode === 'rerun') {
      simulation.runSimulation();
    }
  }

  function propertySimulationUpdateMode(definition, propertyName) {
    const declaredMode = definition?.propertySchema?.[propertyName]?.simulationUpdate;

    if (declaredMode) {
      return declaredMode;
    }

    if (definition?.behavior?.channel === 'distance' && propertyName === definition.behavior.valueProperty) {
      return 'live';
    }

    if (definition?.behavior?.type === 'environment-source' || definition?.behavior?.type === 'analog-voltage-source') {
      return 'live';
    }

    if (
      definition?.behavior?.type === 'wireless-environment'
      || definition?.electricalPrimitive
      || ['rain-sensor', 'light-sensor', 'bmp280-sensor', 'adc-i2c', 'adc-spi'].includes(definition?.behavior?.type)
    ) {
      return 'rerun';
    }

    return definition?.simulation?.effects?.some((effect) => ['firmware', 'electrical', 'environment'].includes(effect))
      ? 'rerun'
      : 'none';
  }

  function applyLiveRuntimeUpdate(component, definition) {
    if (definition?.behavior?.channel === 'distance') {
      simulation.updateDistanceValue(component.id, component.properties[definition.behavior.valueProperty]);
      return;
    }

    if (definition?.behavior?.channel === 'rain') {
      simulation.updateRainValue(component.id, {
        active: component.properties[definition.behavior.activeProperty],
        intensityPercent: component.properties[definition.behavior.intensityProperty]
      });
      return;
    }

    if (definition?.behavior?.channel === 'light') {
      simulation.updateLightValue(component.id, {
        enabled: component.properties[definition.behavior.activeProperty],
        intensityPercent: component.properties[definition.behavior.intensityProperty]
      });
      return;
    }

    if (definition?.behavior?.channel === 'climate') {
      simulation.updateClimateValue(component.id, climatePayload(component));
      return;
    }

    if (definition?.behavior?.type === 'analog-voltage-source') {
      simulation.updateAnalogVoltageValue(component.id, analogPayload(component));
    }
  }

  function applyDependentVisualStates(component) {
    const definition = componentDefinitions[component.type];

    if (definition?.behavior?.channel === 'climate') {
      applyBmp280SensorStates();
    }

    if (definition?.behavior?.type === 'analog-voltage-source') {
      applyAdcStates();
    }

    if (definition?.behavior?.type === 'bmp280-sensor') {
      applyBmp280SensorStates();
    }

    if (definition?.behavior?.type === 'adc-i2c' || definition?.behavior?.type === 'adc-spi') {
      applyAdcStates();
    }
  }

  function flattenVisualControls(controls) {
    return controls.flatMap((control) => [
      control,
      ...flattenVisualControls(control.children ?? [])
    ]);
  }

  function formatInlinePropertyValue(control, component) {
    if (control.activeProperty && !component.properties[control.activeProperty]) {
      return control.inactiveText ?? '';
    }

    const value = component.properties[control.property] ?? control.value ?? '';

    if (control.format === 'onOff') {
      return value ? 'ON' : 'OFF';
    }

    if (control.format === 'percent') {
      return `${value}%`;
    }

    if (control.unit) {
      return `${value} ${control.unit}`;
    }

    return String(value);
  }

  function climatePayload(component) {
    return {
      enabled: component.properties.enabled,
      temperatureC: component.properties.temperatureC,
      pressureHpa: component.properties.pressureHpa
    };
  }

  function analogPayload(component) {
    return {
      enabled: component.properties.enabled,
      voltageVolts: component.properties.voltageVolts
    };
  }

  function firstClimateComponent() {
    return [...state.components.values()].find((component) => component.type === 'climate-environment') ?? null;
  }

  function firstAnalogSourceComponent() {
    return [...state.components.values()].find((component) => component.type === 'analog-voltage-source') ?? null;
  }

  function isAdcComponent(component) {
    return ['ads1015-adc', 'ads1115-adc', 'mcp3008-adc'].includes(component?.type);
  }

  function adcInspectorLabel(component) {
    if (component.type === 'mcp3008-adc') {
      return `10-bit / VREF ${component.properties.referenceVoltageVolts} V`;
    }

    return `${component.type === 'ads1015-adc' ? '12' : '16'}-bit / 0x${Number(component.properties.i2cAddress).toString(16).toUpperCase()} / ${component.properties.gain}`;
  }

  function adcRawForComponent(component, voltage) {
    if (component.type === 'mcp3008-adc') {
      return Math.round(Math.max(0, Math.min(1, voltage / Number(component.properties.referenceVoltageVolts ?? 5))) * 1023);
    }

    const maxRaw = component.type === 'ads1015-adc' ? 2047 : 32767;
    const fullScale = Number(String(component.properties.gain ?? '2.048V').replace('V', '')) || 2.048;
    return Math.round(Math.max(0, Math.min(1, voltage / fullScale)) * maxRaw);
  }

  return {
    applyRainSensorStates,
    applyLdrSensorStates,
    applyBmp280SensorStates,
    applyAdcStates,
    updateComponentProperty,
    syncComponentControls,
    climatePayload,
    analogPayload,
    adcInspectorLabel
  };
}
