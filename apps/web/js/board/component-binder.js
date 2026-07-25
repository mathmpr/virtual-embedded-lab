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

      if (event.target.closest('.terminal, input, textarea, select, button, [data-delete-component]')) {
        return;
      }

      selectComponent(model.id);

      if (state.boardLocked) {
        return;
      }

      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = model.x;
      originY = model.y;
      element.setPointerCapture(event.pointerId);
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

        selectComponent(model.id);

        if (state.boardLocked) {
          return;
        }

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

      if (state.boardLocked) {
        selectComponent(model.id);
        return;
      }

      deleteComponent(model.id);
    });
  }

  function bindInlineControls(element, model) {
    element.querySelectorAll('[data-property]').forEach((input) => {
      input.addEventListener('pointerdown', stopPropagation);

      if (input.matches('button[data-pulse-duration-ms]')) {
        input.addEventListener('click', (event) => {
          event.preventDefault();
          pulseProperty(input, model);
        });
        bindKeyboardPulseControl(input, model);
        return;
      }

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

  function pulseProperty(input, model) {
    const durationMs = Math.max(20, Number(input.dataset.pulseDurationMs) || 160);

    if (model.properties[input.dataset.property] === true) {
      return;
    }

    componentState.updateComponentProperty(model, input.dataset.property, true);
    window.setTimeout(() => {
      componentState.updateComponentProperty(model, input.dataset.property, false);
    }, durationMs);
  }

  function bindKeyboardPulseControl(input, model) {
    if (!input.dataset.keyProperty) {
      return;
    }

    window.addEventListener('keydown', (event) => {
      const key = model.properties[input.dataset.keyProperty];

      if (!state.components.has(model.id) || !key || event.repeat || shouldIgnoreKeyboardShortcut(event)) {
        return;
      }

      if (!keyboardKeyMatches(event, key)) {
        return;
      }

      event.preventDefault();
      pulseProperty(input, model);
    });
  }

  function keyboardKeyMatches(event, configuredKey) {
    const normalized = String(configuredKey ?? '').trim().toLowerCase();

    return normalized === event.key.toLowerCase()
      || normalized === event.code.toLowerCase();
  }

  function shouldIgnoreKeyboardShortcut(event) {
    return Boolean(event.target?.closest?.('.cm-editor, input, textarea, select, button'));
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
