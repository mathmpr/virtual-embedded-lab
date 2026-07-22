export function renderComponentTemplate(definition, componentId, variantsForProperty) {
  const body = definition.electricalPrimitive === 'led'
    ? '<div class="led-glow"></div>'
    : definition.className === 'distance'
      ? '<div class="distance-readout"><span>Distância</span><strong data-distance-output>150 cm</strong></div><input data-distance-slider type="range" min="2" max="400" value="150">'
      : definition.className === 'resistor'
        ? `<label class="component-select-row"><span>R</span>${renderVariantSelect(variantsForProperty, 'resistor', 'resistanceOhms', definition.properties.resistanceOhms, 'data-resistor-select')}</label>`
        : definition.className === 'capacitor'
          ? `<label class="component-select-row"><span>C</span>${renderVariantSelect(variantsForProperty, 'capacitor', 'capacitanceMicrofarads', definition.properties.capacitanceMicrofarads, 'data-capacitor-select')}</label>`
          : definition.className === 'wifi-signal'
            ? `<div class="wifi-readout"><span>Wi-Fi</span><strong data-wifi-output>${definition.properties.strengthPercent}%</strong></div><label class="wifi-checkbox-row"><input data-wifi-connected type="checkbox" ${definition.properties.connected ? 'checked' : ''}> Internet ativa</label><input data-wifi-slider type="range" min="0" max="100" value="${definition.properties.strengthPercent}">`
            : definition.className === 'rain-toggle'
              ? `<div class="rain-readout"><span>Chuva</span><strong data-rain-output>${definition.properties.active ? 'ON' : 'OFF'}</strong></div><label class="wifi-checkbox-row"><input data-rain-active type="checkbox" ${definition.properties.active ? 'checked' : ''}> Chuva ativa</label><input data-rain-intensity type="range" min="0" max="100" value="${definition.properties.intensityPercent}">`
              : definition.className === 'fc37-rain-sensor'
                ? '<div class="rain-sensor-readout"><span>FC-37</span><strong data-rain-sensor-state>DRY</strong></div><div class="rain-sensor-plate"></div>'
                : definition.className === 'light-level'
                  ? `<div class="light-readout"><span>Luz</span><strong data-light-output>${definition.properties.enabled ? `${definition.properties.intensityPercent}%` : 'OFF'}</strong></div><label class="wifi-checkbox-row"><input data-light-enabled type="checkbox" ${definition.properties.enabled ? 'checked' : ''}> Luz ativa</label><input data-light-intensity type="range" min="0" max="100" value="${definition.properties.intensityPercent}">`
                  : definition.className === 'ldr-light-sensor'
                    ? '<div class="light-sensor-readout"><span>LDR</span><strong data-ldr-state>DIM</strong></div><div class="ldr-photoresistor"></div>'
                    : definition.className === 'climate-environment'
                      ? `<div class="climate-readout"><span>Clima</span><strong data-climate-output>${definition.properties.enabled ? `${definition.properties.temperatureC} °C` : 'OFF'}</strong></div><label class="wifi-checkbox-row"><input data-climate-enabled type="checkbox" ${definition.properties.enabled ? 'checked' : ''}> Clima ativo</label><label class="compact-slider-row"><span>°C</span><input data-climate-temperature type="range" min="-40" max="85" step="1" value="${definition.properties.temperatureC}"></label><label class="compact-slider-row"><span>hPa</span><input data-climate-pressure type="range" min="300" max="1100" step="1" value="${definition.properties.pressureHpa}"></label>`
                      : definition.className === 'bmp280-sensor'
                        ? '<div class="bmp280-readout"><span>BMP280</span><strong data-bmp280-state>--</strong></div><div class="bmp280-chip"><span data-bmp280-temp>-- °C</span><span data-bmp280-pressure>-- hPa</span></div>'
                        : definition.className === 'analog-voltage-source'
                          ? `<div class="analog-readout"><span>Fonte</span><strong data-analog-output>${definition.properties.enabled ? `${definition.properties.voltageVolts} V` : 'OFF'}</strong></div><label class="wifi-checkbox-row"><input data-analog-enabled type="checkbox" ${definition.properties.enabled ? 'checked' : ''}> Saída ativa</label><input data-analog-voltage type="range" min="0" max="5" step="0.001" value="${definition.properties.voltageVolts}">`
                          : definition.className?.includes('adc-module')
                            ? `<div class="adc-readout"><span>${definition.title}</span><strong data-adc-state>CH0</strong></div><div class="adc-chip"><span data-adc-raw>-- raw</span><span data-adc-voltage>-- V</span></div>`
                            : `<div class="component-visual">${definition.body}${renderBuiltInLeds(definition)}</div>`;

  const terminals = definition.terminals.map((terminal) => {
    const style = terminal.side === 'left' || terminal.side === 'right'
      ? `top:${terminal.y}px`
      : `left:${terminal.x}px`;
    const labelStyle = terminal.side === 'left'
      ? `left:12px;top:${terminal.y - 4}px`
      : terminal.side === 'right'
        ? `right:12px;top:${terminal.y - 4}px`
        : `left:${terminal.x + 9}px;top:${terminal.y <= 0 ? 6 : terminal.y - 18}px`;

    return `<button class="terminal ${terminal.side} ${terminal.kind}" style="${style}" data-terminal="${terminal.id}" title="${componentId}.${terminal.id}"></button><span class="terminal-label" style="${labelStyle}">${terminal.label}</span>`;
  }).join('');

  return `
    <button class="delete-component" title="Remover componente" data-delete-component>×</button>
    <div class="component-header">${definition.title}</div>
    <div class="component-body" style="min-height:${definition.height ?? 104}px">${body}${terminals}</div>
  `;
}

function renderBuiltInLeds(definition) {
  const leds = definition.behavior?.builtInLeds ?? [];

  if (leds.length === 0) {
    return '';
  }

  return `
    <div class="built-in-leds">
      ${leds.map((led) => `
        <span class="built-in-led ${led.color ?? 'amber'} ${led.active ? 'on' : ''}" data-built-in-led="${led.id}" title="${led.description ?? `${led.label} / GPIO ${led.pin}`}">
          <span class="built-in-led-dot"></span>${led.label}
        </span>
      `).join('')}
    </div>
  `;
}

function renderVariantSelect(variantsForProperty, componentType, propertyName, value, dataAttribute) {
  const variants = variantsForProperty(componentType, propertyName);

  return `
    <select ${dataAttribute}>
      ${variants.map((variant) => `
        <option value="${variant.value}" ${Number(value) === variant.value ? 'selected' : ''}>${variant.label}</option>
      `).join('')}
    </select>
  `;
}
