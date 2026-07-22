export function resolveDigitalPinConnectedToTerminal(graph, terminal) {
  return resolveConnectedPinNumber(graph, terminal, {
    capability: 'digital',
    numberField: 'number'
  });
}

export function resolveAnalogPinConnectedToTerminal(graph, terminal) {
  return resolveConnectedPinNumber(graph, terminal, {
    capability: 'analog',
    numberField: 'analogNumber'
  });
}

export function resolveI2cBusConnected(graph, component, terminals = {}) {
  const sdaTerminal = terminals.sda ?? component.behavior?.i2cTerminals?.sda ?? 'sda';
  const sclTerminal = terminals.scl ?? component.behavior?.i2cTerminals?.scl ?? 'scl';

  return resolveTwoWireBus(graph, component, {
    terminals: { sda: sdaTerminal, scl: sclTerminal },
    capabilities: { sda: 'i2c-sda', scl: 'i2c-scl' },
    manifestBus: 'i2c'
  });
}

export function resolveSpiBusConnected(graph, component, terminals = {}) {
  const sckTerminal = terminals.sck ?? component.behavior?.spiTerminals?.sck ?? 'clk';
  const misoTerminal = terminals.miso ?? component.behavior?.spiTerminals?.miso ?? 'dout';
  const mosiTerminal = terminals.mosi ?? component.behavior?.spiTerminals?.mosi ?? 'din';

  return resolveThreeWireBus(graph, component, {
    terminals: { sck: sckTerminal, miso: misoTerminal, mosi: mosiTerminal },
    capabilities: { sck: 'spi-sck', miso: 'spi-miso', mosi: 'spi-mosi' },
    manifestBus: 'spi'
  });
}

export function resolveChipSelectPinConnectedToTerminal(graph, terminal) {
  return resolveConnectedPinNumber(graph, terminal, {
    capability: 'spi-cs',
    fallbackCapability: 'digital',
    numberField: 'number'
  });
}

function resolveConnectedPinNumber(graph, terminal, { capability, fallbackCapability = null, numberField }) {
  const pin = findConnectedBoardPin(graph, terminal, [capability]);

  if (pin && Number.isInteger(pin[numberField])) {
    return pin[numberField];
  }

  if (pin && numberField === 'analogNumber' && Number.isInteger(pin.number)) {
    return pin.number;
  }

  const fallback = fallbackCapability ? findConnectedBoardPin(graph, terminal, [fallbackCapability]) : null;

  if (fallback && Number.isInteger(fallback[numberField])) {
    return fallback[numberField];
  }

  if (fallback && numberField === 'analogNumber' && Number.isInteger(fallback.number)) {
    return fallback.number;
  }

  return null;
}

function resolveTwoWireBus(graph, component, { terminals, capabilities, manifestBus }) {
  for (const board of graph.findComponentsByBehaviorType('microcontroller')) {
    for (const bus of board.behavior?.buses?.[manifestBus] ?? []) {
      if (pinConnectedToComponentTerminal(graph, board, bus.sda, component, terminals.sda)
        && pinConnectedToComponentTerminal(graph, board, bus.scl, component, terminals.scl)) {
        return { board, bus };
      }
    }
  }

  const sda = findConnectedBoardPin(graph, { componentId: component.id, terminalId: terminals.sda }, [capabilities.sda]);
  const scl = findConnectedBoardPin(graph, { componentId: component.id, terminalId: terminals.scl }, [capabilities.scl]);

  if (sda && scl && sda.board.id === scl.board.id) {
    return {
      board: sda.board,
      bus: {
        id: manifestBus,
        sda: sda.terminalId,
        scl: scl.terminalId
      }
    };
  }

  return null;
}

function resolveThreeWireBus(graph, component, { terminals, capabilities, manifestBus }) {
  for (const board of graph.findComponentsByBehaviorType('microcontroller')) {
    for (const bus of board.behavior?.buses?.[manifestBus] ?? []) {
      if (pinConnectedToComponentTerminal(graph, board, bus.sck, component, terminals.sck)
        && pinConnectedToComponentTerminal(graph, board, bus.miso, component, terminals.miso)
        && pinConnectedToComponentTerminal(graph, board, bus.mosi, component, terminals.mosi)) {
        return { board, bus };
      }
    }
  }

  const sck = findConnectedBoardPin(graph, { componentId: component.id, terminalId: terminals.sck }, [capabilities.sck]);
  const miso = findConnectedBoardPin(graph, { componentId: component.id, terminalId: terminals.miso }, [capabilities.miso]);
  const mosi = findConnectedBoardPin(graph, { componentId: component.id, terminalId: terminals.mosi }, [capabilities.mosi]);

  if (sck && miso && mosi && sck.board.id === miso.board.id && sck.board.id === mosi.board.id) {
    return {
      board: sck.board,
      bus: {
        id: manifestBus,
        sck: sck.terminalId,
        miso: miso.terminalId,
        mosi: mosi.terminalId
      }
    };
  }

  return null;
}

function findConnectedBoardPin(graph, terminal, capabilities) {
  const net = graph.findTerminalNet(terminal.componentId, terminal.terminalId);

  if (!net) {
    return null;
  }

  for (const board of graph.findComponentsByBehaviorType('microcontroller')) {
    for (const netTerminal of net.terminals) {
      if (netTerminal.componentId !== board.id) {
        continue;
      }

      const pin = board.behavior?.pinMap?.[netTerminal.terminalId];

      if (pinHasAnyCapability(pin, capabilities)) {
        return {
          ...pin,
          board,
          terminalId: netTerminal.terminalId
        };
      }
    }
  }

  return null;
}

function pinConnectedToComponentTerminal(graph, board, boardTerminalId, component, componentTerminalId) {
  return Boolean(boardTerminalId && componentTerminalId) && graph.areConnected(
    { componentId: board.id, terminalId: boardTerminalId },
    { componentId: component.id, terminalId: componentTerminalId }
  );
}

function pinHasAnyCapability(pin, capabilities) {
  if (!pin) {
    return false;
  }

  return capabilities.some((capability) => pin.capabilities?.includes(capability));
}
