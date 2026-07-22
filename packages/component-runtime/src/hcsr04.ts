import type { DigitalValue } from '../../arduino-runtime/src/runtime.ts';
import { EnvironmentEngine } from '../../environment-engine/src/environment.ts';
import { EventScheduler, VirtualClock } from '../../simulation-kernel/src/scheduler.ts';

export interface Hcsr04Pins {
  readTrigger(): DigitalValue;
  driveEcho(value: DigitalValue): void;
}

export interface Hcsr04Options {
  minimumTriggerPulseUs: number;
  echoMicrosecondsPerCentimeter: number;
  echoStartDelayUs: number;
  distanceChannelId: string;
}

export class Hcsr04Behavior {
  private triggerStartedAtUs: number | null = null;
  private powered = false;

  constructor(
    private readonly clock: VirtualClock,
    private readonly scheduler: EventScheduler,
    private readonly environment: EnvironmentEngine,
    private readonly pins: Hcsr04Pins,
    private readonly options: Hcsr04Options
  ) {}

  setPowered(powered: boolean): void {
    this.powered = powered;

    if (!powered) {
      this.triggerStartedAtUs = null;
      this.pins.driveEcho('LOW');
    }
  }

  onTriggerChanged(value: DigitalValue): void {
    if (!this.powered) {
      return;
    }

    if (value === 'HIGH') {
      this.triggerStartedAtUs ??= this.clock.nowUs();
      return;
    }

    if (this.triggerStartedAtUs === null) {
      return;
    }

    const pulseWidthUs = this.clock.nowUs() - this.triggerStartedAtUs;
    this.triggerStartedAtUs = null;

    if (pulseWidthUs >= this.options.minimumTriggerPulseUs) {
      this.scheduleEcho();
    }
  }

  private scheduleEcho(): void {
    const distanceCm = this.environment.read<number>(this.options.distanceChannelId);
    const echoDurationUs = Math.round(distanceCm * this.options.echoMicrosecondsPerCentimeter);

    this.scheduler.scheduleIn(this.options.echoStartDelayUs, () => {
      this.pins.driveEcho('HIGH');
    }, 'hc-sr04.echo.high');

    this.scheduler.scheduleIn(this.options.echoStartDelayUs + echoDurationUs, () => {
      this.pins.driveEcho('LOW');
    }, 'hc-sr04.echo.low');
  }
}
