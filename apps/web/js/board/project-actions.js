import { slugify, storageKey } from '../components.js';
import { boardToProject, projectCodeOrReference, projectToSnapshot } from '../project-serializer.js';

export function createProjectActions({
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
  syncRestoredComponentControls,
  saveActiveFirmware,
  syncFirmwareEditor
}) {
  function clearBoard() {
    const shouldRecord = state.components.size > 0 && !state.isRestoring;
    state.components.clear();
    state.wires = [];
    state.selectedId = null;
    state.selectedNetId = null;
    state.pendingTerminal = null;
    state.firmwares = new Map();
    state.activeFirmwareComponentId = null;
    state.nextComponentId = 1;
    state.nextWireId = 1;
    componentLayer.querySelectorAll('.component').forEach((item) => item.remove());
    drawWires();
    centerViewportOnContent();
    renderInspector();
    syncFirmwareEditor({ loadActive: true });
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
    state.firmwares.delete(componentId);
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
    syncFirmwareEditor({ loadActive: true });
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
      firmwares: state.firmwares instanceof Map
        ? new Map([...state.firmwares.entries()].map(([componentId, firmware]) => [componentId, cloneFirmware(firmware)]))
        : new Map(),
      network: structuredClone(state.network ?? {}),
      nextComponentId: state.nextComponentId,
      nextWireId: state.nextWireId,
      selectedId: state.selectedId,
      selectedNetId: state.selectedNetId,
      activeFirmwareComponentId: state.activeFirmwareComponentId
    };
  }

  function cloneFirmware(firmware) {
    return {
      ...firmware,
      files: { ...(firmware?.files ?? {}) }
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
      syncRestoredComponentControls(restored);
    }

    state.wires = snapshot.wires.map((wire) => ({
      id: wire.id,
      from: { ...wire.from },
      to: { ...wire.to },
      color: wire.color
    }));
    state.firmwares = snapshot.firmwares ?? new Map();
    state.activeFirmwareComponentId = snapshot.activeFirmwareComponentId ?? null;
    state.network = structuredClone(snapshot.network ?? {});
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
    saveActiveFirmware();
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
    saveActiveFirmware();
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
    syncFirmwareEditor({ loadActive: true });

    if (shouldRecord) {
      recordHistory();
    }

    consoleOutput.textContent = `Projeto carregado: ${project.name}`;
  }

  function currentProject() {
    saveActiveFirmware();
    return boardToProject({
      state,
      board,
      codeEditor,
      nets: getNets(),
      terminalKind
    });
  }

  return {
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
  };
}
