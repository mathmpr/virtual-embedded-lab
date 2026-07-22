export function register(registry) {
  registry.register({
    id: 'component-lcd-i2c-library',
    libraries: ['LiquidCrystal_I2C'],
    capabilities: ['i2c-display'],
    imports({ runtime, readCString }) {
      return {
        __vl_lcdBegin(address, columns, rows) {
          return runtime.lcdBegin(Number(address), Number(columns), Number(rows)) ? 1 : 0;
        },
        __vl_lcdSetCursor(address, column, row) {
          runtime.lcdSetCursor(Number(address), Number(column), Number(row));
        },
        __vl_lcdPrint(address, valuePointer) {
          runtime.lcdPrint(Number(address), readCString(valuePointer));
        },
        __vl_lcdPrintInt(address, value) {
          runtime.lcdPrint(Number(address), Number(value));
        },
        __vl_lcdClear(address) {
          runtime.lcdClear(Number(address));
        },
        __vl_lcdBacklight(address, enabled) {
          runtime.lcdSetBacklight(Number(address), Boolean(enabled));
        }
      };
    }
  });
}
