import { terminalReference } from '../components.js';
import { escapeHtml, formatCurrent, formatPower, formatVoltage, labelFromPropertyName } from './formatters.js';

export function createInspectorPanel({
  state,
  inspectorContent,
  componentDefinitions,
  getNets,
  terminalKind,
  renderSignals,
  recordHistory,
  simulation,
  callbacks
}) {
  function renderInspector() {
    if (state.selectedNetId) {
      renderNetInspector(state.selectedNetId);
      return;
    }

    const component = state.components.get(state.selectedId);

    if (!component) {
      inspectorContent.innerHTML = '<p class="muted">Selecione um componente ou fio.</p>';
      return;
    }

    const definition = componentDefinitions[component.type];
    const terminalRows = definition.terminals.map((terminal) => {
      return `<div class="property-row"><span>Terminal</span><code>${component.id}.${terminal.id}</code></div>`;
    }).join('');
    const propertyRows = renderEditableProperties(component);
    const readingRows = renderComponentReadings(component.id);

    inspectorContent.innerHTML = `
      <div class="property-row"><span>ID</span><code>${component.id}</code></div>
      <div class="property-row"><span>Tipo</span><code>${definition.title}</code></div>
      <div class="property-row"><span>Posição</span><code>${Math.round(component.x)}, ${Math.round(component.y)}</code></div>
      ${propertyRows}
      ${readingRows}
      ${terminalRows}
    `;
    bindInspectorPropertyControls(component);
  }

  function renderEditableProperties(component) {
    const definition = componentDefinitions[component.type];
    const schemaEntries = Object.entries(definition?.propertySchema ?? {});

    if (schemaEntries.length === 0) {
      return Object.entries(component.properties).map(([key, value]) => {
        return `<div class="property-row"><span>${labelFromPropertyName(key)}</span><code>${formatInspectorPropertyValue(key, value, null)}</code></div>`;
      }).join('');
    }

    return schemaEntries.map(([propertyName, propertySchema]) => {
      return renderInspectorPropertyControl(component, definition, propertyName, propertySchema);
    }).join('');
  }

  function bindInspectorPropertyControls(component) {
    inspectorContent.querySelectorAll('[data-inspector-property]').forEach((input) => {
      const propertyName = input.dataset.inspectorProperty;
      const eventName = input.matches('input[type="range"]') ? 'input' : 'change';

      if (eventName === 'input') {
        input.addEventListener('input', () => {
          updateComponentProperty(component, propertyName, inspectorInputValue(input));
        });
        input.addEventListener('change', () => {
          updateComponentProperty(component, propertyName, inspectorInputValue(input), true);
        });
        return;
      }

      input.addEventListener('change', () => {
        updateComponentProperty(component, propertyName, inspectorInputValue(input), true);
      });
    });
  }

  function renderInspectorPropertyControl(component, definition, propertyName, propertySchema) {
    const value = component.properties[propertyName];
    const label = propertySchema.label ?? labelFromPropertyName(propertyName);
    const variants = definition.variants?.[propertyName] ?? [];

    if (variants.length > 0) {
      return `
        <label class="property-row editable-property">
          <span>${escapeHtml(label)}</span>
          <select data-inspector-property="${propertyName}">
            ${variants.map((variant) => `
              <option value="${escapeHtml(variant.value)}" ${String(value) === String(variant.value) ? 'selected' : ''}>${escapeHtml(variant.label)}</option>
            `).join('')}
          </select>
        </label>
      `;
    }

    if (propertySchema.type === 'boolean') {
      return `
        <label class="property-row editable-property">
          <span>${escapeHtml(label)}</span>
          <input data-inspector-property="${propertyName}" type="checkbox" ${value ? 'checked' : ''}>
        </label>
      `;
    }

    if (propertySchema.type === 'number') {
      const inputType = shouldUseRangeInput(propertyName, propertySchema) ? 'range' : 'number';
      const min = Number.isFinite(Number(propertySchema.minimum)) ? ` min="${propertySchema.minimum}"` : '';
      const max = Number.isFinite(Number(propertySchema.maximum)) ? ` max="${propertySchema.maximum}"` : '';
      const step = inspectorPropertyStep(propertyName, propertySchema);

      return `
        <label class="property-row editable-property">
          <span>${escapeHtml(label)}</span>
          <input data-inspector-property="${propertyName}" type="${inputType}"${min}${max} step="${step}" value="${escapeHtml(value)}">
        </label>
        <div class="property-row"><span>${escapeHtml(label)}</span><code data-inspector-property-output="${propertyName}">${formatInspectorPropertyValue(propertyName, value, propertySchema)}</code></div>
      `;
    }

    if (propertySchema.type === 'string') {
      return `
        <label class="property-row editable-property">
          <span>${escapeHtml(label)}</span>
          <input data-inspector-property="${propertyName}" type="text" value="${escapeHtml(value)}">
        </label>
      `;
    }

    return `<div class="property-row"><span>${escapeHtml(label)}</span><code>${formatInspectorPropertyValue(propertyName, value, propertySchema)}</code></div>`;
  }

  function shouldUseRangeInput(propertyName, propertySchema) {
    if (!Number.isFinite(Number(propertySchema.minimum)) || !Number.isFinite(Number(propertySchema.maximum))) {
      return false;
    }

    return propertyName.toLowerCase().includes('percent')
      || propertyName === 'valueCm'
      || propertyName === 'temperatureC'
      || propertyName === 'pressureHpa'
      || propertyName === 'voltageVolts'
      || propertyName === 'gamma';
  }

  function inspectorPropertyStep(propertyName, propertySchema) {
    if (Number.isFinite(Number(propertySchema.step))) {
      return propertySchema.step;
    }

    if (propertyName === 'voltageVolts') {
      return 0.001;
    }

    if (propertyName === 'gamma') {
      return 0.1;
    }

    return propertySchema.type === 'number' ? 'any' : 1;
  }

  function inspectorInputValue(input) {
    if (input.type === 'checkbox') {
      return input.checked;
    }

    if (input.type === 'number' || input.type === 'range') {
      return Number(input.value);
    }

    return input.value;
  }

  function updateComponentProperty(component, propertyName, value, shouldRecord = false) {
    const definition = componentDefinitions[component.type];
    const propertySchema = definition?.propertySchema?.[propertyName] ?? {};
    const normalizedValue = normalizeInspectorPropertyValue(value, propertySchema);

    if (definition?.behavior?.channel === 'distance' && propertyName === definition.behavior.valueProperty) {
      callbacks.updateDistanceValue(component, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.electricalPrimitive === 'resistor' && propertyName === definition.electricalModel?.resistanceProperty) {
      callbacks.updateResistorValue(component, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.electricalPrimitive === 'capacitor' && propertyName === definition.electricalModel?.capacitanceProperty) {
      callbacks.updateCapacitorValue(component, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.behavior?.type === 'wireless-environment') {
      updateWirelessEnvironmentProperty(component, propertyName, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.behavior?.type === 'environment-source') {
      updateEnvironmentSourceProperty(component, propertyName, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.behavior?.type === 'analog-voltage-source') {
      updateAnalogSourceProperty(component, propertyName, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.behavior?.type === 'ldr-light-sensor') {
      callbacks.updateLdrProperty(component, propertyName, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.behavior?.type === 'bmp280-sensor') {
      callbacks.updateBmp280Property(component, propertyName, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.behavior?.type === 'adc-i2c' || definition?.behavior?.type === 'adc-spi') {
      callbacks.updateAdcProperty(component, propertyName, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    component.properties[propertyName] = normalizedValue;
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running && definition?.simulation?.effects?.some((effect) => ['firmware', 'electrical', 'environment'].includes(effect))) {
      simulation.runSimulation();
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateWirelessEnvironmentProperty(component, propertyName, value, shouldRecord) {
    if (propertyName === 'strengthPercent') {
      callbacks.updateWifiStrength(component, value, shouldRecord);
      return;
    }

    if (propertyName === 'connected') {
      callbacks.updateWifiInternetAvailable(component, value, shouldRecord);
      return;
    }

    if (propertyName === 'ssid') {
      callbacks.updateWifiSsid(component, value, shouldRecord);
      return;
    }

    component.properties[propertyName] = value;
    syncInspectorPropertyControls(component);
  }

  function updateEnvironmentSourceProperty(component, propertyName, value, shouldRecord) {
    const definition = componentDefinitions[component.type];
    component.properties[propertyName] = value;
    callbacks.syncEnvironmentControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      if (definition.behavior.channel === 'rain') {
        simulation.updateRainValue(component.id, {
          active: component.properties[definition.behavior.activeProperty],
          intensityPercent: component.properties[definition.behavior.intensityProperty]
        });
      } else if (definition.behavior.channel === 'light') {
        simulation.updateLightValue(component.id, {
          enabled: component.properties[definition.behavior.activeProperty],
          intensityPercent: component.properties[definition.behavior.intensityProperty]
        });
      } else if (definition.behavior.channel === 'climate') {
        simulation.updateClimateValue(component.id, callbacks.climatePayload(component));
        callbacks.applyBmp280SensorStates();
      }
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateAnalogSourceProperty(component, propertyName, value, shouldRecord) {
    component.properties[propertyName] = value;
    callbacks.syncAnalogControl(component);
    syncInspectorPropertyControls(component);
    renderSignals();

    if (state.running) {
      simulation.updateAnalogVoltageValue(component.id, callbacks.analogPayload(component));
    }

    callbacks.applyAdcStates();

    if (shouldRecord) {
      recordHistory();
    }
  }

  function syncInspectorPropertyControls(component) {
    const definition = componentDefinitions[component.type];

    for (const [propertyName, propertySchema] of Object.entries(definition?.propertySchema ?? {})) {
      const input = inspectorContent.querySelector(`[data-inspector-property="${propertyName}"]`);
      const output = inspectorContent.querySelector(`[data-inspector-property-output="${propertyName}"]`);
      const value = component.properties[propertyName];

      if (input) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = String(value);
        }
      }

      if (output) {
        output.textContent = formatInspectorPropertyValue(propertyName, value, propertySchema);
      }
    }
  }

  function normalizeInspectorPropertyValue(value, propertySchema) {
    if (propertySchema.type === 'boolean') {
      return Boolean(value);
    }

    if (propertySchema.type === 'number') {
      const min = Number.isFinite(Number(propertySchema.minimum)) ? Number(propertySchema.minimum) : Number.NEGATIVE_INFINITY;
      const max = Number.isFinite(Number(propertySchema.maximum)) ? Number(propertySchema.maximum) : Number.POSITIVE_INFINITY;
      return Math.max(min, Math.min(max, Number(value)));
    }

    return String(value ?? '');
  }

  function formatInspectorPropertyValue(propertyName, value, propertySchema) {
    if (propertySchema?.type === 'boolean') {
      return value ? 'ON' : 'OFF';
    }

    if (propertySchema?.unit) {
      return `${value} ${propertySchema.unit}`;
    }

    if (propertyName === 'i2cAddress' && Number.isFinite(Number(value))) {
      return `0x${Number(value).toString(16).toUpperCase()}`;
    }

    return String(value);
  }

  function renderNetInspector(netId) {
    const net = getNets().find((item) => item.id === netId);

    if (!net) {
      inspectorContent.innerHTML = '<p class="muted">Net não encontrada.</p>';
      return;
    }

    const terminalRows = net.terminals.map((terminal) => {
      return `<div class="property-row"><span>Terminal</span><code>${terminalReference(terminal)}</code></div>`;
    }).join('');
    const reading = state.electrical.netReadings.get(net.id);
    const readingRows = reading
      ? `
        <div class="property-row"><span>Tensão</span><code>${formatVoltage(reading.voltageVolts)}</code></div>
        <div class="property-row"><span>Estado</span><code>${reading.state}</code></div>
      `
      : '';

    inspectorContent.innerHTML = `
      <div class="property-row"><span>ID</span><code>${net.id}</code></div>
      <div class="property-row"><span>Tipo</span><code>${net.kind}</code></div>
      <div class="property-row"><span>Terminais</span><code>${net.terminals.length}</code></div>
      ${readingRows}
      ${terminalRows}
    `;
  }

  function renderComponentReadings(componentId) {
    const reading = state.electrical.componentReadings.get(componentId);

    if (!reading) {
      return '';
    }

    return `
      <div class="property-row"><span>Tensão</span><code>${formatVoltage(reading.voltageVolts)}</code></div>
      <div class="property-row"><span>Corrente</span><code>${formatCurrent(reading.currentAmps)}</code></div>
      <div class="property-row"><span>Potência</span><code>${formatPower(reading.powerWatts)}</code></div>
      <div class="property-row"><span>Estado elétrico</span><code>${reading.state}</code></div>
    `;
  }

  return {
    renderInspector,
    syncInspectorPropertyControls
  };
}
