export const boardWorld = {
  width: 4000,
  height: 2400,
  minScale: 0.35,
  maxScale: 2.2
};

export function createInitialBoardState() {
  return {
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
    runtime: {
      pinStates: {},
      analogPinStates: {}
    },
    running: false,
    signals: {
      trig: 0,
      echo: 0,
      led: 0
    },
    signalsByComponent: new Map(),
    signalsByNet: new Map()
  };
}
