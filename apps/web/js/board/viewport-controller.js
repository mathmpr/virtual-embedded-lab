import { clamp } from './formatters.js';
import { boardWorld } from './state.js';

export function createViewportController({ board, boardViewport, state, getComponents, onViewportChanged }) {
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

  function toBoardPoint(clientX, clientY) {
    return screenToWorld(clientX, clientY);
  }

  function visibleCenterPoint() {
    const bounds = board.getBoundingClientRect();

    return screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  }

  function centerViewportOnContent() {
    const contentBounds = contentWorldBounds();
    const bounds = board.getBoundingClientRect();

    state.viewport.scale = 1;
    state.viewport.x = bounds.width / 2 - (contentBounds.x + contentBounds.width / 2);
    state.viewport.y = bounds.height / 2 - (contentBounds.y + contentBounds.height / 2);
    applyViewportTransform();
  }

  function applyViewportTransform() {
    boardViewport.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
    onViewportChanged?.();
  }

  function screenToWorld(clientX, clientY) {
    const bounds = board.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - state.viewport.x) / state.viewport.scale,
      y: (clientY - bounds.top - state.viewport.y) / state.viewport.scale
    };
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

  function contentWorldBounds() {
    const components = [...getComponents()];

    if (components.length === 0) {
      return {
        x: boardWorld.width / 2,
        y: boardWorld.height / 2,
        width: 0,
        height: 0
      };
    }

    const boxes = components.map((component) => ({
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

  return {
    bindBoardViewport,
    toBoardPoint,
    visibleCenterPoint,
    centerViewportOnContent,
    screenToWorld,
    applyViewportTransform
  };
}
