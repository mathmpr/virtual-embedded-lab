import { bindI2cAdcConverters } from '../../../../apps/web/js/simulation/sensor-behavior-adapters.js';

export function register(registry) {
  registry.register('adc-i2c', bindI2cAdcConverters);
}
