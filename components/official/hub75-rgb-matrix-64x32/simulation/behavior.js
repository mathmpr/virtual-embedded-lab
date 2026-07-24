export function register(registry) {
  registry.register('hub75-rgb-matrix', bindHub75RgbMatrices);
}

function bindHub75RgbMatrices({ runtime, components }) {
  for (const display of components) {
    const behavior = display.behavior ?? {};
    const displayId = behavior.displayId ?? 'default';

    runtime.registerRgbMatrixDisplay(displayId, {
      component: display,
      width: Number(display.properties[behavior.widthProperty ?? 'widthPixels'] ?? 64),
      height: Number(display.properties[behavior.heightProperty ?? 'heightPixels'] ?? 32),
      framebufferProperty: behavior.framebufferProperty ?? 'framebuffer'
    });
  }
}
