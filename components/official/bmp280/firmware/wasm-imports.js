export function register(registry) {
  registry.register({
    id: 'component-bmp280-library',
    libraries: ['BMP280'],
    capabilities: ['i2c-sensor'],
    imports({ runtime }) {
      return {
        __vl_bmp280Begin(address) {
          return runtime.bmp280Begin(Number(address)) ? 1 : 0;
        },
        __vl_bmp280ReadTemperature(address) {
          return runtime.bmp280ReadTemperature(Number(address));
        },
        __vl_bmp280ReadPressure(address) {
          return runtime.bmp280ReadPressure(Number(address));
        }
      };
    }
  });
}
