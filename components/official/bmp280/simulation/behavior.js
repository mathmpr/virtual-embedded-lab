import { bindBmp280Sensors } from '../../../../apps/web/js/simulation/sensor-behavior-adapters.js';

export function register(registry) {
  registry.register('bmp280-sensor', bindBmp280Sensors);
}
