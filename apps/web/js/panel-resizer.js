export function createBottomPanelResizer({ shell, handle }) {
  const minimumHeight = 190;
  const maximumRatio = 0.72;

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-bottom-panel');

    const onPointerMove = (moveEvent) => {
      const viewportHeight = window.innerHeight;
      const topbarHeight = 54;
      const availableHeight = viewportHeight - topbarHeight;
      const maximumHeight = Math.floor(availableHeight * maximumRatio);
      const nextHeight = clamp(viewportHeight - moveEvent.clientY, minimumHeight, maximumHeight);

      shell.style.setProperty('--bottom-panel-height', `${nextHeight}px`);
    };

    const onPointerUp = () => {
      document.body.classList.remove('resizing-bottom-panel');
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
    };

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  });
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}
