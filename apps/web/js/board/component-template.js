export function renderComponentTemplate(definition, componentId, variantsForProperty) {
  const body = renderComponentBody(definition, variantsForProperty);

  const terminals = definition.terminals.map((terminal) => {
    const style = terminal.side === 'left' || terminal.side === 'right'
      ? `top:${terminal.y}px`
      : `left:${terminal.x}px`;
    const labelStyle = terminal.side === 'left'
      ? `left:12px;top:${terminal.y - 4}px`
      : terminal.side === 'right'
        ? `right:12px;top:${terminal.y - 4}px`
        : `left:${terminal.x + 9}px;top:${terminal.y <= 0 ? 6 : terminal.y - 18}px`;

    return `<button class="terminal ${escapeHtml(terminal.side)} ${escapeHtml(terminal.kind)}" style="${style}" data-terminal="${escapeHtml(terminal.id)}" title="${escapeHtml(`${componentId}.${terminal.id}`)}"></button><span class="terminal-label" style="${labelStyle}">${escapeHtml(terminal.label)}</span>`;
  }).join('');

  return `
    <button class="delete-component" title="Remover componente" data-delete-component>×</button>
    <div class="component-header">${escapeHtml(definition.title)}</div>
    <div class="component-body" style="min-height:${definition.height ?? 104}px">${body}${terminals}</div>
  `;
}

function renderComponentBody(definition, variantsForProperty) {
  const controls = definition.controls ?? [];

  if (controls.length > 0) {
    return controls.map((control) => renderVisualControl(control, definition, variantsForProperty)).join('');
  }

  return `<div class="component-visual">${escapeHtml(definition.body)}${renderBuiltInLeds(definition)}</div>`;
}

function renderVisualControl(control, definition, variantsForProperty) {
  switch (control.type) {
    case 'readout':
      return renderReadout(control, definition);
    case 'range':
    case 'number':
      return renderRange(control, definition);
    case 'checkbox':
    case 'boolean':
      return renderCheckbox(control, definition);
    case 'pulse':
      return renderPulseButton(control);
    case 'string':
      return renderTextInput(control, definition);
    case 'variant':
      return renderVariant(control, definition, variantsForProperty);
    case 'container':
      return renderElement({ tag: 'div', ...control }, definition, variantsForProperty);
    case 'element':
      return renderElement(control, definition, variantsForProperty);
    default:
      return '';
  }
}

function renderPulseButton(control) {
  return `
    <button class="${escapeHtml(control.className ?? 'component-pulse-button')}" type="button"
      ${renderPropertyAttribute(control.property)}
      data-pulse-duration-ms="${escapeHtml(control.durationMs ?? 160)}">
      ${escapeHtml(control.label ?? 'Press')}
    </button>
  `;
}

function renderReadout(control, definition) {
  return `
    <div class="${escapeHtml(control.className ?? 'component-readout')}">
      <span>${escapeHtml(control.label ?? '')}</span>
      <strong ${renderOutputAttribute(control)}>${escapeHtml(formatControlValue(control, definition))}</strong>
    </div>
  `;
}

function renderRange(control, definition) {
  const schema = definition.propertySchema[control.property] ?? {};
  const value = definition.properties[control.property] ?? schema.default ?? control.value ?? '';
  const input = `
    <input ${renderPropertyAttribute(control.property)} type="range"
      min="${escapeHtml(control.min ?? schema.min ?? schema.minimum ?? '')}"
      max="${escapeHtml(control.max ?? schema.max ?? schema.maximum ?? '')}"
      step="${escapeHtml(control.step ?? schema.step ?? '')}"
      value="${escapeHtml(value)}">
  `;

  if (control.label || control.className) {
    return `
      <label class="${escapeHtml(control.className ?? 'component-range-row')}">
        ${control.label ? `<span>${escapeHtml(control.label)}</span>` : ''}
        ${input}
      </label>
    `;
  }

  return input;
}

function renderCheckbox(control, definition) {
  const checked = Boolean(definition.properties[control.property]);

  return `
    <label class="${escapeHtml(control.className ?? 'component-checkbox-row')}">
      <input ${renderPropertyAttribute(control.property)} type="checkbox" ${checked ? 'checked' : ''}> ${escapeHtml(control.label ?? '')}
    </label>
  `;
}

function renderTextInput(control, definition) {
  const value = definition.properties[control.property] ?? control.value ?? '';

  return `
    <label class="${escapeHtml(control.className ?? 'component-text-row')}">
      ${control.label ? `<span>${escapeHtml(control.label)}</span>` : ''}
      <input ${renderPropertyAttribute(control.property)} type="text" value="${escapeHtml(value)}">
    </label>
  `;
}

function renderVariant(control, definition, variantsForProperty) {
  return `
    <label class="${escapeHtml(control.className ?? 'component-select-row')}">
      <span>${escapeHtml(control.label ?? control.property)}</span>
      ${renderVariantSelect(variantsForProperty, definition.type, control.property, definition.properties[control.property])}
    </label>
  `;
}

function renderElement(control, definition, variantsForProperty) {
  const tag = validVisualTag(control.tag ?? 'div');
  const children = (control.children ?? []).map((child) => renderVisualControl(child, definition, variantsForProperty)).join('');
  const text = control.text !== undefined ? escapeHtml(control.text) : '';

  return `<${tag}${renderClassAttribute(control.className)} ${renderDataAttribute(control.dataAttribute)}>${text}${children}</${tag}>`;
}

function formatControlValue(control, definition) {
  if (control.activeProperty && !definition.properties[control.activeProperty]) {
    return control.inactiveText ?? '';
  }

  if (control.text !== undefined) {
    return control.text;
  }

  const value = definition.properties[control.property] ?? control.value ?? '';

  if (control.format === 'onOff') {
    return value ? 'ON' : 'OFF';
  }

  if (control.format === 'percent') {
    return `${value}%`;
  }

  if (control.format === 'hex8') {
    return `0x${Number(value ?? 0).toString(16).toUpperCase().padStart(2, '0')}`;
  }

  if (control.unit) {
    return `${value} ${control.unit}`;
  }

  return value;
}

function renderBuiltInLeds(definition) {
  const leds = definition.behavior?.builtInLeds ?? [];

  if (leds.length === 0) {
    return '';
  }

  return `
    <div class="built-in-leds">
      ${leds.map((led) => `
        <span class="built-in-led ${escapeHtml(led.color ?? 'amber')} ${led.active ? 'on' : ''}" data-built-in-led="${escapeHtml(led.id)}" title="${escapeHtml(led.description ?? `${led.label} / GPIO ${led.pin}`)}">
          <span class="built-in-led-dot"></span>${escapeHtml(led.label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderVariantSelect(variantsForProperty, componentType, propertyName, value) {
  const variants = variantsForProperty(componentType, propertyName);

  return `
    <select ${renderPropertyAttribute(propertyName)}>
      ${variants.map((variant) => `
        <option value="${escapeHtml(variant.value)}" ${variantValueMatches(value, variant.value) ? 'selected' : ''}>${escapeHtml(variant.label)}</option>
      `).join('')}
    </select>
  `;
}

function variantValueMatches(value, variantValue) {
  if (typeof variantValue === 'number') {
    return Number(value) === variantValue;
  }

  return String(value) === String(variantValue);
}

function renderDataAttribute(dataAttribute) {
  if (!dataAttribute) {
    return '';
  }

  const attribute = String(dataAttribute).trim();
  return /^data-[a-z0-9-]+(?:="[^"]*")?$/i.test(attribute) ? attribute : '';
}

function renderPropertyAttribute(propertyName) {
  return propertyName ? `data-property="${escapeHtml(propertyName)}"` : '';
}

function renderOutputAttribute(control) {
  if (control.property) {
    return `data-property-output="${escapeHtml(control.property)}"`;
  }

  return renderDataAttribute(control.dataAttribute);
}

function renderClassAttribute(className) {
  return className ? ` class="${escapeHtml(className)}"` : '';
}

function validVisualTag(tag) {
  return ['button', 'div', 'span', 'strong'].includes(tag) ? tag : 'div';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
