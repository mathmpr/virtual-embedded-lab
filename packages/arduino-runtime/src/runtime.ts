import { EventScheduler, VirtualClock } from '../../simulation-kernel/src/scheduler.ts';

export type PinMode = 'INPUT' | 'OUTPUT';
export type DigitalValue = 'LOW' | 'HIGH';

export interface PinState {
  mode: PinMode;
  value: DigitalValue;
  lastChangedAtUs: number;
}

export class ArduinoRuntime {
  private readonly pins = new Map<number, PinState>();

  constructor(
    private readonly clock: VirtualClock,
    private readonly scheduler: EventScheduler
  ) {}

  pinMode(pin: number, mode: PinMode): void {
    this.validatePin(pin);
    const current = this.getPin(pin);
    this.pins.set(pin, { ...current, mode, lastChangedAtUs: this.clock.nowUs() });
  }

  digitalWrite(pin: number, value: DigitalValue): void {
    this.validatePin(pin);
    const current = this.getPin(pin);

    if (current.mode !== 'OUTPUT') {
      throw new Error(`Cannot digitalWrite to pin ${pin} configured as ${current.mode}`);
    }

    this.pins.set(pin, { ...current, value, lastChangedAtUs: this.clock.nowUs() });
  }

  driveInput(pin: number, value: DigitalValue): void {
    this.validatePin(pin);
    const current = this.getPin(pin);
    this.pins.set(pin, { ...current, value, lastChangedAtUs: this.clock.nowUs() });
  }

  digitalRead(pin: number): DigitalValue {
    this.validatePin(pin);
    return this.getPin(pin).value;
  }

  micros(): number {
    return this.clock.nowUs();
  }

  millis(): number {
    return Math.floor(this.clock.nowUs() / 1000);
  }

  delayMicroseconds(microseconds: number): void {
    this.scheduler.runUntil(this.clock.nowUs() + microseconds);
  }

  delay(milliseconds: number): void {
    this.delayMicroseconds(milliseconds * 1000);
  }

  pulseIn(pin: number, value: DigitalValue, timeoutMicroseconds = 1_000_000): number {
    const startedAt = this.clock.nowUs();
    const timeoutAt = startedAt + timeoutMicroseconds;

    while (this.digitalRead(pin) === value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    while (this.digitalRead(pin) !== value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    if (this.digitalRead(pin) !== value) {
      return 0;
    }

    const pulseStartedAt = this.clock.nowUs();

    while (this.digitalRead(pin) === value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    return this.clock.nowUs() - pulseStartedAt;
  }

  getPin(pin: number): PinState {
    return this.pins.get(pin) ?? { mode: 'INPUT', value: 'LOW', lastChangedAtUs: 0 };
  }

  private validatePin(pin: number): void {
    if (!Number.isInteger(pin) || pin < 0) {
      throw new Error(`Invalid Arduino pin: ${pin}`);
    }
  }
}
