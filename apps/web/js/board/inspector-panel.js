import { terminalReference } from '../components.js';
import { escapeHtml, formatCurrent, formatPower, formatVoltage, labelFromPropertyName } from './formatters.js';

export function createInspectorPanel({
  state,
  inspectorContent,
  componentDefinitions,
  getNets,
  terminalKind,
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
    inspectorContent.querySelectorAll('[data-property]').forEach((input) => {
      const propertyName = input.dataset.property;
      const eventName = input.matches('input[type="range"]') ? 'input' : 'change';

      if (eventName === 'input') {
        input.addEventListener('input', () => {
          callbacks.updateComponentProperty(component, propertyName, inspectorInputValue(input));
        });
        input.addEventListener('change', () => {
          callbacks.updateComponentProperty(component, propertyName, inspectorInputValue(input), true);
        });
        return;
      }

      input.addEventListener('change', () => {
        callbacks.updateComponentProperty(component, propertyName, inspectorInputValue(input), true);
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
          <select data-property="${propertyName}">
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
          <input data-property="${propertyName}" type="checkbox" ${value ? 'checked' : ''}>
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
          <input data-property="${propertyName}" type="${inputType}"${min}${max} step="${step}" value="${escapeHtml(value)}">
        </label>
        <div class="property-row"><span>${escapeHtml(label)}</span><code data-property-output="${propertyName}">${formatInspectorPropertyValue(propertyName, value, propertySchema)}</code></div>
      `;
    }

    if (propertySchema.type === 'string') {
      return `
        <label class="property-row editable-property">
          <span>${escapeHtml(label)}</span>
          <input data-property="${propertyName}" type="text" value="${escapeHtml(value)}">
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

  function syncInspectorPropertyControls(component) {
    const definition = componentDefinitions[component.type];

    for (const [propertyName, propertySchema] of Object.entries(definition?.propertySchema ?? {})) {
      const input = inspectorContent.querySelector(`[data-property="${propertyName}"]`);
      const output = inspectorContent.querySelector(`[data-property-output="${propertyName}"]`);
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
