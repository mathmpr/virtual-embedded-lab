export function register(registry) {
  registry.register({
    id: 'component-dht-library',
    libraries: ['DHT'],
    capabilities: ['temperature-humidity-sensor'],
    imports({ runtime }) {
      return {
        __vl_dhtBegin(pin, type) {
          return runtime.dhtBegin(Number(pin), Number(type)) ? 1 : 0;
        },
        __vl_dhtReadTemperature(pin, type) {
          return runtime.dhtReadTemperature(Number(pin), Number(type));
        },
        __vl_dhtReadHumidity(pin, type) {
          return runtime.dhtReadHumidity(Number(pin), Number(type));
        }
      };
    }
  });
}
