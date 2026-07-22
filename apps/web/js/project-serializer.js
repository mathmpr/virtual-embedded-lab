import {
  componentIdByType,
  nextCounterFromIds,
  parseTerminalReference,
  terminalReference,
  typeByComponentId
} from './components.js';
import { partitionNetsByKind } from './nets.js';

export function boardToProject({ state, board, codeEditor, nets, terminalKind }) {
  const { electricalNets, environmentNets } = partitionNetsByKind(nets);
  const firmwares = projectFirmwaresFromState(state, codeEditor);

  const project = {
    schemaVersion: '1.0.0',
    name: 'Virtual Embedded Lab Project',
    board: {
      width: Math.max(board.clientWidth, 1),
      height: Math.max(board.clientHeight, 1),
      gridSize: 10
    },
    components: [...state.components.values()].map((component) => ({
      id: component.id,
      componentId: componentIdByType[component.type],
      position: {
        x: component.x,
        y: component.y
      },
      properties: { ...component.properties }
    })),
    connections: electricalNets.map((net) => ({
      id: net.id,
      color: colorForNet(net, state.wires, terminalKind),
      terminals: net.terminals.map(terminalReference)
    })),
    environmentConnections: environmentNets.flatMap((net) => {
      const sources = net.terminals.filter((terminal) => terminalKind(terminal) === 'environment');
      const targets = net.terminals.filter((terminal) => terminalKind(terminal) !== 'environment');

      return sources.flatMap((source) => targets.map((target) => ({
        source: terminalReference(source),
        target: terminalReference(target),
        color: colorForEnvironmentWire(source, target, state.wires) ?? colorForNet(net, state.wires, terminalKind)
      })));
    }),
    code: {
      language: 'arduino-cpp',
      entry: 'main.ino',
      files: {
        'main.ino': codeEditor.value
      }
    }
  };

  if (firmwares.size > 0) {
    project.firmwares = Object.fromEntries(firmwares.entries());
  }

  return project;
}

export function projectToSnapshot(project) {
  validateProjectShape(project);

  const components = project.components.map((component) => {
    const type = typeByComponentId[component.componentId];

    if (!type) {
      throw new Error(`Componente nao suportado pela UI atual: ${component.componentId}`);
    }

    return {
      id: component.id,
      type,
      x: component.position.x,
      y: component.position.y,
      properties: { ...component.properties }
    };
  });

  const electricalWires = project.connections.flatMap((connection) => {
    return terminalReferencesToWires(connection.terminals, connection.id, connection.color);
  });

  const environmentWires = (project.environmentConnections ?? []).map((connection, index) => ({
    id: `env-${index + 1}`,
    from: parseTerminalReference(connection.source),
    to: parseTerminalReference(connection.target),
    color: connection.color
  }));

  return {
    components,
    wires: [...electricalWires, ...environmentWires],
    firmwares: new Map(Object.entries(project.firmwares ?? {})),
    activeFirmwareComponentId: Object.keys(project.firmwares ?? {})[0] ?? null,
    nextComponentId: nextCounterFromIds(components.map((component) => component.id)),
    nextWireId: nextCounterFromIds([...electricalWires, ...environmentWires].map((wire) => wire.id)),
    selectedId: components[0]?.id ?? null,
    selectedNetId: null
  };
}

export function projectCodeOrReference(project) {
  const firstFirmware = Object.values(project.firmwares ?? {})[0];

  if (firstFirmware?.files?.[firstFirmware.entry]) {
    return normalizeProjectCode(firstFirmware.files[firstFirmware.entry]);
  }

  return normalizeProjectCode(project.code?.files?.[project.code.entry] ?? '');
}

export function normalizeProjectCode(code) {
  if (typeof code !== 'string') {
    return '';
  }

  return code.includes('\n') ? code : code.replaceAll('\\n', '\n');
}

function validateProjectShape(project) {
  if (!project || typeof project !== 'object') {
    throw new Error('Projeto invalido.');
  }

  if (!Array.isArray(project.components) || !Array.isArray(project.connections)) {
    throw new Error('Projeto precisa conter components e connections.');
  }

  if (!project.code?.files || !project.code.entry) {
    throw new Error('Projeto precisa conter code.files e code.entry.');
  }
}

function projectFirmwaresFromState(state, codeEditor) {
  const firmwares = state.firmwares instanceof Map
    ? new Map(state.firmwares)
    : new Map(Object.entries(state.firmwares ?? {}));
  const activeBoard = state.activeFirmwareComponentId
    ? state.components.get(state.activeFirmwareComponentId)
    : [...state.components.values()].find((component) => component.behavior?.type === 'microcontroller');

  if (activeBoard && firmwares.has(activeBoard.id)) {
    const current = firmwares.get(activeBoard.id);
    firmwares.set(activeBoard.id, {
      ...current,
      language: current?.language ?? 'arduino-cpp',
      entry: current?.entry ?? 'main.ino',
      files: {
        ...(current?.files ?? {}),
        [current?.entry ?? 'main.ino']: codeEditor.value
      }
    });
  }

  return firmwares;
}

function terminalReferencesToWires(references, idPrefix, color) {
  const terminals = references.map(parseTerminalReference);

  if (terminals.length < 2) {
    return [];
  }

  return terminals.slice(1).map((terminal, index) => ({
    id: `${idPrefix}-wire-${index + 1}`,
    from: { ...terminals[0] },
    to: terminal,
    color
  }));
}

function colorForNet(net, wires, terminalKind) {
  const explicit = wires.find((wire) => wire.color && netContainsWire(net, wire))?.color;

  if (explicit) {
    return explicit;
  }

  if (net.terminals.some((terminal) => terminalKind(terminal) === 'power')) {
    return '#f05252';
  }

  if (net.terminals.some((terminal) => terminalKind(terminal) === 'ground')) {
    return '#f5f7fa';
  }

  if (net.terminals.some((terminal) => terminalKind(terminal) === 'environment')) {
    return '#6fbf73';
  }

  return '#4c8dff';
}

function colorForEnvironmentWire(source, target, wires) {
  return wires.find((wire) => {
    return terminalsEqual(wire.from, source) && terminalsEqual(wire.to, target)
      || terminalsEqual(wire.from, target) && terminalsEqual(wire.to, source);
  })?.color;
}

function netContainsWire(net, wire) {
  return net.terminals.some((terminal) => terminalsEqual(terminal, wire.from))
    && net.terminals.some((terminal) => terminalsEqual(terminal, wire.to));
}

function terminalsEqual(left, right) {
  return left.componentId === right.componentId && left.terminalId === right.terminalId;
}
