import { componentDefinitions, componentPalette, loadOfficialComponents, slugify, storageKey, terminalReference } from './components.js';
import { createCodeEditor } from './code-editor.js';
import { loadExampleList, loadExampleProject } from './examples.js';
import {
  areTerminalsConnected as areConnectedByNet,
  buildNets,
  findNetIdForTerminal,
  findNetIdForWire,
  hasTerminal,
  validateConnection
} from './nets.js';
import { boardToProject, projectCodeOrReference, projectToSnapshot } from './project-serializer.js';
import { createBottomPanelResizer } from './panel-resizer.js';
import { createVisualSimulation } from './visual-simulation.js';
import { renderComponentTemplate } from './board/component-template.js';
import {
  clamp,
  escapeHtml,
  formatCurrent,
  formatPower,
  formatPropertySignal,
  formatVoltage,
  labelFromPropertyName,
  normalizeAnalog,
  normalizeCurrent,
  normalizePower,
  normalizePropertySignal,
  normalizeVoltage
} from './board/formatters.js';
import { boardWorld, createInitialBoardState } from './board/state.js';
import { routeWire } from './board/wire-routing.js';

export function createBoardEditor(document) {
  const board = document.querySelector('#board');
  const boardViewport = document.querySelector('#boardViewport');
  const componentLayer = document.querySelector('#componentLayer');
  const wireLayer = document.querySelector('#wireLayer');
  const inspectorContent = document.querySelector('#inspectorContent');
  const codeEditor = createCodeEditor(document.querySelector('#codeEditor'), '// Carregando exemplo...\n');
  const consoleOutput = document.querySelector('#consoleOutput');
  const signalMonitor = document.querySelector('#signalMonitor');
  const serialMonitor = document.querySelector('#serialMonitor');
  const serialScrollContainer = serialMonitor;
  const problemList = document.querySelector('#problemList');

  const state = createInitialBoardState();

  const simulation = createVisualSimulation({
    state,
    renderSignals,
    renderSerial,
    renderProblems,
    consoleOutput,
    getNets,
    terminalKind,
    codeEditor,
    consumeSerialRx,
    clearSerialRx,
    appendSerialEvents,
    clearSerialHistory,
    onSimulationResult
  });

  async function start() {
    setupBoardSurface();
    renderSignals();
    renderSerial();
    renderProblems(['Circuito ainda não simulado.']);
    await loadComponents();
    renderPalette();
    bindPalette();
    bindToolbar();
    bindBottomTabs();
    bindSerialInput();
    bindBoardViewport();
    bindBoardDrop();
    bindResizer();
    await loadDefaultExample();
    recordHistory();
    window.addEventListener('resize', () => {
      centerViewportOnContent();
      drawWires();
    });
  }

  async function loadComponents() {
    try {
      await loadOfficialComponents();
    } catch (error) {
      renderProblems([error.message]);
      consoleOutput.textContent = `Falha ao carregar componentes oficiais: ${error.message}`;
      throw error;
    }
  }

  function setupBoardSurface() {
    wireLayer.setAttribute('viewBox', `0 0 ${boardWorld.width} ${boardWorld.height}`);
    wireLayer.setAttribute('width', String(boardWorld.width));
    wireLayer.setAttribute('height', String(boardWorld.height));
    applyViewportTransform();
  }

  function bindPalette() {
    document.querySelectorAll('.palette-item').forEach((item) => {
      item.draggable = true;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('component', item.dataset.component);
      });
      item.addEventListener('click', () => {
        const point = visibleCenterPoint();
        addComponent(item.dataset.component, point.x + state.components.size * 28, point.y + state.components.size * 24);
      });
    });
  }

  function renderPalette() {
    const paletteScroll = document.querySelector('.palette-scroll');
    const groups = new Map();

    for (const item of componentPalette) {
      const group = groups.get(item.group) ?? new Map();
      const subgroup = item.subgroup ?? '';
      const items = group.get(subgroup) ?? [];

      items.push(item);
      group.set(subgroup, items);
      groups.set(item.group, group);
    }

    const groupsHtml = [...groups.entries()].map(([groupName, subgroups]) => `
      <section class="palette-group">
        <div class="palette-group-title">${groupName}</div>
        ${[...subgroups.entries()].map(([subgroupName, items]) => `
          ${subgroupName ? `<div class="palette-subgroup-title">${subgroupName}</div>` : ''}
          ${items.map((item) => `
            <button class="palette-item" data-component="${item.type}">
              <span class="component-icon ${item.icon ?? 'component-default-icon'}"></span>
              ${item.title}
            </button>
          `).join('')}
        `).join('')}
      </section>
    `).join('');

    paletteScroll.innerHTML = `${groupsHtml}
      <div class="palette-hint">
        Arraste ou clique para inserir. Clique em terminais para criar fios.
      </div>
    `;
  }

  function bindToolbar() {
    document.querySelector('#startSimulation').addEventListener('click', simulation.runSimulation);
    document.querySelector('#pauseSimulation').addEventListener('click', simulation.pauseSimulation);
    document.querySelector('#resetSimulation').addEventListener('click', simulation.resetSimulation);
    document.querySelector('#clearBoard').addEventListener('click', clearBoard);
    document.querySelector('#openExamples').addEventListener('click', openExamplesDialog);
    document.querySelector('#undoBoard').addEventListener('click', undoBoard);
    document.querySelector('#redoBoard').addEventListener('click', redoBoard);
    document.querySelector('#saveProject').addEventListener('click', saveProjectToLocalStorage);
    document.querySelector('#loadSavedProject').addEventListener('click', loadProjectFromLocalStorage);
    document.querySelector('#exportProject').addEventListener('click', exportProjectFile);
    document.querySelector('#importProject').addEventListener('click', () => {
      document.querySelector('#projectFileInput').click();
    });
    document.querySelector('#projectFileInput').addEventListener('change', importProjectFile);
  }

  async function openExamplesDialog() {
    const dialog = document.querySelector('#examplesDialog');
    const examplesList = document.querySelector('#examplesList');

    examplesList.innerHTML = '<p class="muted">Carregando exemplos...</p>';
    dialog.showModal();

    try {
      const examples = await loadExampleList();

      examplesList.innerHTML = examples.length === 0
        ? '<p class="muted">Nenhum exemplo encontrado.</p>'
        : examples.map((example) => `
          <button class="example-card" value="${example.id}" data-example-id="${example.id}">
            <strong>${example.name}</strong>
            <span>${example.componentCount} componente(s)</span>
          </button>
        `).join('');

      examplesList.querySelectorAll('[data-example-id]').forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          await loadExampleById(button.dataset.exampleId);
          dialog.close();
        });
      });
    } catch (error) {
      examplesList.innerHTML = `<p class="muted">Falha ao carregar exemplos: ${escapeHtml(error.message)}</p>`;
    }
  }

  function bindBottomTabs() {
    document.querySelectorAll('[data-bottom-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        activateBottomPanel(tab.dataset.bottomTab);
      });
    });
  }

  function activateBottomPanel(panelName) {
    document.querySelectorAll('[data-bottom-tab]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.bottomTab === panelName);
    });
    document.querySelectorAll('[data-bottom-panel]').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.bottomPanel === panelName);
    });
  }

  function bindBoardDrop() {
    board.addEventListener('dragover', (event) => event.preventDefault());
    board.addEventListener('drop', (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('component');
      const point = toBoardPoint(event.clientX, event.clientY);
      addComponent(type, point.x, point.y);
    });
  }

  function bindResizer() {
    createBottomPanelResizer({
      shell: document.querySelector('.workspace-grid'),
      handle: document.querySelector('#bottomResizeHandle')
    });
  }

  function bindSerialInput() {
    const input = document.querySelector('#serialInput');
    const baudRate = document.querySelector('#serialBaudRate');
    const button = document.querySelector('#sendSerialInput');
    const clearButton = document.querySelector('#clearSerialHistory');
    const autoScrollButton = document.querySelector('#toggleSerialAutoScroll');
    const send = () => {
      const value = input.value;

      if (!value) {
        return;
      }

      state.serialRxQueue.push({
        data: value,
        baudRate: Number(baudRate.value)
      });
      appendSerialEvents([{
        direction: 'RX',
        type: 'data',
        baudRate: Number(baudRate.value),
        data: value,
        timeUs: 0
      }]);
      input.value = '';
    };

    button.addEventListener('click', send);
    autoScrollButton.addEventListener('click', () => {
      state.serialAutoScroll = !state.serialAutoScroll;
      syncSerialAutoScrollButton(autoScrollButton);
      if (state.serialAutoScroll) {
        scrollSerialToBottom();
      }
    });
    syncSerialAutoScrollButton(autoScrollButton);
    clearButton.addEventListener('click', () => {
      clearSerialRx();
      clearSerialHistory();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        send();
      }
    });
  }

  function addComponent(type, x, y, id = null) {
    const definition = componentDefinitions[type];

    if (!definition) {
      return null;
    }

    const componentId = id ?? nextComponentId(type);
    const element = document.createElement('div');
    element.className = `component ${definition.className}`;
    element.dataset.id = componentId;
    element.dataset.type = type;
    element.style.width = `${definition.width}px`;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.innerHTML = renderComponentTemplate(definition, componentId, variantsForProperty);

    componentLayer.append(element);

    const model = {
      id: componentId,
      type,
      electricalPrimitive: definition.electricalPrimitive,
      electricalModel: definition.electricalModel,
      behavior: definition.behavior ?? {},
      simulation: definition.simulation ?? {},
      propertySchema: definition.propertySchema ?? {},
      x,
      y,
      properties: { ...(definition.properties ?? {}) },
      element
    };

    state.components.set(componentId, model);
    syncComponentCounter(componentId);
    bindComponent(element, model);
    selectComponent(componentId);
    drawWires();
    recordHistory();

    return model;
  }

  function variantsForProperty(componentType, propertyName) {
    return componentDefinitions[componentType]?.variants?.[propertyName] ?? [];
  }

  function bindComponent(element, model) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    element.addEventListener('pointerdown', (event) => {
      if (state.viewport.isSpacePanning) {
        return;
      }

      if (event.target.closest('.terminal, input, textarea, select, [data-delete-component]')) {
        return;
      }

      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = model.x;
      originY = model.y;
      element.setPointerCapture(event.pointerId);
      selectComponent(model.id);
    });

    element.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }

      model.x = Math.max(0, originX + (event.clientX - startX) / state.viewport.scale);
      model.y = Math.max(0, originY + (event.clientY - startY) / state.viewport.scale);
      element.style.left = `${model.x}px`;
      element.style.top = `${model.y}px`;
      drawWires();
      renderInspector();
    });

    element.addEventListener('pointerup', () => {
      if (dragging && (model.x !== originX || model.y !== originY)) {
        recordHistory();
      }

      dragging = false;
    });

    element.querySelectorAll('.terminal').forEach((terminalElement) => {
      terminalElement.addEventListener('pointerdown', (event) => {
        if (state.viewport.isSpacePanning) {
          return;
        }

        event.stopPropagation();
      });

      terminalElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (state.viewport.suppressNextClick) {
          state.viewport.suppressNextClick = false;
          return;
        }

        handleTerminalClick(model.id, terminalElement.dataset.terminal);
      });
    });

    element.querySelector('[data-delete-component]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteComponent(model.id);
    });

    const slider = element.querySelector('[data-distance-slider]');
    const output = element.querySelector('[data-distance-output]');

    if (slider && output) {
      slider.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });

      slider.addEventListener('input', () => {
        updateDistanceValue(model, Number(slider.value));
      });

      slider.addEventListener('change', () => {
        recordHistory();
      });
    }

    const resistorSelect = element.querySelector('[data-resistor-select]');

    if (resistorSelect) {
      resistorSelect.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      resistorSelect.addEventListener('change', () => {
        updateResistorValue(model, Number(resistorSelect.value), true);
      });
    }

    const capacitorSelect = element.querySelector('[data-capacitor-select]');

    if (capacitorSelect) {
      capacitorSelect.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      capacitorSelect.addEventListener('change', () => {
        updateCapacitorValue(model, Number(capacitorSelect.value), true);
      });
    }

    const wifiSlider = element.querySelector('[data-wifi-slider]');
    const wifiConnected = element.querySelector('[data-wifi-connected]');

    if (wifiSlider) {
      wifiSlider.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      wifiSlider.addEventListener('input', () => {
        updateWifiStrength(model, Number(wifiSlider.value));
      });
      wifiSlider.addEventListener('change', () => {
        recordHistory();
      });
    }

    if (wifiConnected) {
      wifiConnected.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      wifiConnected.addEventListener('change', () => {
        updateWifiInternetAvailable(model, wifiConnected.checked, true);
      });
    }

    const rainActive = element.querySelector('[data-rain-active]');
    const rainIntensity = element.querySelector('[data-rain-intensity]');

    if (rainActive) {
      rainActive.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      rainActive.addEventListener('change', () => {
        updateRainActive(model, rainActive.checked, true);
      });
    }

    if (rainIntensity) {
      rainIntensity.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      rainIntensity.addEventListener('input', () => {
        updateRainIntensity(model, Number(rainIntensity.value));
      });
      rainIntensity.addEventListener('change', () => {
        recordHistory();
      });
    }

    const lightEnabled = element.querySelector('[data-light-enabled]');
    const lightIntensity = element.querySelector('[data-light-intensity]');

    if (lightEnabled) {
      lightEnabled.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      lightEnabled.addEventListener('change', () => {
        updateLightEnabled(model, lightEnabled.checked, true);
      });
    }

    if (lightIntensity) {
      lightIntensity.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      lightIntensity.addEventListener('input', () => {
        updateLightIntensity(model, Number(lightIntensity.value));
      });
      lightIntensity.addEventListener('change', () => {
        recordHistory();
      });
    }

    const climateEnabled = element.querySelector('[data-climate-enabled]');
    const climateTemperature = element.querySelector('[data-climate-temperature]');
    const climatePressure = element.querySelector('[data-climate-pressure]');

    if (climateEnabled) {
      climateEnabled.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      climateEnabled.addEventListener('change', () => {
        updateClimateEnabled(model, climateEnabled.checked, true);
      });
    }

    if (climateTemperature) {
      climateTemperature.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      climateTemperature.addEventListener('input', () => {
        updateClimateTemperature(model, Number(climateTemperature.value));
      });
      climateTemperature.addEventListener('change', () => {
        recordHistory();
      });
    }

    if (climatePressure) {
      climatePressure.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      climatePressure.addEventListener('input', () => {
        updateClimatePressure(model, Number(climatePressure.value));
      });
      climatePressure.addEventListener('change', () => {
        recordHistory();
      });
    }

    const analogEnabled = element.querySelector('[data-analog-enabled]');
    const analogVoltage = element.querySelector('[data-analog-voltage]');

    if (analogEnabled) {
      analogEnabled.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      analogEnabled.addEventListener('change', () => {
        updateAnalogEnabled(model, analogEnabled.checked, true);
      });
    }

    if (analogVoltage) {
      analogVoltage.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      analogVoltage.addEventListener('input', () => {
        updateAnalogVoltage(model, Number(analogVoltage.value));
      });
      analogVoltage.addEventListener('change', () => {
        recordHistory();
      });
    }
  }

  function handleTerminalClick(componentId, terminalId) {
    const terminal = { componentId, terminalId };

    document.querySelectorAll('.terminal.pending').forEach((item) => item.classList.remove('pending'));

    if (!state.pendingTerminal) {
      state.pendingTerminal = terminal;
      state.selectedNetId = findNetIdForTerminal(state.wires, terminalKind, terminal);
      getTerminalElement(terminal)?.classList.add('pending');
      renderInspector();
      return;
    }

    if (state.pendingTerminal.componentId !== componentId || state.pendingTerminal.terminalId !== terminalId) {
      const problem = validateConnection(state.wires, terminalKind, state.pendingTerminal, terminal);

      if (problem) {
        renderProblems([problem]);
        state.pendingTerminal = null;
        drawWires();
        renderInspector();
        return;
      }

      state.wires.push({
        id: `wire-${state.nextWireId++}`,
        from: state.pendingTerminal,
        to: terminal,
        color: inferWireColor(state.pendingTerminal, terminal)
      });
      state.selectedNetId = findNetIdForTerminal(state.wires, terminalKind, terminal);
      recordHistory();
    }

    state.pendingTerminal = null;
    drawWires();
    renderInspector();
  }

  function drawWires() {
    wireLayer.innerHTML = '';

    for (const wire of state.wires) {
      const from = terminalPoint(wire.from);
      const to = terminalPoint(wire.to);
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const deleteButton = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const deleteCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const deleteText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const route = routeWire({
        fromTerminal: wire.from,
        toTerminal: wire.to,
        from,
        to,
        terminalDefinition,
        componentById: (componentId) => state.components.get(componentId),
        components: () => state.components.values()
      });

      group.setAttribute('class', 'wire-group');
      group.dataset.wireId = wire.id;
      group.dataset.netId = findNetIdForWire(state.wires, terminalKind, wire) ?? '';
      group.style.setProperty('--wire-color', wire.color ?? inferWireColor(wire.from, wire.to));
      group.addEventListener('click', (event) => {
        event.stopPropagation();
        selectNet(group.dataset.netId);
      });
      hitPath.setAttribute('class', 'wire-hit');
      hitPath.setAttribute('d', route.d);
      path.setAttribute('class', 'wire');
      path.setAttribute('d', route.d);
      deleteButton.setAttribute('class', 'delete-wire');
      deleteButton.setAttribute('transform', `translate(${route.midpoint.x} ${route.midpoint.y})`);
      deleteCircle.setAttribute('r', '10');
      deleteText.setAttribute('text-anchor', 'middle');
      deleteText.setAttribute('dominant-baseline', 'central');
      deleteText.textContent = '×';

      deleteButton.append(deleteCircle, deleteText);
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteWire(wire.id);
      });

      group.append(hitPath, path, deleteButton);
      wireLayer.append(group);
    }
  }

  function terminalPoint(terminal) {
    const element = getTerminalElement(terminal);

    if (element) {
      const bounds = element.getBoundingClientRect();
      return screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }

    const component = state.components.get(terminal.componentId);
    const definition = componentDefinitions[component?.type];
    const terminalDefinition = definition?.terminals.find((item) => item.id === terminal.terminalId);

    if (!component || !terminalDefinition) {
      return { x: 0, y: 0 };
    }

    return {
      x: component.x + terminalDefinition.x,
      y: component.y + terminalDefinition.y
    };
  }

  function getTerminalElement(terminal) {
    return document.querySelector(`[data-id="${terminal.componentId}"] [data-terminal="${terminal.terminalId}"]`);
  }

  function selectComponent(componentId) {
    state.selectedId = componentId;
    state.selectedNetId = null;
    document.querySelectorAll('.component.selected').forEach((item) => item.classList.remove('selected'));
    state.components.get(componentId)?.element.classList.add('selected');
    document.querySelectorAll('.wire-group.selected').forEach((item) => item.classList.remove('selected'));
    renderInspector();
    renderSignals();
  }

  function selectNet(netId) {
    state.selectedId = null;
    state.selectedNetId = netId || null;
    document.querySelectorAll('.component.selected').forEach((item) => item.classList.remove('selected'));
    document.querySelectorAll('.wire-group').forEach((item) => {
      item.classList.toggle('selected', item.dataset.netId === netId);
    });
    renderInspector();
    renderSignals();
  }

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
      updateDistanceValue(component, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.electricalPrimitive === 'resistor' && propertyName === definition.electricalModel?.resistanceProperty) {
      updateResistorValue(component, normalizedValue, shouldRecord);
      return;
    }

    if (definition?.electricalPrimitive === 'capacitor' && propertyName === definition.electricalModel?.capacitanceProperty) {
      updateCapacitorValue(component, normalizedValue, shouldRecord);
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
      updateLdrProperty(component, propertyName, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.behavior?.type === 'bmp280-sensor') {
      updateBmp280Property(component, propertyName, normalizedValue, shouldRecord);
      syncInspectorPropertyControls(component);
      return;
    }

    if (definition?.behavior?.type === 'adc-i2c' || definition?.behavior?.type === 'adc-spi') {
      updateAdcProperty(component, propertyName, normalizedValue, shouldRecord);
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
      updateWifiStrength(component, value, shouldRecord);
      return;
    }

    if (propertyName === 'connected') {
      updateWifiInternetAvailable(component, value, shouldRecord);
      return;
    }

    if (propertyName === 'ssid') {
      updateWifiSsid(component, value, shouldRecord);
      return;
    }

    component.properties[propertyName] = value;
    syncInspectorPropertyControls(component);
  }

  function updateEnvironmentSourceProperty(component, propertyName, value, shouldRecord) {
    const definition = componentDefinitions[component.type];
    component.properties[propertyName] = value;
    syncEnvironmentControl(component);
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
        simulation.updateClimateValue(component.id, climatePayload(component));
        applyBmp280SensorStates();
      }
    }

    if (shouldRecord) {
      recordHistory();
    }
  }

  function updateAnalogSourceProperty(component, propertyName, value, shouldRecord) {
    component.properties[propertyName] = value;
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

  async function loadDefaultExample() {
    try {
      await loadExampleById('hc-sr04-led-distance', false);
    } catch (error) {
      codeEditor.value = '';
      renderProblems([`Falha ao carregar exemplo default: ${error.message}`]);
      consoleOutput.textContent = 'Nenhum projeto carregado.';
    }
  }

  async function loadExampleById(exampleId, shouldRecord = true) {
    const project = await loadExampleProject(exampleId);
    restoreProject(project, shouldRecord);
  }

  function clearBoard() {
    const shouldRecord = state.components.size > 0 && !state.isRestoring;
    state.components.clear();
    state.wires = [];
    state.selectedId = null;
    state.selectedNetId = null;
    state.pendingTerminal = null;
    state.nextComponentId = 1;
    state.nextWireId = 1;
    componentLayer.querySelectorAll('.component').forEach((item) => item.remove());
    drawWires();
    centerViewportOnContent();
    renderInspector();
    if (shouldRecord) {
      recordHistory();
    }
  }

  function deleteComponent(componentId) {
    const component = state.components.get(componentId);

    if (!component) {
      return;
    }

    component.element.remove();
    state.components.delete(componentId);
    state.wires = state.wires.filter((wire) => wire.from.componentId !== componentId && wire.to.componentId !== componentId);

    if (state.selectedId === componentId) {
      state.selectedId = null;
    }

    if (state.selectedNetId && !getNets().some((net) => net.id === state.selectedNetId)) {
      state.selectedNetId = null;
    }

    if (state.pendingTerminal?.componentId === componentId) {
      state.pendingTerminal = null;
    }

    drawWires();
    renderInspector();
    simulation.resetSimulation();
    recordHistory();
  }

  function deleteWire(wireId) {
    const before = state.wires.length;
    state.wires = state.wires.filter((wire) => wire.id !== wireId);

    if (state.wires.length === before) {
      return;
    }

    drawWires();
    if (state.selectedNetId && !getNets().some((net) => net.id === state.selectedNetId)) {
      state.selectedNetId = null;
    }
    renderInspector();
    simulation.resetSimulation();
    recordHistory();
  }

  function serializeBoard() {
    return {
      components: [...state.components.values()].map((component) => ({
        id: component.id,
        type: component.type,
        x: component.x,
        y: component.y,
        properties: { ...component.properties }
      })),
      wires: state.wires.map((wire) => ({
        id: wire.id,
        from: { ...wire.from },
        to: { ...wire.to },
        color: wire.color
      })),
      nextComponentId: state.nextComponentId,
      nextWireId: state.nextWireId,
      selectedId: state.selectedId,
      selectedNetId: state.selectedNetId
    };
  }

  function restoreBoard(snapshot) {
    state.isRestoring = true;
    state.components.clear();
    state.wires = [];
    state.pendingTerminal = null;
    componentLayer.querySelectorAll('.component').forEach((item) => item.remove());

    for (const component of snapshot.components) {
      const restored = addComponent(component.type, component.x, component.y, component.id);
      restored.properties = { ...component.properties };
      syncDistanceControl(restored);
      syncResistorControl(restored);
      syncCapacitorControl(restored);
      syncWifiSignalControl(restored);
    }

    state.wires = snapshot.wires.map((wire) => ({
      id: wire.id,
      from: { ...wire.from },
      to: { ...wire.to },
      color: wire.color
    }));
    state.nextComponentId = snapshot.nextComponentId;
    state.nextWireId = snapshot.nextWireId;
    state.selectedId = snapshot.selectedId;
    state.selectedNetId = snapshot.selectedNetId;
    state.isRestoring = false;

    drawWires();
    centerViewportOnContent();
    selectComponent(state.selectedId);
    simulation.resetSimulation();
  }

  function recordHistory() {
    if (state.isRestoring) {
      return;
    }

    const snapshot = serializeBoard();
    const serialized = JSON.stringify(snapshot);
    const last = state.history[state.history.length - 1];

    if (last && JSON.stringify(last) === serialized) {
      return;
    }

    state.history.push(snapshot);
    state.redoStack = [];
    updateHistoryButtons();
  }

  function undoBoard() {
    if (state.history.length <= 1) {
      return;
    }

    const current = state.history.pop();
    state.redoStack.push(current);
    restoreBoard(state.history[state.history.length - 1]);
    updateHistoryButtons();
  }

  function redoBoard() {
    const next = state.redoStack.pop();

    if (!next) {
      return;
    }

    state.history.push(next);
    restoreBoard(next);
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    document.querySelector('#undoBoard').disabled = state.history.length <= 1;
    document.querySelector('#redoBoard').disabled = state.redoStack.length === 0;
  }

  function saveProjectToLocalStorage() {
    const project = currentProject();
    localStorage.setItem(storageKey, JSON.stringify(project));
    consoleOutput.textContent = `Projeto salvo no navegador: ${project.components.length} componentes, ${project.connections.length} conexoes eletricas, ${project.environmentConnections.length} conexoes ambientais.`;
  }

  function loadProjectFromLocalStorage() {
    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      renderProblems(['Nenhum projeto salvo no navegador.']);
      return;
    }

    try {
      restoreProject(JSON.parse(saved));
    } catch (error) {
      renderProblems([`Falha ao carregar projeto salvo: ${error.message}`]);
    }
  }

  function exportProjectFile() {
    const project = currentProject();
    const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${slugify(project.name)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    consoleOutput.textContent = 'Projeto exportado como JSON.';
  }

  async function importProjectFile(event) {
    const [file] = event.target.files;
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const project = JSON.parse(await file.text());
      restoreProject(project);
    } catch (error) {
      renderProblems([`Falha ao importar projeto: ${error.message}`]);
    }
  }

  function restoreProject(project, shouldRecord = true) {
    codeEditor.value = projectCodeOrReference(project);
    restoreBoard(projectToSnapshot(project));

    if (shouldRecord) {
      recordHistory();
    }

    consoleOutput.textContent = `Projeto carregado: ${project.name}`;
  }

  function currentProject() {
    return boardToProject({
      state,
      board,
      codeEditor,
      nets: getNets(),
      terminalKind
    });
  }

  function renderSignals() {
    const component = state.components.get(state.selectedId);

    if (!component) {
      signalMonitor.innerHTML = '<p class="muted">Selecione um componente para ver sinais derivados das conexões.</p>';
      return;
    }

    const cards = [
      propertySignalCard(component),
      terminalSignalCard(component),
      electricalSignalCard(component)
    ].filter(Boolean);

    signalMonitor.innerHTML = cards.length > 0
      ? cards.join('')
      : '<p class="muted">Este componente ainda não possui sinais derivados do projeto.</p>';
  }

  function propertySignalCard(component) {
    const rows = Object.entries(component.properties ?? {})
      .filter(([, value]) => typeof value === 'boolean' || Number.isFinite(Number(value)))
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return signalRow(labelFromPropertyName(key), value ? 1 : 0, value ? 'ON' : 'OFF');
        }

        return signalRow(labelFromPropertyName(key), normalizePropertySignal(key, Number(value)), formatPropertySignal(key, Number(value)));
      });

    return rows.length > 0 ? signalCard('Propriedades', rows) : null;
  }

  function terminalSignalCard(component) {
    const definition = componentDefinitions[component.type];
    const rows = (definition?.terminals ?? []).map((terminal) => terminalSignalRow(component, terminal));

    return rows.length > 0 ? signalCard('Terminais e conexões', rows) : null;
  }

  function terminalSignalRow(component, terminal) {
    const terminalRef = { componentId: component.id, terminalId: terminal.id };
    const net = netForTerminal(terminalRef);
    const signal = signalForTerminalNet(terminalRef, net);
    const connected = connectedTerminalLabels(component.id, net);
    const label = `${terminal.label ?? terminal.id}${connected ? ` -> ${connected}` : ''}`;

    return signalRow(label, signal.value, signal.text);
  }

  function electricalSignalCard(component) {
    const reading = state.electrical.componentReadings.get(component.id);

    if (!reading) {
      return null;
    }

    return signalCard('Elétrico', [
      signalRow('Tensão', normalizeVoltage(reading.voltageVolts), formatVoltage(reading.voltageVolts)),
      signalRow('Corrente', normalizeCurrent(reading.currentAmps), formatCurrent(reading.currentAmps)),
      signalRow('Potência', normalizePower(reading.powerWatts), formatPower(reading.powerWatts))
    ]);
  }

  function signalForTerminalNet(terminal, net) {
    const directRuntime = runtimeSignalForTerminal(terminal);

    if (directRuntime) {
      return directRuntime;
    }

    const netRuntime = runtimeSignalForNet(net);

    if (netRuntime) {
      return netRuntime;
    }

    const reading = net ? state.electrical.netReadings.get(net.id) : null;

    if (reading) {
      return {
        value: normalizeVoltage(reading.voltageVolts),
        text: reading.voltageVolts === null ? reading.state : `${formatVoltage(reading.voltageVolts)} / ${reading.state}`
      };
    }

    const kind = terminalKind(terminal);

    if (kind === 'power') {
      return { value: 1, text: 'VCC' };
    }

    if (kind === 'ground') {
      return { value: 0, text: 'GND' };
    }

    return {
      value: 0,
      text: net ? 'conectado' : 'desconectado'
    };
  }

  function runtimeSignalForNet(net) {
    if (!net) {
      return null;
    }

    for (const terminal of net.terminals) {
      const signal = runtimeSignalForTerminal(terminal);

      if (signal) {
        return signal;
      }
    }

    return null;
  }

  function runtimeSignalForTerminal(terminal) {
    const digitalPin = digitalPinFromTerminal(terminal);

    if (Number.isInteger(digitalPin) && state.runtime.pinStates[digitalPin]) {
      const pin = state.runtime.pinStates[digitalPin];
      const value = pin.value === 'HIGH' ? 1 : 0;
      return { value, text: `${pin.value} / ${pin.mode}` };
    }

    const analogPin = analogPinFromTerminal(terminal);

    if (Number.isInteger(analogPin) && state.runtime.analogPinStates[analogPin]) {
      const analog = state.runtime.analogPinStates[analogPin];
      return {
        value: normalizeAnalog(analog.value),
        text: `${analog.value} / ${formatVoltage(analog.voltageVolts)}`
      };
    }

    return null;
  }

  function connectedTerminalLabels(componentId, net) {
    if (!net) {
      return '';
    }

    return net.terminals
      .filter((terminal) => terminal.componentId !== componentId)
      .slice(0, 3)
      .map((terminal) => terminalReference(terminal))
      .join(', ');
  }

  function netForTerminal(terminal) {
    return getNets().find((net) => {
      return net.terminals.some((item) => item.componentId === terminal.componentId && item.terminalId === terminal.terminalId);
    }) ?? null;
  }

  function digitalPinFromTerminal(terminal) {
    const match = terminal.terminalId.match(/^d(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function analogPinFromTerminal(terminal) {
    const arduinoMatch = terminal.terminalId.match(/^a([0-5])$/);

    if (arduinoMatch) {
      return 14 + Number(arduinoMatch[1]);
    }

    const espMatch = terminal.terminalId.match(/^io(\d+)$/);
    return espMatch ? Number(espMatch[1]) : null;
  }

  function signalCard(title, rows) {
    return `
      <div class="signal-card">
        <div class="signal-card-title">${title}</div>
        ${rows.join('')}
      </div>
    `;
  }

  function signalRow(label, value, text = null) {
    const normalizedValue = Math.max(0, Math.min(1, Number(value) || 0));

    return `
      <div class="signal-row">
        <span>${label}</span>
        <div class="signal-track"><div class="signal-fill" style="width:${Math.round(normalizedValue * 100)}%"></div></div>
        <span class="signal-value">${text ?? (value ? 'HIGH' : 'LOW')}</span>
      </div>
    `;
  }

  function renderSerial() {
    const events = state.serialHistory;

    if (events.length === 0) {
      serialMonitor.innerHTML = '<p class="muted">Nenhuma mensagem serial.</p>';
      return;
    }

    serialMonitor.innerHTML = events.map((event) => `
      <div class="serial-row">
        <span class="serial-direction ${event.direction.toLowerCase()}">${event.direction}</span>
        <span class="serial-meta">${event.baudRate ?? 'no baud'}<br>${event.timeUs} us</span>
        <span class="serial-data">${escapeHtml(event.data)}</span>
      </div>
    `).join('');

    if (state.serialAutoScroll) {
      scrollSerialToBottom();
    }
  }

  function scrollSerialToBottom() {
    requestAnimationFrame(() => {
      serialScrollContainer.scrollTop = serialScrollContainer.scrollHeight;
    });
  }

  function syncSerialAutoScrollButton(button) {
    button.classList.toggle('active', state.serialAutoScroll);
    button.setAttribute('aria-pressed', String(state.serialAutoScroll));
    button.setAttribute('aria-label', `Auto-scroll Serial ${state.serialAutoScroll ? 'ativado' : 'desativado'}`);
    button.title = `Auto-scroll Serial ${state.serialAutoScroll ? 'ativado' : 'desativado'}`;
  }

  function renderProblems(problems) {
    problemList.innerHTML = problems.map((problem) => `<li>${problem}</li>`).join('');
  }

  function consumeSerialRx() {
    const messages = [...state.serialRxQueue];
    state.serialRxQueue = [];
    return messages;
  }

  function clearSerialRx() {
    state.serialRxQueue = [];
  }

  function appendSerialEvents(events) {
    const maxEvents = 1000;
    state.serialHistory.push(...events);

    if (state.serialHistory.length > maxEvents) {
      state.serialHistory.splice(0, state.serialHistory.length - maxEvents);
    }

    renderSerial();
  }

  function clearSerialHistory() {
    state.serialHistory = [];
    renderSerial();
  }

  function onSimulationResult(result) {
    state.electrical = {
      componentReadings: result.electrical?.componentReadings ?? new Map(),
      netReadings: result.electrical?.netReadings ?? new Map()
    };
    state.runtime = {
      pinStates: result.firmwareResult?.pinStates ?? {},
      analogPinStates: result.firmwareResult?.analogPinStates ?? {}
    };
    applyRainSensorStates();
    applyLdrSensorStates();
    applyBmp280SensorStates();
    applyAdcStates();
    renderInspector();
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

  function getNets() {
    return buildNets(state.wires, terminalKind);
  }

  function areTerminalsConnected(left, right) {
    return areConnectedByNet(state.wires, terminalKind, left, right);
  }

  function terminalKind(terminal) {
    const component = state.components.get(terminal.componentId);
    const definition = componentDefinitions[component?.type];
    return definition?.terminals.find((item) => item.id === terminal.terminalId)?.kind ?? 'signal';
  }

  function terminalDefinition(terminal) {
    const component = state.components.get(terminal.componentId);
    const definition = componentDefinitions[component?.type];
    return definition?.terminals.find((item) => item.id === terminal.terminalId) ?? null;
  }

  function inferWireColor(from, to) {
    const kinds = [terminalKind(from), terminalKind(to)];

    if (kinds.includes('power')) {
      return '#f05252';
    }

    if (kinds.includes('ground')) {
      return '#f5f7fa';
    }

    if (kinds.includes('environment')) {
      return '#6fbf73';
    }

    return '#4c8dff';
  }

  function isLedComponent(component) {
    return component?.electricalPrimitive === 'led' || component?.type === 'led';
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

  function firstClimateComponent() {
    return [...state.components.values()].find((component) => component.type === 'climate-environment') ?? null;
  }

  function analogPayload(component) {
    return {
      enabled: component.properties.enabled,
      voltageVolts: component.properties.voltageVolts
    };
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

  function nextComponentId(type) {
    let id = `${type}-${state.nextComponentId}`;

    while (state.components.has(id)) {
      state.nextComponentId += 1;
      id = `${type}-${state.nextComponentId}`;
    }

    state.nextComponentId += 1;
    return id;
  }

  function syncComponentCounter(componentId) {
    const match = componentId.match(/-(\d+)$/);

    if (!match) {
      return;
    }

    state.nextComponentId = Math.max(state.nextComponentId, Number(match[1]) + 1);
  }

  function toBoardPoint(clientX, clientY) {
    return screenToWorld(clientX, clientY);
  }

  function bindBoardViewport() {
    board.addEventListener('wheel', handleBoardWheel, { passive: false });
    board.addEventListener('pointerdown', startViewportPan);
    board.addEventListener('pointermove', moveViewportPan);
    board.addEventListener('pointerup', stopViewportPan);
    board.addEventListener('pointercancel', stopViewportPan);
    window.addEventListener('keydown', handlePanKeyDown);
    window.addEventListener('keyup', handlePanKeyUp);
    window.addEventListener('blur', stopSpacePanning);
  }

  function handleBoardWheel(event) {
    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
    const nextScale = clamp(state.viewport.scale * zoomFactor, boardWorld.minScale, boardWorld.maxScale);

    if (nextScale === state.viewport.scale) {
      return;
    }

    const bounds = board.getBoundingClientRect();
    const mouse = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
    const worldBefore = screenToWorld(event.clientX, event.clientY);

    state.viewport.scale = nextScale;
    state.viewport.x = mouse.x - worldBefore.x * nextScale;
    state.viewport.y = mouse.y - worldBefore.y * nextScale;
    applyViewportTransform();
  }

  function startViewportPan(event) {
    if (!state.viewport.isSpacePanning) {
      return;
    }

    event.preventDefault();
    state.viewport.isPanning = true;
    state.viewport.startClientX = event.clientX;
    state.viewport.startClientY = event.clientY;
    state.viewport.startX = state.viewport.x;
    state.viewport.startY = state.viewport.y;
    board.setPointerCapture(event.pointerId);
    updatePanClasses();
  }

  function moveViewportPan(event) {
    if (!state.viewport.isPanning) {
      return;
    }

    state.viewport.x = state.viewport.startX + event.clientX - state.viewport.startClientX;
    state.viewport.y = state.viewport.startY + event.clientY - state.viewport.startClientY;
    applyViewportTransform();
  }

  function stopViewportPan(event) {
    if (!state.viewport.isPanning) {
      return;
    }

    state.viewport.isPanning = false;
    suppressTransientClick();
    if (event.pointerId !== undefined && board.hasPointerCapture(event.pointerId)) {
      board.releasePointerCapture(event.pointerId);
    }
    updatePanClasses();
  }

  function handlePanKeyDown(event) {
    if (event.code !== 'Space' || shouldIgnorePanShortcut(event)) {
      return;
    }

    event.preventDefault();
    state.viewport.isSpacePanning = true;
    updatePanClasses();
  }

  function handlePanKeyUp(event) {
    if (event.code !== 'Space') {
      return;
    }

    stopSpacePanning();
  }

  function stopSpacePanning() {
    const wasPanning = state.viewport.isPanning;

    state.viewport.isSpacePanning = false;
    state.viewport.isPanning = false;
    if (wasPanning) {
      suppressTransientClick();
    }
    updatePanClasses();
  }

  function suppressTransientClick() {
    state.viewport.suppressNextClick = true;
    window.setTimeout(() => {
      state.viewport.suppressNextClick = false;
    }, 0);
  }

  function shouldIgnorePanShortcut(event) {
    const target = event.target;

    return target?.closest?.('.cm-editor, input, textarea, select, button');
  }

  function updatePanClasses() {
    board.classList.toggle('space-panning', state.viewport.isSpacePanning);
    board.classList.toggle('panning', state.viewport.isPanning);
  }

  function centerViewportOnContent() {
    const contentBounds = contentWorldBounds();
    const bounds = board.getBoundingClientRect();

    state.viewport.scale = 1;
    state.viewport.x = bounds.width / 2 - (contentBounds.x + contentBounds.width / 2);
    state.viewport.y = bounds.height / 2 - (contentBounds.y + contentBounds.height / 2);
    applyViewportTransform();
  }

  function contentWorldBounds() {
    if (state.components.size === 0) {
      return {
        x: boardWorld.width / 2,
        y: boardWorld.height / 2,
        width: 0,
        height: 0
      };
    }

    const boxes = [...state.components.values()].map((component) => ({
      x: component.x,
      y: component.y,
      width: component.element.offsetWidth || 140,
      height: component.element.offsetHeight || 100
    }));
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function screenToWorld(clientX, clientY) {
    const bounds = board.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - state.viewport.x) / state.viewport.scale,
      y: (clientY - bounds.top - state.viewport.y) / state.viewport.scale
    };
  }

  function visibleCenterPoint() {
    const bounds = board.getBoundingClientRect();

    return screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  }

  function applyViewportTransform() {
    boardViewport.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  }

  return {
    start
  };
}
