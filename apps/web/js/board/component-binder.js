export function createComponentBinder({
  state,
  componentState,
  selectComponent,
  drawWires,
  renderInspector,
  recordHistory,
  handleTerminalClick,
  deleteComponent
}) {
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

    bindTerminals(element, model);
    bindDelete(element, model);
    bindInlineControls(element, model);
  }

  function bindTerminals(element, model) {
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
  }

  function bindDelete(element, model) {
    element.querySelector('[data-delete-component]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteComponent(model.id);
    });
  }

  function bindInlineControls(element, model) {
    element.querySelectorAll('[data-property]').forEach((input) => {
      input.addEventListener('pointerdown', stopPropagation);

      if (input.matches('input[type="range"]')) {
        input.addEventListener('input', () => {
          componentState.updateComponentProperty(model, input.dataset.property, inputValue(input));
        });
        input.addEventListener('change', () => {
          componentState.updateComponentProperty(model, input.dataset.property, inputValue(input), true);
        });
        return;
      }

      input.addEventListener('change', () => {
        componentState.updateComponentProperty(model, input.dataset.property, inputValue(input), true);
      });
    });
  }

  function inputValue(input) {
    if (input.type === 'checkbox') {
      return input.checked;
    }

    if (input.type === 'number' || input.type === 'range') {
      return Number(input.value);
    }

    return input.value;
  }

  function stopPropagation(event) {
    event.stopPropagation();
  }

  return {
    bindComponent
  };
}
