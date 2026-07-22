export function createComponentState({
  state,
  componentDefinitions,
  simulation,
  renderSignals,
  renderInspector,
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

  function updateDistanceValue(component, valueCm, shouldRecord = false) {
    component.properties.valueCm = valueCm;
    syncDistanceControl(component);
    syncInspectorPropertyControls(component);

    if (state.running) {
      simulation.updateDistanceValue(component.id, valueCm);
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateResistorValue(component, resistanceOhms, shouldRecord = false) {
    component.properties.resistanceOhms = resistanceOhms;
    syncResistorControl(component);
    renderInspector();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateCapacitorValue(component, capacitanceMicrofarads, shouldRecord = false) {
    component.properties.capacitanceMicrofarads = capacitanceMicrofarads;
    syncCapacitorControl(component);
    renderInspector();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateWifiStrength(component, strengthPercent, shouldRecord = false) {
    component.properties.strengthPercent = Math.max(0, Math.min(100, strengthPercent));
    syncWifiSignalControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateWifiInternetAvailable(component, internetAvailable, shouldRecord = false) {
    component.properties.connected = Boolean(internetAvailable);
    syncWifiSignalControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateWifiSsid(component, ssid, shouldRecord = false) {
    component.properties.ssid = ssid.trim() || 'VirtualLab';
    syncWifiSignalControl(component);
    renderInspector();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateRainActive(component, active, shouldRecord = false) {
    component.properties.active = Boolean(active);
    syncRainControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateRainValue(component.id, {
        active: component.properties.active,
        intensityPercent: component.properties.intensityPercent
      });
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateRainIntensity(component, intensityPercent, shouldRecord = false) {
    component.properties.intensityPercent = Math.max(0, Math.min(100, intensityPercent));
    syncRainControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateRainValue(component.id, {
        active: component.properties.active,
        intensityPercent: component.properties.intensityPercent
      });
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateRainSensorActiveLow(component, activeLow, shouldRecord = false) {
    component.properties.activeLow = Boolean(activeLow);
    renderInspector();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateRainSensorThreshold(component, thresholdPercent, shouldRecord = false) {
    component.properties.thresholdPercent = Math.max(0, Math.min(100, thresholdPercent));
    syncInspectorPropertyControls(component);

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateLightEnabled(component, enabled, shouldRecord = false) {
    component.properties.enabled = Boolean(enabled);
    syncLightControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateLightValue(component.id, {
        enabled: component.properties.enabled,
        intensityPercent: component.properties.intensityPercent
      });
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateLightIntensity(component, intensityPercent, shouldRecord = false) {
    component.properties.intensityPercent = Math.max(0, Math.min(100, intensityPercent));
    syncLightControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateLightValue(component.id, {
        enabled: component.properties.enabled,
        intensityPercent: component.properties.intensityPercent
      });
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateLdrProperty(component, property, value, shouldRecord = false) {
    const limits = {
      darkResistanceOhms: [1000, 1000000],
      brightResistanceOhms: [100, 10000],
      gamma: [0.1, 2]
    };
    const [min, max] = limits[property] ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    component.properties[property] = Math.max(min, Math.min(max, Number(value)));
    syncInspectorPropertyControls(component);

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateClimateEnabled(component, enabled, shouldRecord = false) {
    component.properties.enabled = Boolean(enabled);
    syncClimateControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateClimateValue(component.id, climatePayload(component));
    }

    applyBmp280SensorStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateClimateTemperature(component, temperatureC, shouldRecord = false) {
    component.properties.temperatureC = Math.max(-40, Math.min(85, temperatureC));
    syncClimateControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateClimateValue(component.id, climatePayload(component));
    }

    applyBmp280SensorStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateClimatePressure(component, pressureHpa, shouldRecord = false) {
    component.properties.pressureHpa = Math.max(300, Math.min(1100, pressureHpa));
    syncClimateControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateClimateValue(component.id, climatePayload(component));
    }

    applyBmp280SensorStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateBmp280Property(component, property, value, shouldRecord = false) {
    const limits = {
      i2cAddress: [118, 119],
      temperatureOffsetC: [-20, 20],
      pressureOffsetHpa: [-100, 100]
    };
    const [min, max] = limits[property] ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    component.properties[property] = Math.max(min, Math.min(max, Number(value)));
    syncInspectorPropertyControls(component);
    applyBmp280SensorStates();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateAnalogEnabled(component, enabled, shouldRecord = false) {
    component.properties.enabled = Boolean(enabled);
    syncAnalogControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateAnalogVoltageValue(component.id, analogPayload(component));
    }

    applyAdcStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateAnalogVoltage(component, voltageVolts, shouldRecord = false) {
    component.properties.voltageVolts = Math.max(0, Math.min(5, voltageVolts));
    syncAnalogControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateAnalogVoltageValue(component.id, analogPayload(component));
    }

    applyAdcStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateAdcProperty(component, property, value, shouldRecord = false) {
    component.properties[property] = value;
    syncInspectorPropertyControls(component);
    applyAdcStates();

    if (state.running) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function syncEnvironmentControl(component) {
    const definition = componentDefinitions[component.type];

    if (definition?.behavior?.channel === 'rain') {
      syncRainControl(component);
      return;
    }

    if (definition?.behavior?.channel === 'light') {
      syncLightControl(component);
      return;
    }

    if (definition?.behavior?.channel === 'climate') {
      syncClimateControl(component);
    }
  }

  function syncDistanceControl(component) {
    if (component.type !== 'distance') {
      return;
    }

    const slider = component.element.querySelector('[data-distance-slider]');
    const output = component.element.querySelector('[data-distance-output]');

    if (!slider || !output) {
      return;
    }

    slider.value = component.properties.valueCm;
    output.textContent = `${component.properties.valueCm} cm`;
  }

  function syncResistorControl(component) {
    if (component.type !== 'resistor') {
      return;
    }

    component.element.querySelectorAll('[data-resistor-select]').forEach((select) => {
      select.value = String(component.properties.resistanceOhms);
    });
  }

  function syncCapacitorControl(component) {
    if (component.type !== 'capacitor') {
      return;
    }

    component.element.querySelectorAll('[data-capacitor-select]').forEach((select) => {
      select.value = String(component.properties.capacitanceMicrofarads);
    });
  }

  function syncWifiSignalControl(component) {
    if (component.type !== 'wifi-signal') {
      return;
    }

    const slider = component.element.querySelector('[data-wifi-slider]');
    const output = component.element.querySelector('[data-wifi-output]');
    const checkbox = component.element.querySelector('[data-wifi-connected]');

    if (slider) {
      slider.value = String(component.properties.strengthPercent);
    }

    if (output) {
      output.textContent = `${component.properties.strengthPercent}%`;
    }

    if (checkbox) {
      checkbox.checked = Boolean(component.properties.connected);
    }
  }

  function syncRainControl(component) {
    if (component.type !== 'rain-toggle') {
      return;
    }

    const checkbox = component.element.querySelector('[data-rain-active]');
    const slider = component.element.querySelector('[data-rain-intensity]');
    const output = component.element.querySelector('[data-rain-output]');

    if (checkbox) {
      checkbox.checked = Boolean(component.properties.active);
    }

    if (slider) {
      slider.value = String(component.properties.intensityPercent);
    }

    if (output) {
      output.textContent = component.properties.active ? 'ON' : 'OFF';
    }
  }

  function syncLightControl(component) {
    if (component.type !== 'light-level') {
      return;
    }

    const checkbox = component.element.querySelector('[data-light-enabled]');
    const slider = component.element.querySelector('[data-light-intensity]');
    const output = component.element.querySelector('[data-light-output]');

    if (checkbox) {
      checkbox.checked = Boolean(component.properties.enabled);
    }

    if (slider) {
      slider.value = String(component.properties.intensityPercent);
    }

    if (output) {
      output.textContent = component.properties.enabled ? `${component.properties.intensityPercent}%` : 'OFF';
    }
  }

  function syncClimateControl(component) {
    if (component.type !== 'climate-environment') {
      return;
    }

    const checkbox = component.element.querySelector('[data-climate-enabled]');
    const temperature = component.element.querySelector('[data-climate-temperature]');
    const pressure = component.element.querySelector('[data-climate-pressure]');
    const output = component.element.querySelector('[data-climate-output]');

    if (checkbox) {
      checkbox.checked = Boolean(component.properties.enabled);
    }

    if (temperature) {
      temperature.value = String(component.properties.temperatureC);
    }

    if (pressure) {
      pressure.value = String(component.properties.pressureHpa);
    }

    if (output) {
      output.textContent = component.properties.enabled ? `${component.properties.temperatureC} °C` : 'OFF';
    }
  }

  function syncAnalogControl(component) {
    if (component.type !== 'analog-voltage-source') {
      return;
    }

    const checkbox = component.element.querySelector('[data-analog-enabled]');
    const slider = component.element.querySelector('[data-analog-voltage]');
    const output = component.element.querySelector('[data-analog-output]');

    if (checkbox) {
      checkbox.checked = Boolean(component.properties.enabled);
    }

    if (slider) {
      slider.value = String(component.properties.voltageVolts);
    }

    if (output) {
      output.textContent = component.properties.enabled ? `${component.properties.voltageVolts} V` : 'OFF';
    }
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
    updateDistanceValue,
    updateResistorValue,
    updateCapacitorValue,
    updateWifiStrength,
    updateWifiInternetAvailable,
    updateWifiSsid,
    updateRainActive,
    updateRainIntensity,
    updateRainSensorActiveLow,
    updateRainSensorThreshold,
    updateLightEnabled,
    updateLightIntensity,
    updateLdrProperty,
    updateClimateEnabled,
    updateClimateTemperature,
    updateClimatePressure,
    updateBmp280Property,
    updateAnalogEnabled,
    updateAnalogVoltage,
    updateAdcProperty,
    syncEnvironmentControl,
    syncDistanceControl,
    syncResistorControl,
    syncCapacitorControl,
    syncWifiSignalControl,
    syncRainControl,
    syncLightControl,
    syncClimateControl,
    syncAnalogControl,
    climatePayload,
    analogPayload,
    adcInspectorLabel
  };
}
