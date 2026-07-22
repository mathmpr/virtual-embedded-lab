import { bindLcd16x2Displays } from '../../../../apps/web/js/simulation/sensor-behavior-adapters.js';

export function register(registry) {
  registry.register('lcd-16x2-i2c', bindLcd16x2Displays);
}
