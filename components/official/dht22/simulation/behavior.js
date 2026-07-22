import { bindDhtSensors } from '../../../../apps/web/js/simulation/sensor-behavior-adapters.js';

export function register(registry) {
  registry.register('dht-sensor', bindDhtSensors);
}
