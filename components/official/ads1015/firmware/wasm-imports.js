export function register(registry) {
  registry.register({
    id: 'component-ads-library',
    libraries: ['ADS1015', 'ADS1115'],
    capabilities: ['i2c-adc'],
    imports({ runtime }) {
      return {
        __vl_adcBegin(address, type) {
          const expectedType = Number(type) === 1015 ? 'ads1015' : 'ads1115';
          return runtime.adcBegin(Number(address), expectedType) ? 1 : 0;
        },
        __vl_adcReadSingleEnded(address, channel) {
          return runtime.adcReadSingleEnded(Number(address), Number(channel));
        },
        __vl_adcComputeVolts(address, raw) {
          return runtime.adcComputeVolts(Number(address), Number(raw));
        }
      };
    }
  });
}
