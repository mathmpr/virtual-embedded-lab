export function register(registry) {
  registry.register('hub75-rgb-matrix', bindHub75RgbMatrices);
}

const requiredSignalTerminals = ['r1', 'g1', 'b1', 'r2', 'g2', 'b2', 'a', 'b', 'c', 'd', 'e', 'clk', 'lat', 'oe'];

function bindHub75RgbMatrices({ graph, runtime, diagnostics, components }) {
  for (const display of components) {
    const behavior = display.behavior ?? {};
    const displayId = behavior.displayId ?? 'default';
    const width = Number(display.properties[behavior.widthProperty ?? 'widthPixels'] ?? 64);
    const height = Number(display.properties[behavior.heightProperty ?? 'heightPixels'] ?? 32);
    const framebufferProperty = behavior.framebufferProperty ?? 'framebuffer';
    const validation = validateHub75Connections({ graph, display });

    if (!validation.ok) {
      display.properties[framebufferProperty] = `${width}x${height}|`;
      diagnostics.push(`${display.id}: HUB75 sem conexões físicas válidas (${validation.problems.join('; ')}).`);
      continue;
    }

    runtime.registerRgbMatrixDisplay(displayId, {
      component: display,
      width,
      height,
      framebufferProperty
    });
  }
}

function validateHub75Connections({ graph, display }) {
  const problems = [];

  if (!terminalNetHasKind(graph, display.id, 'vcc', 'power')) {
    problems.push('VCC não está ligado a uma alimentação');
  }

  if (!terminalNetHasKind(graph, display.id, 'gnd', 'ground')) {
    problems.push('GND não está ligado ao terra');
  }

  const missingSignals = requiredSignalTerminals.filter((terminalId) => {
    return !hub75SignalHasMicrocontrollerSource(graph, display, terminalId);
  });

  if (missingSignals.length > 0) {
    problems.push(`sinais sem GPIO válido: ${missingSignals.join(', ')}`);
  }

  return {
    ok: problems.length === 0,
    problems
  };
}

function hub75SignalHasMicrocontrollerSource(graph, display, terminalId) {
  const net = graph.findTerminalNet(display.id, terminalId);

  if (!net) {
    return false;
  }

  if (net.terminals.some((terminal) => isMicrocontrollerDigitalTerminal(graph, terminal))) {
    return true;
  }

  for (const terminal of net.terminals) {
    const buffer = graph.components.get(terminal.componentId);
    const oppositeTerminalId = opposite74ahct245Terminal(buffer, terminal.terminalId);

    if (!oppositeTerminalId || !isPowered74ahct245(graph, buffer)) {
      continue;
    }

    const inputNet = graph.findTerminalNet(buffer.id, oppositeTerminalId);

    if (inputNet?.terminals.some((inputTerminal) => isMicrocontrollerDigitalTerminal(graph, inputTerminal))) {
      return true;
    }
  }

  return false;
}

function opposite74ahct245Terminal(component, terminalId) {
  if (component?.componentId !== 'logic.buffer.74ahct245' && component?.type !== '74ahct245') {
    return null;
  }

  const match = terminalId.match(/^([ab])([1-8])$/);

  if (!match) {
    return null;
  }

  const [, side, channel] = match;
  const directionAToB = component.properties?.directionAToB !== false;
  const outputEnabled = component.properties?.outputEnabled !== false;

  if (!outputEnabled) {
    return null;
  }

  if (directionAToB && side === 'b') {
    return `a${channel}`;
  }

  if (!directionAToB && side === 'a') {
    return `b${channel}`;
  }

  return null;
}

function isPowered74ahct245(graph, buffer) {
  return Boolean(buffer)
    && terminalNetHasKind(graph, buffer.id, 'vcc', 'power')
    && terminalNetHasKind(graph, buffer.id, 'gnd', 'ground');
}

function terminalNetHasKind(graph, componentId, terminalId, kind) {
  const net = graph.findTerminalNet(componentId, terminalId);

  return Boolean(net?.terminals.some((terminal) => terminalMatchesKind(graph, terminal, kind)));
}

function terminalMatchesKind(graph, terminal, kind) {
  if (graph.terminalKind(terminal) === kind) {
    return true;
  }

  const component = graph.components.get(terminal.componentId);
  const definition = component?.terminals?.find((item) => item.id === terminal.terminalId);
  const declaredKind = definition?.kind ?? definition?.type;

  if (kind === 'power') {
    return declaredKind === 'power' || declaredKind === 'power-output';
  }

  if (kind === 'ground') {
    return declaredKind === 'ground';
  }

  return declaredKind === kind;
}

function isMicrocontrollerDigitalTerminal(graph, terminal) {
  const component = graph.components.get(terminal.componentId);
  const pin = component?.behavior?.pinMap?.[terminal.terminalId];

  return component?.behavior?.type === 'microcontroller' && pin?.capabilities?.includes('digital');
}
