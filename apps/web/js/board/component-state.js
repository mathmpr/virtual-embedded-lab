import { environmentPayloadForComponent } from '../simulation/environment-payload.js';
import { stateText, t } from '../i18n.js';

export function createComponentState({
  state,
  componentDefinitions,
  simulation,
  renderSignals,
  recordHistory,
  syncInspectorPropertyControls
}) {
  function applyVisualStateBindings() {
    for (const component of state.components.values()) {
      applyComponentStateBindings(component);
    }
  }

  function applyComponentStateBindings(component) {
    const definition = componentDefinitions[component.type];

    for (const binding of definition?.stateBindings ?? []) {
      applyStateBinding(component, binding);
    }
  }

  function applyStateBinding(component, binding) {
    const value = derivedBindingValue(component, binding.source);

    if (binding.type === 'class') {
      bindingTargets(component, binding).forEach((target) => {
        target.classList.toggle(binding.className, matchesBindingWhen(value, binding.when));
      });
      return;
    }

    if (binding.type === 'classMap') {
      bindingTargets(component, binding).forEach((target) => {
        for (const stateClass of binding.classes ?? []) {
          target.classList.toggle(stateClass.className, matchesRange(value, stateClass));
        }
      });
      return;
    }

    if (binding.type === 'text') {
      component.element.querySelectorAll(binding.selector).forEach((target) => {
        target.textContent = formatBindingValue(value, binding, component);
      });
      return;
    }

    if (binding.type === 'style') {
      bindingTargets(component, binding).forEach((target) => {
        target.style.setProperty(binding.styleProperty, formatStyleBindingValue(value, binding));
      });
    }
  }

  function updateComponentProperty(component, propertyName, value, shouldRecord = false) {
    const definition = componentDefinitions[component.type];
    const propertySchema = definition?.propertySchema?.[propertyName] ?? {};
    component.properties[propertyName] = normalizePropertyValue(propertyName, value, propertySchema);

    syncComponentControls(component);
    syncInspectorPropertyControls(component);
    renderSignals();
    applyVisualStateBindings();

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
      simulation.updateRainValue(component.id, environmentPayloadForComponent(component));
      return;
    }

    if (definition?.behavior?.channel === 'light') {
      simulation.updateLightValue(component.id, environmentPayloadForComponent(component));
      return;
    }

    if (definition?.behavior?.channel === 'climate') {
      simulation.updateClimateValue(component.id, environmentPayloadForComponent(component));
      return;
    }

    if (definition?.behavior?.channel === 'water') {
      simulation.updateWaterValue?.(component.id, environmentPayloadForComponent(component));
      return;
    }

    if (definition?.behavior?.type === 'analog-voltage-source') {
      simulation.updateAnalogVoltageValue(component.id, environmentPayloadForComponent(component));
      return;
    }

    if (definition?.behavior?.type === 'momentary-button') {
      simulation.updateDigitalInputValue(component.id, component.properties[definition.behavior.activeProperty ?? 'pressed']);
    }
  }

  function applyDependentVisualStates(component) {
    const definition = componentDefinitions[component.type];

    applyVisualStateBindings();
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
      return value ? stateText('ON') : stateText('OFF');
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

    return String(value);
  }

  function derivedBindingValue(component, source = {}) {
    if (source.kind === 'environment') {
      return state.signals[source.channel];
    }

    if (source.kind === 'componentProperty') {
      return component.properties[source.property];
    }

    if (source.kind === 'relatedComponent') {
      const related = firstComponentByType(source.componentType);

      if (!related) {
        return source.fallback ?? null;
      }

      if (source.enabledProperty && !related.properties[source.enabledProperty]) {
        return source.disabledValue ?? false;
      }

      const value = related.properties[source.property];
      const offset = source.offsetProperty ? Number(component.properties[source.offsetProperty] ?? 0) : 0;
      return Number.isFinite(Number(value)) ? Number(value) + offset : value;
    }

    if (source.kind === 'adcRaw') {
      return adcRawForComponent(component, relatedAnalogVoltage());
    }

    if (source.kind === 'analogVoltage') {
      return relatedAnalogVoltage();
    }

    if (source.kind === 'electricalReading') {
      return state.electrical.componentReadings.get(component.id)?.[source.property] ?? source.fallback ?? null;
    }

    if (source.kind === 'netReading') {
      return state.electrical.netReadings.get(source.netId)?.[source.property] ?? source.fallback ?? null;
    }

    if (source.kind === 'terminalNetReading') {
      const net = terminalNet(component.id, source.terminalId);
      return net ? state.electrical.netReadings.get(net.id)?.[source.property] ?? source.fallback ?? null : source.fallback ?? null;
    }

    if (source.kind === 'terminalRuntimeSignal') {
      const signal = state.signalsByComponent.get(component.id)?.terminals?.find((item) => item.terminalId === source.terminalId);
      const value = Number(signal?.value ?? source.fallback ?? 0);

      if (source.invertProperty && component.properties[source.invertProperty] === false) {
        return value ? 0 : 1;
      }

      return value;
    }

    return source.value ?? null;
  }

  function bindingTargets(component, binding) {
    return binding.selector
      ? component.element.querySelectorAll(binding.selector)
      : [component.element];
  }

  function formatBindingValue(value, binding, component) {
    if (binding.format === 'wetDry') {
      return value ? t('WET') : t('DRY');
    }

    if (binding.format === 'lightLevel') {
      const raw = Math.round(Number(value ?? 0) * 1023);
      return raw < 300 ? t('DARK') : raw < 700 ? t('DIM') : t('BRIGHT');
    }

    if (binding.format === 'addressWhenEnabled') {
      const address = component.properties[binding.addressProperty] ?? binding.address ?? 0;
      return value ? `0x${Number(address).toString(16).toUpperCase()}` : binding.disabledText ?? t('OFF');
    }

    if (binding.format === 'fixed') {
      return `${Number(value ?? 0).toFixed(binding.digits ?? 0)}${binding.unit ? ` ${binding.unit}` : ''}`;
    }

    if (binding.format === 'raw') {
      return `${Math.round(Number(value ?? 0))} ${t('raw')}`;
    }

    if (binding.format === 'onOff') {
      return value ? stateText('ON') : stateText('OFF');
    }

    if (binding.format === 'highLow') {
      return value ? stateText('HIGH') : stateText('LOW');
    }

    if (binding.text !== undefined) {
      return binding.text;
    }

    return String(value ?? '');
  }

  function formatStyleBindingValue(value, binding) {
    if (binding.unit) {
      return `${Number(value ?? 0)}${binding.unit}`;
    }

    return String(Number(value ?? 0));
  }

  function matchesBindingWhen(value, expected) {
    if (expected === undefined) {
      return Boolean(value);
    }

    if (typeof expected === 'boolean') {
      return Boolean(value) === expected;
    }

    return value === expected;
  }

  function matchesRange(value, range) {
    const numericValue = Number(value);

    if (Number.isFinite(Number(range.lt)) && !(numericValue < Number(range.lt))) {
      return false;
    }

    if (Number.isFinite(Number(range.lte)) && !(numericValue <= Number(range.lte))) {
      return false;
    }

    if (Number.isFinite(Number(range.gt)) && !(numericValue > Number(range.gt))) {
      return false;
    }

    if (Number.isFinite(Number(range.gte)) && !(numericValue >= Number(range.gte))) {
      return false;
    }

    if (range.equals !== undefined && value !== range.equals) {
      return false;
    }

    return true;
  }

  function firstClimateComponent() {
    return firstComponentByType('climate-environment');
  }

  function firstAnalogSourceComponent() {
    return firstComponentByType('analog-voltage-source');
  }

  function firstComponentByType(type) {
    return [...state.components.values()].find((component) => component.type === type) ?? null;
  }

  function relatedAnalogVoltage() {
    const source = firstAnalogSourceComponent();
    return source?.properties.enabled ? Number(source.properties.voltageVolts ?? 0) : 0;
  }

  function terminalNet(componentId, terminalId) {
    return (state.nets ?? []).find((net) => {
      return net.terminals?.some((terminal) => terminal.componentId === componentId && terminal.terminalId === terminalId);
    }) ?? null;
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
    applyVisualStateBindings,
    updateComponentProperty,
    syncComponentControls,
    adcInspectorLabel
  };
}
