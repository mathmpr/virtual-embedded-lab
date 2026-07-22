import { terminalReference } from './components.js';

export function buildNets(wires, terminalKind) {
  const parent = new Map();
  const terminals = new Map();

  for (const wire of wires) {
    const from = terminalReference(wire.from);
    const to = terminalReference(wire.to);

    terminals.set(from, wire.from);
    terminals.set(to, wire.to);
    ensureParent(parent, from);
    ensureParent(parent, to);
    union(parent, from, to);
  }

  const groups = new Map();

  for (const [reference, terminal] of terminals) {
    const root = findParent(parent, reference);
    const group = groups.get(root) ?? [];
    group.push(terminal);
    groups.set(root, group);
  }

  return [...groups.values()].map((group, index) => {
    const sortedTerminals = sortTerminals(uniqueTerminals(group));
    const kind = sortedTerminals.some((terminal) => terminalKind(terminal) === 'environment')
      ? 'environment'
      : 'electrical';

    return {
      id: `${kind === 'environment' ? 'env-net' : 'net'}-${index + 1}`,
      kind,
      terminals: sortedTerminals
    };
  });
}

export function areTerminalsConnected(wires, terminalKind, left, right) {
  return buildNets(wires, terminalKind).some((net) => hasTerminal(net, left) && hasTerminal(net, right));
}

export function findNetIdForTerminal(wires, terminalKind, terminal) {
  return buildNets(wires, terminalKind).find((net) => hasTerminal(net, terminal))?.id ?? null;
}

export function findNetIdForWire(wires, terminalKind, wire) {
  return buildNets(wires, terminalKind).find((net) => hasTerminal(net, wire.from) && hasTerminal(net, wire.to))?.id ?? null;
}

export function hasTerminal(net, terminal) {
  const reference = terminalReference(terminal);
  return net.terminals.some((item) => terminalReference(item) === reference);
}

export function validateConnection(wires, terminalKind, from, to) {
  const fromKind = terminalKind(from);
  const toKind = terminalKind(to);

  if (fromKind === 'environment' || toKind === 'environment') {
    const otherKind = fromKind === 'environment' ? toKind : fromKind;

    if (otherKind !== 'signal') {
      return 'Conexao ambiental invalida: ENV deve ligar apenas a terminais de sinal/comportamento.';
    }

    return null;
  }

  const candidateWires = [...wires, { id: '__candidate__', from, to }];
  const candidateNet = buildNets(candidateWires, terminalKind).find((net) => hasTerminal(net, from) && hasTerminal(net, to));

  if (!candidateNet) {
    return null;
  }

  const sourceKinds = new Set(
    candidateNet.terminals
      .map(terminalKind)
      .filter((kind) => ['power', 'ground'].includes(kind))
  );

  if (sourceKinds.has('power') && sourceKinds.has('ground')) {
    return 'Conexao invalida: curto direto entre power e ground na mesma net.';
  }

  return null;
}

export function partitionNetsByKind(nets) {
  return {
    electricalNets: nets.filter((net) => net.kind === 'electrical'),
    environmentNets: nets.filter((net) => net.kind === 'environment')
  };
}

function ensureParent(parent, item) {
  if (!parent.has(item)) {
    parent.set(item, item);
  }
}

function findParent(parent, item) {
  const current = parent.get(item);

  if (current === item) {
    return item;
  }

  const root = findParent(parent, current);
  parent.set(item, root);
  return root;
}

function union(parent, left, right) {
  const leftRoot = findParent(parent, left);
  const rightRoot = findParent(parent, right);

  if (leftRoot !== rightRoot) {
    parent.set(rightRoot, leftRoot);
  }
}

function uniqueTerminals(terminals) {
  const unique = new Map();

  for (const terminal of terminals) {
    unique.set(terminalReference(terminal), terminal);
  }

  return [...unique.values()];
}

function sortTerminals(terminals) {
  return [...terminals].sort((left, right) => terminalReference(left).localeCompare(terminalReference(right)));
}
