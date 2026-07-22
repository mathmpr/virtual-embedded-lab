import { componentDefinitions, componentPalette, loadOfficialComponents } from './components.js';
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
import { createBottomPanelResizer } from './panel-resizer.js';
import { createVisualSimulation } from './visual-simulation.js';
import { createComponentState } from './board/component-state.js';
import { renderComponentTemplate } from './board/component-template.js';
import { escapeHtml } from './board/formatters.js';
import { createInspectorPanel } from './board/inspector-panel.js';
import { createProjectActions } from './board/project-actions.js';
import { createSerialPanel } from './board/serial-panel.js';
import { createSignalsPanel } from './board/signals-panel.js';
import { boardWorld, createInitialBoardState } from './board/state.js';
import { createViewportController } from './board/viewport-controller.js';
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
  const problemList = document.querySelector('#problemList');

  const state = createInitialBoardState();
  const serialPanel = createSerialPanel({ document, state, serialMonitor });
  const viewport = createViewportController({
    board,
    boardViewport,
    state,
    getComponents: () => state.components.values()
  });
  const {
    bindBoardViewport,
    toBoardPoint,
    visibleCenterPoint,
    centerViewportOnContent,
    screenToWorld,
    applyViewportTransform
  } = viewport;
  const {
    bindSerialInput,
    renderSerial,
    consumeSerialRx,
    clearSerialRx,
    appendSerialEvents,
    clearSerialHistory
  } = serialPanel;
  const { renderSignals } = createSignalsPanel({
    state,
    signalMonitor,
    componentDefinitions,
    getNets,
    terminalKind
  });

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
  const componentState = createComponentState({
    state,
    componentDefinitions,
    simulation,
    renderSignals,
    renderInspector: (...args) => renderInspector(...args),
    recordHistory: (...args) => recordHistory(...args),
    syncInspectorPropertyControls: (...args) => syncInspectorPropertyControls(...args)
  });
  const {
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
    syncAnalogControl,
    syncDistanceControl,
    syncResistorControl,
    syncCapacitorControl,
    syncWifiSignalControl,
    syncRainControl,
    syncLightControl,
    syncClimateControl,
    climatePayload,
    analogPayload,
    adcInspectorLabel
  } = componentState;
  const { renderInspector, syncInspectorPropertyControls } = createInspectorPanel({
    state,
    inspectorContent,
    componentDefinitions,
    getNets,
    terminalKind,
    renderSignals,
    recordHistory: (...args) => recordHistory(...args),
    simulation,
    callbacks: {
      updateDistanceValue,
      updateResistorValue,
      updateCapacitorValue,
      updateWifiStrength,
      updateWifiInternetAvailable,
      updateWifiSsid,
      updateLdrProperty,
      updateBmp280Property,
      updateAdcProperty,
      syncEnvironmentControl,
      syncAnalogControl,
      climatePayload,
      analogPayload,
      applyBmp280SensorStates,
      applyAdcStates
    }
  });
  const {
    clearBoard,
    deleteComponent,
    deleteWire,
    recordHistory,
    undoBoard,
    redoBoard,
    saveProjectToLocalStorage,
    loadProjectFromLocalStorage,
    exportProjectFile,
    importProjectFile,
    restoreProject,
    currentProject
  } = createProjectActions({
    document,
    state,
    board,
    componentLayer,
    codeEditor,
    consoleOutput,
    addComponent,
    drawWires,
    getNets,
    terminalKind,
    centerViewportOnContent,
    renderInspector,
    renderProblems,
    selectComponent,
    simulation,
    syncRestoredComponentControls
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

  function renderProblems(problems) {
    problemList.innerHTML = problems.map((problem) => `<li>${problem}</li>`).join('');
  }

  function syncRestoredComponentControls(component) {
    syncDistanceControl(component);
    syncResistorControl(component);
    syncCapacitorControl(component);
    syncWifiSignalControl(component);
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

  return {
    start
  };
}
