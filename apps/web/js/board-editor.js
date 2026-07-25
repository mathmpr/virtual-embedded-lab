import { componentDefinitions, componentPalette, loadOfficialComponents, relocalizeComponentCatalog, typeByComponentId } from './components.js';
import { createBuzzerAudioController } from './audio/buzzer-audio.js';
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
import { applyDocumentTranslations, bindLanguageSelector, getLocale, t } from './i18n.js';
import { createComponentBinder } from './board/component-binder.js';
import { createComponentState } from './board/component-state.js';
import { renderComponentTemplate } from './board/component-template.js';
import { createConsolePanel } from './board/console-panel.js';
import { escapeHtml } from './board/formatters.js';
import { createInspectorPanel } from './board/inspector-panel.js';
import { createProblemsPanel } from './board/problems-panel.js';
import { createProjectActions } from './board/project-actions.js';
import { createSerialPanel } from './board/serial-panel.js';
import { createSignalsPanel } from './board/signals-panel.js';
import { boardWorld, createInitialBoardState } from './board/state.js';
import { normalizeProjectCode } from './project-serializer.js';
import { createViewportController } from './board/viewport-controller.js';
import { routeWire } from './board/wire-routing.js';
import { installComponentStyles } from './component-contributions.js';

export function createBoardEditor(document) {
  const board = document.querySelector('#board');
  const boardViewport = document.querySelector('#boardViewport');
  const componentLayer = document.querySelector('#componentLayer');
  const wireLayer = document.querySelector('#wireLayer');
  const inspectorContent = document.querySelector('#inspectorContent');
  const codeEditor = createCodeEditor(document.querySelector('#codeEditor'), `// ${t('Loading example...')}\n`);
  const firmwareTarget = document.querySelector('#firmwareTarget');
  const currentFirmwareName = document.querySelector('#currentFirmwareName');
  const consoleOutput = document.querySelector('#consoleOutput');
  const signalMonitor = document.querySelector('#signalMonitor');
  const serialMonitor = document.querySelector('#serialMonitor');
  const problemList = document.querySelector('#problemList');
  const currentProjectTitle = document.querySelector('#currentProjectTitle');
  const toggleAudioButton = document.querySelector('#toggleAudio');
  const lockBoardButton = document.querySelector('#lockBoard');

  const state = createInitialBoardState();
  const buzzerAudio = createBuzzerAudioController();
  const consolePanel = createConsolePanel({ consoleOutput });
  const { setConsoleText } = consolePanel;
  const { renderProblems } = createProblemsPanel({ problemList });
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
    consoleOutput: consolePanel.consoleOutput,
    getNets,
    terminalKind,
    codeEditor,
    consumeSerialRx,
    clearSerialRx,
    appendSerialEvents,
    clearSerialHistory,
    onSimulationResult,
    onSimulationStopped: () => buzzerAudio.stopAll()
  });
  const componentState = createComponentState({
    state,
    componentDefinitions,
    simulation,
    renderSignals,
    recordHistory: (...args) => recordHistory(...args),
    syncInspectorPropertyControls: (...args) => syncInspectorPropertyControls(...args)
  });
  const {
    applyVisualStateBindings,
    syncComponentControls,
    adcInspectorLabel
  } = componentState;
  const { renderInspector, syncInspectorPropertyControls } = createInspectorPanel({
    state,
    inspectorContent,
    componentDefinitions,
    getNets,
    terminalKind,
    callbacks: componentState
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
    createNewProject,
    restoreProject,
    currentProject
  } = createProjectActions({
    document,
    state,
    board,
    componentLayer,
    codeEditor,
    consoleOutput: consolePanel.consoleOutput,
    addComponent,
    drawWires,
    getNets,
    terminalKind,
    centerViewportOnContent,
    renderInspector,
    renderProblems,
    selectComponent,
    simulation,
    syncRestoredComponentControls,
    syncProjectTitle,
    saveActiveFirmware,
    syncFirmwareEditor
  });
  const { bindComponent } = createComponentBinder({
    state,
    componentState,
    selectComponent,
    drawWires,
    renderInspector,
    recordHistory,
    handleTerminalClick,
    deleteComponent
  });

  async function start() {
    applyDocumentTranslations(document);
    bindLanguageSelector(document, syncLocalizedUi);
    setupBoardSurface();
    renderSignals();
    renderSerial();
    renderProblems([t('Circuit not simulated yet.')]);
    await loadComponents();
    renderPalette();
    bindPalette();
    bindToolbar();
    bindBottomTabs();
    bindFirmwareSelector();
    bindSerialInput();
    bindBoardViewport();
    bindBoardDrop();
    bindResizer();
    await loadDefaultExample();
    showSimulationNoticeIfNeeded();
    syncFirmwareEditor({ loadActive: true });
    recordHistory();
    window.addEventListener('resize', () => {
      centerViewportOnContent();
      drawWires();
    });
  }

  async function loadComponents() {
    try {
      await loadOfficialComponents();
      installComponentStyles(document);
    } catch (error) {
      renderProblems([error.message]);
      setConsoleText(`${t('Failed to load official components')}: ${error.message}`);
      throw error;
    }
  }

  function setupBoardSurface() {
    wireLayer.setAttribute('viewBox', `0 0 ${boardWorld.width} ${boardWorld.height}`);
    wireLayer.setAttribute('width', String(boardWorld.width));
    wireLayer.setAttribute('height', String(boardWorld.height));
    applyViewportTransform();
  }

  function showSimulationNoticeIfNeeded() {
    const cookieName = 'virtualEmbeddedLabSimulationNoticeAccepted';

    if (hasCookie(cookieName)) {
      return;
    }

    const dialog = document.querySelector('#simulationNoticeDialog');
    const acknowledgeButton = document.querySelector('#ackSimulationNotice');

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        event.preventDefault();
      }
    });
    acknowledgeButton.addEventListener('click', () => {
      writeCookie(cookieName, '1', 365);
      dialog.close();
    }, { once: true });
    dialog.showModal();
  }

  function hasCookie(name) {
    return document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .some((cookie) => cookie.startsWith(`${encodeURIComponent(name)}=`));
  }

  function writeCookie(name, value, maxAgeDays) {
    const maxAgeSeconds = Math.max(1, Math.round(Number(maxAgeDays) * 24 * 60 * 60));

    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
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
        ${t('Drag or click to insert. Click terminals to create wires.')}
      </div>
    `;
  }

  function syncLocalizedUi() {
    relocalizeComponentCatalog();
    renderPalette();
    bindPalette();
    syncAudioButton();
    syncBoardLockButton();
    rerenderBoardComponents();
    renderInspector();
    renderSignals();
    renderSerial();
    syncFirmwareEditor();
  }

  function rerenderBoardComponents() {
    for (const component of state.components.values()) {
      const definition = componentDefinitions[component.type];

      if (!definition) {
        continue;
      }

      const replacement = document.createElement('div');
      replacement.className = `component ${definition.className}${component.id === state.selectedId ? ' selected' : ''}`;
      replacement.dataset.id = component.id;
      replacement.dataset.type = component.type;
      replacement.style.width = `${definition.width}px`;
      replacement.style.left = `${component.x}px`;
      replacement.style.top = `${component.y}px`;
      replacement.innerHTML = renderComponentTemplate(definition, component.id, variantsForProperty);

      component.element.replaceWith(replacement);
      component.element = replacement;
      component.electricalPrimitive = definition.electricalPrimitive;
      component.electricalModel = definition.electricalModel;
      component.behavior = definition.behavior ?? {};
      component.simulation = definition.simulation ?? {};
      component.propertySchema = definition.propertySchema ?? {};

      bindComponent(replacement, component);
      syncComponentControls(component);
    }

    applyVisualStateBindings();
    drawWires();
  }

  function bindToolbar() {
    document.querySelector('#startSimulation').addEventListener('click', () => {
      setBoardLocked(true);
      simulation.runSimulation();
    });
    document.querySelector('#pauseSimulation').addEventListener('click', () => {
      simulation.pauseSimulation();
      buzzerAudio.stopAll();
    });
    document.querySelector('#resetSimulation').addEventListener('click', () => {
      simulation.resetSimulation();
      buzzerAudio.stopAll();
    });
    toggleAudioButton.addEventListener('click', async () => {
      const enabled = await buzzerAudio.toggle();
      syncAudioButton(enabled);
      buzzerAudio.sync(state.components.values());
    });
    document.querySelector('#clearBoard').addEventListener('click', clearBoard);
    document.querySelector('#openNewProject').addEventListener('click', openNewProjectDialog);
    document.querySelector('#openExamples').addEventListener('click', openExamplesDialog);
    document.querySelector('#undoBoard').addEventListener('click', undoBoard);
    lockBoardButton.addEventListener('click', () => setBoardLocked(!state.boardLocked));
    document.querySelector('#redoBoard').addEventListener('click', redoBoard);
    document.querySelector('#saveProject').addEventListener('click', saveProjectToLocalStorage);
    document.querySelector('#loadSavedProject').addEventListener('click', loadProjectFromLocalStorage);
    document.querySelector('#exportProject').addEventListener('click', exportProjectFile);
    document.querySelector('#importProject').addEventListener('click', () => {
      document.querySelector('#projectFileInput').click();
    });
    document.querySelector('#projectFileInput').addEventListener('change', importProjectFile);
    syncBoardLockButton();
    syncProjectTitle();
  }

  function syncProjectTitle() {
    currentProjectTitle.textContent = state.project?.name ? `— ${state.project.name}` : '';
    currentProjectTitle.title = state.project?.description ?? '';
  }

  function syncAudioButton(enabled = buzzerAudio.enabled) {
    toggleAudioButton.textContent = enabled ? t('Audio On') : t('Audio Off');
    toggleAudioButton.classList.toggle('active', enabled);
    toggleAudioButton.setAttribute('aria-pressed', String(enabled));
  }

  function setBoardLocked(locked) {
    state.boardLocked = Boolean(locked);
    syncBoardLockButton();
  }

  function syncBoardLockButton() {
    lockBoardButton.textContent = t('Lock');
    lockBoardButton.classList.toggle('active', state.boardLocked);
    lockBoardButton.setAttribute('aria-pressed', String(state.boardLocked));
    lockBoardButton.setAttribute('title', state.boardLocked ? t('Board locked') : t('Board unlocked'));
    board.classList.toggle('locked', state.boardLocked);
  }

  async function openExamplesDialog() {
    const dialog = document.querySelector('#examplesDialog');
    const examplesList = document.querySelector('#examplesList');
    const search = document.querySelector('#exampleSearch');
    let examples = [];

    search.value = '';
    search.hidden = false;
    examplesList.innerHTML = `<p class="muted">${t('Loading examples...')}</p>`;
    dialog.showModal();

    try {
      examples = await loadExampleList();
      renderExampleGrid(examples, examplesList, search);

      search.oninput = () => renderExampleGrid(examples, examplesList, search);
    } catch (error) {
      examplesList.innerHTML = `<p class="muted">${t('Failed to load examples')}: ${escapeHtml(error.message)}</p>`;
    }
  }

  function renderExampleGrid(examples, examplesList, search) {
    const query = search.value.trim().toLowerCase();
    const filtered = query
      ? examples.filter((example) => example.name.toLowerCase().includes(query))
      : examples;

    examplesList.innerHTML = filtered.length === 0
      ? `<p class="muted">${t('No examples found.')}</p>`
      : [...examplesByBoard(filtered).entries()].map(([boardName, groupExamples]) => `
        <section class="example-board-group">
          <div class="example-board-title">${escapeHtml(t(boardName))}</div>
          <div class="example-grid">
            ${groupExamples.map((example) => `
              <button class="example-card" value="${escapeHtml(example.id)}" data-example-id="${escapeHtml(example.id)}">
                <strong>${escapeHtml(example.name)}</strong>
                <span>${example.componentCount} ${t('components')}</span>
              </button>
            `).join('')}
          </div>
        </section>
      `).join('');

    examplesList.querySelectorAll('[data-example-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const example = examples.find((item) => item.id === button.dataset.exampleId);

        if (example) {
          openExampleDetail(example, examples, examplesList, search);
        }
      });
    });
  }

  async function openExampleDetail(example, examples, examplesList, search) {
    search.hidden = true;
    examplesList.innerHTML = `<p class="muted">${t('Loading example...')}</p>`;

    try {
      renderExampleDetail(await exampleWithDetails(example), examples, examplesList, search);
    } catch (error) {
      examplesList.innerHTML = `<p class="muted">${t('Failed to load example')}: ${escapeHtml(error.message)}</p>`;
    }
  }

  function renderExampleDetail(example, examples, examplesList, search) {
    search.hidden = true;
    examplesList.innerHTML = `
      <section class="example-detail">
        <div>
          <h3>${escapeHtml(example.name)}</h3>
          <p>${escapeHtml(localizedExampleDescription(example))}</p>
        </div>
        <div>
          <div class="example-board-title">${t('Boards')}</div>
          <p>${escapeHtml((example.boardNames ?? []).join(', ') || t('No board'))}</p>
        </div>
        <div>
          <div class="example-board-title">${t('Components used')}</div>
          <ul class="example-component-list">
            ${(example.components ?? []).map((component) => `<li>${escapeHtml(component)}</li>`).join('')}
          </ul>
        </div>
        <div class="example-detail-actions">
          <button type="button" data-example-back>${t('Back')}</button>
          <button type="button" class="primary" data-example-load>${t('Load')}</button>
        </div>
      </section>
    `;

    examplesList.querySelector('[data-example-back]').addEventListener('click', () => {
      search.hidden = false;
      renderExampleGrid(examples, examplesList, search);
    });
    examplesList.querySelector('[data-example-load]').addEventListener('click', async () => {
      await loadExampleById(example.id);
      document.querySelector('#examplesDialog').close();
    });
  }

  async function exampleWithDetails(example) {
    const hasDetails = (example.components ?? []).length > 0 && (example.boardNames ?? []).length > 0;

    if (hasDetails) {
      return example;
    }

    const project = await loadExampleProject(example.id);
    const components = componentNamesFromProject(project);
    const boardNames = boardNamesFromProject(project);

    return {
      ...example,
      description: example.description || project.description || '',
      descriptionI18n: example.descriptionI18n || project.descriptionI18n || null,
      boardNames,
      boardGroup: example.boardGroup || boardGroupName(boardNames),
      componentCount: project.components?.length ?? example.componentCount ?? 0,
      components
    };
  }

  function localizedExampleDescription(example) {
    return example.descriptionI18n?.[getLocale()]
      ?? example.descriptionI18n?.en
      ?? example.description
      ?? t('No description provided.');
  }

  function componentNamesFromProject(project) {
    const names = (project.components ?? []).map((component) => componentName(component.componentId));

    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
  }

  function boardNamesFromProject(project) {
    const names = (project.components ?? [])
      .filter((component) => component.componentId?.startsWith('board.'))
      .map((component) => componentName(component.componentId));

    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
  }

  function componentName(componentId) {
    const type = typeByComponentId[componentId];

    return componentDefinitions[type]?.identity?.name
      ?? componentDefinitions[type]?.title
      ?? componentId;
  }

  function boardGroupName(boardNames) {
    if (boardNames.length === 0) {
      return 'No board';
    }

    if (boardNames.length > 1) {
      return 'Multiple boards';
    }

    return boardNames[0];
  }

  function examplesByBoard(examples) {
    const groups = new Map();

    for (const example of examples) {
      const boardName = example.boardGroup || 'No board';
      const group = groups.get(boardName) ?? [];

      group.push(example);
      groups.set(boardName, group);
    }

    return new Map([...groups.entries()].sort(([left], [right]) => t(left).localeCompare(t(right))));
  }

  function openNewProjectDialog() {
    const dialog = document.querySelector('#newProjectDialog');
    const form = document.querySelector('#newProjectForm');
    const nameInput = document.querySelector('#newProjectName');
    const descriptionInput = document.querySelector('#newProjectDescription');

    form.reset();
    nameInput.value = t('Untitled project');
    dialog.showModal();
    nameInput.focus();
    nameInput.select();

    dialog.querySelectorAll('[data-new-project-cancel]').forEach((button) => {
      button.onclick = () => dialog.close();
    });

    form.onsubmit = (event) => {
      event.preventDefault();

      if (event.submitter && !event.submitter.matches('[data-new-project-create]')) {
        dialog.close();
        return;
      }

      const name = nameInput.value.trim() || t('Untitled project');
      const description = descriptionInput.value.trim();

      createNewProject({ name, description });
      dialog.close();
    };
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
      terminals: definition.terminals ?? [],
      propertySchema: definition.propertySchema ?? {},
      x,
      y,
      properties: { ...(definition.properties ?? {}) },
      element
    };

    state.components.set(componentId, model);
    syncComponentCounter(componentId);
    syncFirmwareEditor();
    bindComponent(element, model);
    selectComponent(componentId);
    drawWires();
    recordHistory();

    return model;
  }

  function variantsForProperty(componentType, propertyName) {
    return componentDefinitions[componentType]?.variants?.[propertyName] ?? [];
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

        if (state.boardLocked) {
          selectNet(group.dataset.netId);
          return;
        }

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
      await loadExampleById('esp32-s3-snake-hub75', false);
    } catch (error) {
      codeEditor.value = '';
      renderProblems([`${t('Failed to load default example')}: ${error.message}`]);
      setConsoleText(t('No project loaded.'));
    }
  }

  async function loadExampleById(exampleId, shouldRecord = true) {
    const project = await loadExampleProject(exampleId);
    restoreProject(project, shouldRecord);
  }

  function bindFirmwareSelector() {
    firmwareTarget.addEventListener('change', () => {
      saveActiveFirmware();
      state.activeFirmwareComponentId = firmwareTarget.value || null;
      loadActiveFirmware();
      syncFirmwareEditor();
      simulation.resetSimulation();
    });
  }

  function syncFirmwareEditor({ loadActive = false } = {}) {
    const boards = microcontrollerComponents();

    if (boards.length === 0) {
      firmwareTarget.innerHTML = '<option value="">main.ino</option>';
      currentFirmwareName.textContent = 'main.ino';
      return;
    }

    ensureFirmwareEntries(boards);

    if (!boards.some((component) => component.id === state.activeFirmwareComponentId)) {
      state.activeFirmwareComponentId = boards[0].id;
    }

    firmwareTarget.innerHTML = boards.map((component) => {
      const firmware = state.firmwares.get(component.id);
      return `<option value="${escapeHtml(component.id)}">${escapeHtml(component.id)} / ${escapeHtml(firmware.entry)}</option>`;
    }).join('');
    firmwareTarget.value = state.activeFirmwareComponentId;
    currentFirmwareName.textContent = state.firmwares.get(state.activeFirmwareComponentId)?.entry ?? 'main.ino';

    if (loadActive) {
      loadActiveFirmware();
    }
  }

  function saveActiveFirmware() {
    const componentId = state.activeFirmwareComponentId;

    if (!componentId || !state.firmwares.has(componentId)) {
      return;
    }

    const firmware = state.firmwares.get(componentId);
    state.firmwares.set(componentId, {
      ...firmware,
      files: {
        ...(firmware.files ?? {}),
        [firmware.entry]: codeEditor.value
      }
    });
  }

  function loadActiveFirmware() {
    const firmware = state.firmwares.get(state.activeFirmwareComponentId);

    if (!firmware) {
      return;
    }

    codeEditor.value = normalizeProjectCode(firmware.files?.[firmware.entry] ?? '');
    currentFirmwareName.textContent = firmware.entry;
  }

  function ensureFirmwareEntries(boards) {
    const legacyCode = codeEditor.value;

    for (const [index, component] of boards.entries()) {
      if (state.firmwares.has(component.id)) {
        continue;
      }

      const entry = boards.length > 1 ? `main-${component.id}.ino` : 'main.ino';
      state.firmwares.set(component.id, {
        language: 'arduino-cpp',
        entry,
        files: {
          [entry]: index === 0 ? legacyCode : 'void setup() {\n}\n\nvoid loop() {\n}\n'
        }
      });
    }
  }

  function microcontrollerComponents() {
    return [...state.components.values()].filter((component) => component.behavior?.type === 'microcontroller');
  }

  function syncRestoredComponentControls(component) {
    syncComponentControls(component);
  }

  function onSimulationResult(result) {
    state.signalsByComponent = result.signalsByComponent ?? state.signalsByComponent ?? new Map();
    state.signalsByNet = result.signalsByNet ?? state.signalsByNet ?? new Map();
    state.electrical = {
      componentReadings: result.electrical?.componentReadings ?? new Map(),
      netReadings: result.electrical?.netReadings ?? new Map()
    };
    state.runtime = {
      pinStates: result.firmwareResult?.pinStates ?? {},
      analogPinStates: result.firmwareResult?.analogPinStates ?? {}
    };
    syncRuntimeUpdatedComponentControls();
    applyVisualStateBindings();
    buzzerAudio.sync(state.components.values(), result.buzzerEvents ?? []);

    if (!inspectorHasActivePropertyEditor()) {
      renderInspector();
    }
  }

  function inspectorHasActivePropertyEditor() {
    return Boolean(document.activeElement?.matches?.('#inspectorContent [data-property]'));
  }

  function syncRuntimeUpdatedComponentControls() {
    for (const component of state.components.values()) {
      syncComponentControls(component);
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
