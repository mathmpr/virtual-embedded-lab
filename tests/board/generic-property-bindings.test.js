import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponentBinder } from '../../apps/web/js/board/component-binder.js';
import { createComponentState } from '../../apps/web/js/board/component-state.js';
import { createInspectorPanel } from '../../apps/web/js/board/inspector-panel.js';
import { componentDefinitionFromManifest } from '../../apps/web/js/components.js';

test('inline controls update component properties through data-property generically', () => {
  const definition = fakeDefinition();
  const component = fakeComponent(definition);
  const input = fakeInput({ property: 'levelPercent', type: 'range', value: '80' });
  const element = fakeElement([input]);
  const updates = [];
  const componentState = {
    updateComponentProperty(target, propertyName, value, shouldRecord = false) {
      updates.push({ target, propertyName, value, shouldRecord });
      target.properties[propertyName] = value;
    }
  };
  const binder = createComponentBinder({
    state: { viewport: { scale: 1, isSpacePanning: false } },
    componentState,
    selectComponent() {},
    drawWires() {},
    renderInspector() {},
    recordHistory() {},
    handleTerminalClick() {},
    deleteComponent() {}
  });

  binder.bindComponent(element, component);
  input.dispatch('input');
  input.value = '90';
  input.dispatch('change');

  assert.deepEqual(updates.map((update) => [update.propertyName, update.value, update.shouldRecord]), [
    ['levelPercent', 80, false],
    ['levelPercent', 90, true]
  ]);
});

test('inspector controls update component properties through propertySchema generically', () => {
  const definition = fakeDefinition();
  const component = fakeComponent(definition);
  const input = fakeInput({ property: 'enabled', type: 'checkbox', checked: false });
  const inspectorContent = fakeInspectorContent([input]);
  const updates = [];
  const panel = createInspectorPanel({
    state: {
      selectedId: component.id,
      selectedNetId: null,
      components: new Map([[component.id, component]]),
      electrical: { componentReadings: new Map(), netReadings: new Map() }
    },
    inspectorContent,
    componentDefinitions: { [definition.type]: definition },
    getNets() {
      return [];
    },
    terminalKind() {
      return 'signal';
    },
    callbacks: {
      updateComponentProperty(target, propertyName, value, shouldRecord = false) {
        updates.push({ target, propertyName, value, shouldRecord });
      }
    }
  });

  panel.renderInspector();
  inspectorContent.controls.get('enabled').checked = true;
  inspectorContent.controls.get('enabled').dispatch('change');

  assert.deepEqual(updates.map((update) => [update.propertyName, update.value, update.shouldRecord]), [
    ['enabled', true, true]
  ]);
});

test('simple manifest component can render and bind without board-editor changes', () => {
  const definition = fakeDefinition();
  const calls = [];
  const state = {
    components: new Map(),
    running: false
  };
  const component = {
    id: 'simple-1',
    type: definition.type,
    properties: { ...definition.properties },
    element: fakeElement([
      fakeInput({ property: 'label', type: 'text', value: 'updated' })
    ])
  };
  state.components.set(component.id, component);
  const componentState = createComponentState({
    state,
    componentDefinitions: { [definition.type]: definition },
    simulation: {},
    renderSignals() {
      calls.push('signals');
    },
    recordHistory() {
      calls.push('history');
    },
    syncInspectorPropertyControls() {
      calls.push('inspector-sync');
    }
  });

  componentState.updateComponentProperty(component, 'label', 'updated', true);

  assert.equal(component.properties.label, 'updated');
  assert.deepEqual(calls, ['inspector-sync', 'signals', 'history']);
});

function fakeDefinition() {
  return componentDefinitionFromManifest({
    schemaVersion: '1.0.0',
    identity: { id: 'test.simple', name: 'Simple Fake', category: 'test' },
    simulation: { kind: 'visual-only', effects: [], implemented: true },
    properties: {
      enabled: { type: 'boolean', default: false, simulationUpdate: 'none' },
      levelPercent: { type: 'number', default: 50, minimum: 0, maximum: 100, unit: '%', simulationUpdate: 'live' },
      label: { type: 'string', default: 'fake', simulationUpdate: 'none' }
    },
    terminals: [{ id: 'sig', label: 'SIG', type: 'digital-io' }],
    visual: {
      type: 'simple-fake',
      title: 'Simple Fake',
      width: 100,
      height: 80,
      controls: [
        { type: 'range', property: 'levelPercent' },
        { type: 'checkbox', property: 'enabled' },
        { type: 'text', property: 'label' }
      ],
      terminals: [{ id: 'sig', side: 'right', x: 100, y: 40, kind: 'signal' }]
    }
  });
}

function fakeComponent(definition) {
  return {
    id: 'simple-1',
    type: definition.type,
    x: 0,
    y: 0,
    properties: { ...definition.properties },
    element: fakeElement()
  };
}

function fakeElement(inputs = []) {
  return {
    style: {},
    classList: { toggle() {} },
    addEventListener() {},
    setPointerCapture() {},
    querySelector(selector) {
      if (selector === '[data-delete-component]') {
        return { addEventListener() {} };
      }

      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-property]') {
        return inputs;
      }

      if (selector === '.terminal') {
        return [];
      }

      if (selector.startsWith('[data-property-output=')) {
        return [];
      }

      return [];
    }
  };
}

function fakeInspectorContent(inputs = []) {
  const content = {
    controls: new Map(inputs.map((input) => [input.dataset.property, input])),
    innerHTML: '',
    querySelectorAll(selector) {
      return selector === '[data-property]' ? [...this.controls.values()] : [];
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-property="([^"]+)"\]$/);
      return match ? this.controls.get(match[1]) ?? null : null;
    }
  };

  return content;
}

function fakeInput({ property, type, value = '', checked = false }) {
  const listeners = new Map();

  return {
    dataset: { property },
    type,
    value,
    checked,
    addEventListener(eventName, callback) {
      listeners.set(eventName, callback);
    },
    matches(selector) {
      return selector === `input[type="${type}"]`;
    },
    dispatch(eventName) {
      listeners.get(eventName)?.({ target: this, stopPropagation() {} });
    }
  };
}
