export function register(registry) {
  registry.register({
    id: 'component-rgb-matrix-panel-library',
    libraries: ['RGBmatrixPanel'],
    capabilities: ['rgb-matrix-display'],
    imports({ runtime, readCString }) {
      return {
        __vl_rgbMatrixBegin(width, height) {
          return runtime.rgbMatrixBegin('default', Number(width), Number(height)) ? 1 : 0;
        },
        __vl_rgbMatrixFillScreen(color) {
          runtime.rgbMatrixFillScreen('default', Number(color));
        },
        __vl_rgbMatrixDrawPixel(x, y, color) {
          runtime.rgbMatrixDrawPixel('default', Number(x), Number(y), Number(color));
        },
        __vl_rgbMatrixPrintText(x, y, textPointer, color) {
          runtime.rgbMatrixPrintText('default', Number(x), Number(y), readCString(textPointer), Number(color));
        }
      };
    }
  });
}
