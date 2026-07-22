export function register(registry) {
  registry.register({
    id: 'component-servo-library',
    libraries: ['Servo'],
    capabilities: ['servo'],
    imports({ runtime }) {
      return {
        __vl_servoAttach(pin) {
          return runtime.servoAttach(Number(pin)) ? 1 : 0;
        },
        __vl_servoWrite(pin, angle) {
          runtime.servoWrite(Number(pin), Number(angle));
        },
        __vl_servoWriteMicroseconds(pin, pulseUs) {
          runtime.servoWriteMicroseconds(Number(pin), Number(pulseUs));
        }
      };
    }
  });
}
