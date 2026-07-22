import { bindSpiAdcConverters } from '../../../../apps/web/js/simulation/sensor-behavior-adapters.js';

export function register(registry) {
  registry.register('adc-spi', bindSpiAdcConverters);
}
