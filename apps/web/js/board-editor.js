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

const boardWorld = {
  width: 4000,
  height: 2400,
  minScale: 0.35,
  maxScale: 2.2
};

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

  const state = {
    components: new Map(),
    wires: [],
    nextComponentId: 1,
    nextWireId: 1,
    selectedId: null,
    selectedNetId: null,
    pendingTerminal: null,
    serialRxQueue: [],
    serialHistory: [],
    serialAutoScroll: true,
    history: [],
    redoStack: [],
    isRestoring: false,
    viewport: {
      x: 0,
      y: 0,
      scale: 1,
      isSpacePanning: false,
      isPanning: false
    },
    electrical: {
      componentReadings: new Map(),
      netReadings: new Map()
    },
    running: false,
    signals: {
      trig: 0,
      echo: 0,
      led: 0
    }
  };

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
    element.innerHTML = renderComponentTemplate(definition, componentId);

    componentLayer.append(element);

    const model = {
      id: componentId,
      type,
      electricalPrimitive: definition.electricalPrimitive,
      behavior: definition.behavior ?? {},
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

  function renderComponentTemplate(definition, componentId) {
    const body = definition.electricalPrimitive === 'led'
      ? '<div class="led-glow"></div>'
      : definition.className === 'distance'
        ? '<div class="distance-readout"><span>Distância</span><strong data-distance-output>150 cm</strong></div><input data-distance-slider type="range" min="2" max="400" value="150">'
        : definition.className === 'resistor'
          ? `<label class="component-select-row"><span>R</span>${renderVariantSelect('resistor', 'resistanceOhms', definition.properties.resistanceOhms, 'data-resistor-select')}</label>`
          : definition.className === 'capacitor'
            ? `<label class="component-select-row"><span>C</span>${renderVariantSelect('capacitor', 'capacitanceMicrofarads', definition.properties.capacitanceMicrofarads, 'data-capacitor-select')}</label>`
            : definition.className === 'wifi-signal'
              ? `<div class="wifi-readout"><span>Wi-Fi</span><strong data-wifi-output>${definition.properties.strengthPercent}%</strong></div><label class="wifi-checkbox-row"><input data-wifi-connected type="checkbox" ${definition.properties.connected ? 'checked' : ''}> Internet ativa</label><input data-wifi-slider type="range" min="0" max="100" value="${definition.properties.strengthPercent}">`
              : definition.className === 'rain-toggle'
                ? `<div class="rain-readout"><span>Chuva</span><strong data-rain-output>${definition.properties.active ? 'ON' : 'OFF'}</strong></div><label class="wifi-checkbox-row"><input data-rain-active type="checkbox" ${definition.properties.active ? 'checked' : ''}> Chuva ativa</label><input data-rain-intensity type="range" min="0" max="100" value="${definition.properties.intensityPercent}">`
                : definition.className === 'fc37-rain-sensor'
                  ? `<div class="rain-sensor-readout"><span>FC-37</span><strong data-rain-sensor-state>DRY</strong></div><div class="rain-sensor-plate"></div>`
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

  function renderVariantSelect(componentType, propertyName, value, dataAttribute) {
    const variants = componentDefinitions[componentType]?.variants?.[propertyName] ?? [];

    return `
      <select ${dataAttribute}>
        ${variants.map((variant) => `
          <option value="${variant.value}" ${Number(value) === variant.value ? 'selected' : ''}>${variant.label}</option>
        `).join('')}
      </select>
    `;
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
      const route = routeWire(wire.from, wire.to, from, to);

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
    if (component.type === 'distance') {
      return `
        <label class="property-row editable-property">
          <span>Distância</span>
          <input data-inspector-distance type="range" min="${component.properties.minCm}" max="${component.properties.maxCm}" value="${component.properties.valueCm}">
        </label>
        <div class="property-row"><span>Valor</span><code data-inspector-distance-output>${component.properties.valueCm} cm</code></div>
      `;
    }

    if (component.type === 'resistor') {
      return `
        <label class="property-row editable-property">
          <span>Resistência</span>
          ${renderVariantSelect('resistor', 'resistanceOhms', component.properties.resistanceOhms, 'data-inspector-resistor')}
        </label>
        <div class="property-row"><span>Potência máx.</span><code>${component.properties.maximumPowerWatts} W</code></div>
      `;
    }

    if (component.type === 'capacitor') {
      return `
        <label class="property-row editable-property">
          <span>Capacitância</span>
          ${renderVariantSelect('capacitor', 'capacitanceMicrofarads', component.properties.capacitanceMicrofarads, 'data-inspector-capacitor')}
        </label>
        <div class="property-row"><span>Tensão máx.</span><code>${component.properties.maximumVoltageVolts} V</code></div>
      `;
    }

    if (component.type === 'wifi-signal') {
      return `
        <label class="property-row editable-property">
          <span>SSID</span>
          <input data-inspector-wifi-ssid type="text" value="${escapeHtml(component.properties.ssid)}">
        </label>
        <label class="property-row editable-property">
          <span>Internet ativa</span>
          <input data-inspector-wifi-connected type="checkbox" ${component.properties.connected ? 'checked' : ''}>
        </label>
        <label class="property-row editable-property">
          <span>Sinal</span>
          <input data-inspector-wifi-strength type="range" min="0" max="100" value="${component.properties.strengthPercent}">
        </label>
        <div class="property-row"><span>Força</span><code data-inspector-wifi-output>${component.properties.strengthPercent}%</code></div>
      `;
    }

    if (component.type === 'rain-toggle') {
      return `
        <label class="property-row editable-property">
          <span>Chuva ativa</span>
          <input data-inspector-rain-active type="checkbox" ${component.properties.active ? 'checked' : ''}>
        </label>
        <label class="property-row editable-property">
          <span>Intensidade</span>
          <input data-inspector-rain-intensity type="range" min="0" max="100" value="${component.properties.intensityPercent}">
        </label>
        <div class="property-row"><span>Estado</span><code data-inspector-rain-output>${component.properties.active ? 'ON' : 'OFF'} / ${component.properties.intensityPercent}%</code></div>
      `;
    }

    if (component.type === 'fc37-rain-sensor') {
      return `
        <label class="property-row editable-property">
          <span>Ativo em LOW</span>
          <input data-inspector-rain-sensor-active-low type="checkbox" ${component.properties.activeLow ? 'checked' : ''}>
        </label>
        <label class="property-row editable-property">
          <span>Threshold</span>
          <input data-inspector-rain-sensor-threshold type="range" min="0" max="100" value="${component.properties.thresholdPercent}">
        </label>
        <div class="property-row"><span>Threshold</span><code data-inspector-rain-sensor-threshold-output>${component.properties.thresholdPercent}%</code></div>
        <div class="property-row"><span>AO molhado</span><code>${component.properties.wetAnalogValue}</code></div>
        <div class="property-row"><span>AO seco</span><code>${component.properties.dryAnalogValue}</code></div>
      `;
    }

    return Object.entries(component.properties).map(([key, value]) => {
      return `<div class="property-row"><span>${key}</span><code>${value}</code></div>`;
    }).join('');
  }

  function bindInspectorPropertyControls(component) {
    const distanceInput = inspectorContent.querySelector('[data-inspector-distance]');

    if (distanceInput) {
      distanceInput.addEventListener('input', () => {
        updateDistanceValue(component, Number(distanceInput.value));
      });
      distanceInput.addEventListener('change', () => {
        recordHistory();
      });
    }

    const resistorSelect = inspectorContent.querySelector('[data-inspector-resistor]');

    if (resistorSelect) {
      resistorSelect.addEventListener('change', () => {
        updateResistorValue(component, Number(resistorSelect.value), true);
      });
    }

    const capacitorSelect = inspectorContent.querySelector('[data-inspector-capacitor]');

    if (capacitorSelect) {
      capacitorSelect.addEventListener('change', () => {
        updateCapacitorValue(component, Number(capacitorSelect.value), true);
      });
    }

    const wifiStrength = inspectorContent.querySelector('[data-inspector-wifi-strength]');
    const wifiConnected = inspectorContent.querySelector('[data-inspector-wifi-connected]');
    const wifiSsid = inspectorContent.querySelector('[data-inspector-wifi-ssid]');

    if (wifiStrength) {
      wifiStrength.addEventListener('input', () => {
        updateWifiStrength(component, Number(wifiStrength.value));
      });
      wifiStrength.addEventListener('change', () => {
        recordHistory();
      });
    }

    if (wifiConnected) {
      wifiConnected.addEventListener('change', () => {
        updateWifiInternetAvailable(component, wifiConnected.checked, true);
      });
    }

    if (wifiSsid) {
      wifiSsid.addEventListener('change', () => {
        updateWifiSsid(component, wifiSsid.value, true);
      });
    }

    const rainActive = inspectorContent.querySelector('[data-inspector-rain-active]');
    const rainIntensity = inspectorContent.querySelector('[data-inspector-rain-intensity]');
    const rainSensorActiveLow = inspectorContent.querySelector('[data-inspector-rain-sensor-active-low]');
    const rainSensorThreshold = inspectorContent.querySelector('[data-inspector-rain-sensor-threshold]');

    if (rainActive) {
      rainActive.addEventListener('change', () => {
        updateRainActive(component, rainActive.checked, true);
      });
    }

    if (rainIntensity) {
      rainIntensity.addEventListener('input', () => {
        updateRainIntensity(component, Number(rainIntensity.value));
      });
      rainIntensity.addEventListener('change', () => {
        recordHistory();
      });
    }

    if (rainSensorActiveLow) {
      rainSensorActiveLow.addEventListener('change', () => {
        updateRainSensorActiveLow(component, rainSensorActiveLow.checked, true);
      });
    }

    if (rainSensorThreshold) {
      rainSensorThreshold.addEventListener('input', () => {
        updateRainSensorThreshold(component, Number(rainSensorThreshold.value));
      });
      rainSensorThreshold.addEventListener('change', () => {
        recordHistory();
      });
    }
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
      signalMonitor.innerHTML = '<p class="muted">Selecione Arduino, HC-SR04 ou LED para ver sinais.</p>';
      return;
    }

    if (component.type === 'arduino') {
      signalMonitor.innerHTML = [
        signalCard('Ultrassom', [
          signalRow('D7 / TRIG', state.signals.trig),
          signalRow('D6 / ECHO', state.signals.echo)
        ]),
        signalCard('LED', [
          signalRow('D13', state.signals.led, state.signals.led ? 'ON' : 'OFF')
        ])
      ].join('');
      return;
    }

    if (component.type === 'hcsr04') {
      signalMonitor.innerHTML = signalCard('HC-SR04', [
        signalRow('TRIG', state.signals.trig),
        signalRow('ECHO', state.signals.echo)
      ]);
      return;
    }

    if (isLedComponent(component)) {
      signalMonitor.innerHTML = signalCard('LED', [
        signalRow('Estado', state.signals.led, state.signals.led ? 'ON' : 'OFF')
      ]);
      return;
    }

    if (component.type === 'wifi-signal') {
      signalMonitor.innerHTML = signalCard('Wi-Fi Signal', [
        signalRow('Internet', component.properties.connected ? 1 : 0, component.properties.connected ? 'ON' : 'OFF'),
        signalRow('Força', Number(component.properties.strengthPercent) / 100, `${component.properties.strengthPercent}%`)
      ]);
      return;
    }

    if (component.type === 'rain-toggle') {
      signalMonitor.innerHTML = signalCard('Chuva', [
        signalRow('Estado', component.properties.active ? 1 : 0, component.properties.active ? 'ON' : 'OFF'),
        signalRow('Intensidade', Number(component.properties.intensityPercent) / 100, `${component.properties.intensityPercent}%`)
      ]);
      return;
    }

    if (component.type === 'fc37-rain-sensor') {
      signalMonitor.innerHTML = signalCard('FC-37', [
        signalRow('Chuva', state.signals.rain ?? 0, state.signals.rain ? 'WET' : 'DRY'),
        signalRow('DO', state.signals.rainDo ?? 0)
      ]);
      return;
    }

    signalMonitor.innerHTML = '<p class="muted">Este componente ainda não expõe sinais monitoráveis.</p>';
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
    return `
      <div class="signal-row">
        <span>${label}</span>
        <div class="signal-track"><div class="signal-fill" style="width:${Math.round(value * 100)}%"></div></div>
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function onSimulationResult(result) {
    state.electrical = {
      componentReadings: result.electrical?.componentReadings ?? new Map(),
      netReadings: result.electrical?.netReadings ?? new Map()
    };
    applyRainSensorStates();
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

  function formatVoltage(value) {
    return value === null ? 'flutuante' : `${value.toFixed(2)} V`;
  }

  function formatCurrent(value) {
    return Number.isFinite(value) ? `${(value * 1000).toFixed(2)} mA` : 'infinita';
  }

  function formatPower(value) {
    return Number.isFinite(value) ? `${(value * 1000).toFixed(2)} mW` : 'infinita';
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
    syncInspectorDistanceOutput(component);

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
    syncInspectorWifiOutput(component);
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
    syncInspectorWifiOutput(component);
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
    syncInspectorRainOutput(component);
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
    syncInspectorRainOutput(component);
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
    syncInspectorRainSensorOutput(component);

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

  function syncInspectorDistanceOutput(component) {
    const output = inspectorContent.querySelector('[data-inspector-distance-output]');
    const input = inspectorContent.querySelector('[data-inspector-distance]');

    if (input && component.type === 'distance') {
      input.value = String(component.properties.valueCm);
    }

    if (output && component.type === 'distance') {
      output.textContent = `${component.properties.valueCm} cm`;
    }
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

  function syncInspectorRainOutput(component) {
    const output = inspectorContent.querySelector('[data-inspector-rain-output]');
    const checkbox = inspectorContent.querySelector('[data-inspector-rain-active]');
    const input = inspectorContent.querySelector('[data-inspector-rain-intensity]');

    if (checkbox && component.type === 'rain-toggle') {
      checkbox.checked = Boolean(component.properties.active);
    }

    if (input && component.type === 'rain-toggle') {
      input.value = String(component.properties.intensityPercent);
    }

    if (output && component.type === 'rain-toggle') {
      output.textContent = `${component.properties.active ? 'ON' : 'OFF'} / ${component.properties.intensityPercent}%`;
    }
  }

  function syncInspectorRainSensorOutput(component) {
    const output = inspectorContent.querySelector('[data-inspector-rain-sensor-threshold-output]');
    const input = inspectorContent.querySelector('[data-inspector-rain-sensor-threshold]');

    if (input && component.type === 'fc37-rain-sensor') {
      input.value = String(component.properties.thresholdPercent);
    }

    if (output && component.type === 'fc37-rain-sensor') {
      output.textContent = `${component.properties.thresholdPercent}%`;
    }
  }

  function syncInspectorWifiOutput(component) {
    const output = inspectorContent.querySelector('[data-inspector-wifi-output]');
    const input = inspectorContent.querySelector('[data-inspector-wifi-strength]');
    const checkbox = inspectorContent.querySelector('[data-inspector-wifi-connected]');

    if (input && component.type === 'wifi-signal') {
      input.value = String(component.properties.strengthPercent);
    }

    if (output && component.type === 'wifi-signal') {
      output.textContent = `${component.properties.strengthPercent}%`;
    }

    if (checkbox && component.type === 'wifi-signal') {
      checkbox.checked = Boolean(component.properties.connected);
    }
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

  function routeWire(fromTerminal, toTerminal, from, to) {
    const fromExit = terminalExitPoint(from, terminalDefinition(fromTerminal)?.side, to);
    const toExit = terminalExitPoint(to, terminalDefinition(toTerminal)?.side, from);
    const candidates = [
      [from, fromExit, { x: toExit.x, y: fromExit.y }, toExit, to],
      [from, fromExit, { x: fromExit.x, y: toExit.y }, toExit, to],
      [
        from,
        fromExit,
        { x: (fromExit.x + toExit.x) / 2, y: fromExit.y },
        { x: (fromExit.x + toExit.x) / 2, y: toExit.y },
        toExit,
        to
      ],
      [
        from,
        fromExit,
        { x: fromExit.x, y: (fromExit.y + toExit.y) / 2 },
        { x: toExit.x, y: (fromExit.y + toExit.y) / 2 },
        toExit,
        to
      ]
    ];
    const compactPoints = candidates
      .map(compactRoutePoints)
      .sort((left, right) => scoreRoute(left, fromTerminal, toTerminal) - scoreRoute(right, fromTerminal, toTerminal))[0];

    return {
      d: compactPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
      midpoint: compactPoints[Math.floor(compactPoints.length / 2)]
    };
  }

  function terminalExitPoint(point, side, target) {
    const offset = 48;
    const dx = target.x - point.x;
    const dy = target.y - point.y;
    const horizontalDominant = Math.abs(dx) > Math.abs(dy) * 1.2;
    const verticalDominant = Math.abs(dy) > Math.abs(dx) * 1.2;

    if (side === 'top' && (dy > 0 || horizontalDominant)) {
      return horizontalEscapePoint(point, dx, offset);
    }

    if (side === 'bottom' && (dy < 0 || horizontalDominant)) {
      return horizontalEscapePoint(point, dx, offset);
    }

    if (side === 'left' && (dx > 0 || verticalDominant)) {
      return verticalEscapePoint(point, dy, offset);
    }

    if (side === 'right' && (dx < 0 || verticalDominant)) {
      return verticalEscapePoint(point, dy, offset);
    }

    if (side === 'left') {
      return { x: point.x - offset, y: point.y };
    }

    if (side === 'right') {
      return { x: point.x + offset, y: point.y };
    }

    if (side === 'top') {
      return { x: point.x, y: point.y - offset };
    }

    if (side === 'bottom') {
      return { x: point.x, y: point.y + offset };
    }

    return { ...point };
  }

  function horizontalEscapePoint(point, dx, offset) {
    return {
      x: point.x + (dx < 0 ? -offset : offset),
      y: point.y
    };
  }

  function verticalEscapePoint(point, dy, offset) {
    return {
      x: point.x,
      y: point.y + (dy < 0 ? -offset : offset)
    };
  }

  function compactRoutePoints(points) {
    return points.filter((point, index) => {
      const previous = points[index - 1];
      const next = points[index + 1];
      const duplicate = previous && previous.x === point.x && previous.y === point.y;
      const collinear = previous && next
        && (previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y);

      return !duplicate && !collinear;
    });
  }

  function scoreRoute(points, fromTerminal, toTerminal) {
    const length = routeLength(points);
    const bends = Math.max(points.length - 2, 0);
    const crossings = routeComponentCrossings(points, fromTerminal.componentId, toTerminal.componentId);
    const nearEdges = routeEndpointComponentNearEdges(points, fromTerminal.componentId, toTerminal.componentId);

    return length + bends * 18 + nearEdges * 160 + crossings * 10000;
  }

  function routeLength(points) {
    return points.slice(1).reduce((total, point, index) => {
      const previous = points[index];
      return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
    }, 0);
  }

  function routeComponentCrossings(points, fromComponentId, toComponentId) {
    let crossings = 0;

    for (const component of state.components.values()) {
      if (component.id === fromComponentId || component.id === toComponentId) {
        continue;
      }

      const bounds = componentBounds(component, 8);

      for (let index = 1; index < points.length; index += 1) {
        if (segmentIntersectsBounds(points[index - 1], points[index], bounds)) {
          crossings += 1;
        }
      }
    }

    return crossings;
  }

  function routeEndpointComponentNearEdges(points, fromComponentId, toComponentId) {
    return [fromComponentId, toComponentId].reduce((total, componentId) => {
      const component = state.components.get(componentId);

      if (!component) {
        return total;
      }

      const bounds = componentBounds(component, 16);
      const innerBounds = componentBounds(component, -2);

      return total + points.slice(1, -1).filter((point) => {
        return point.x >= bounds.left && point.x <= bounds.right
          && point.y >= bounds.top && point.y <= bounds.bottom
          && !(point.x > innerBounds.left && point.x < innerBounds.right && point.y > innerBounds.top && point.y < innerBounds.bottom);
      }).length;
    }, 0);
  }

  function componentBounds(component, padding = 0) {
    return {
      left: component.x - padding,
      right: component.x + component.element.offsetWidth + padding,
      top: component.y - padding,
      bottom: component.y + component.element.offsetHeight + padding
    };
  }

  function segmentIntersectsBounds(start, end, bounds) {
    if (start.x === end.x) {
      const y1 = Math.min(start.y, end.y);
      const y2 = Math.max(start.y, end.y);
      return start.x >= bounds.left && start.x <= bounds.right && y2 >= bounds.top && y1 <= bounds.bottom;
    }

    if (start.y === end.y) {
      const x1 = Math.min(start.x, end.x);
      const x2 = Math.max(start.x, end.x);
      return start.y >= bounds.top && start.y <= bounds.bottom && x2 >= bounds.left && x1 <= bounds.right;
    }

    return false;
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    start
  };
}
