export type ScheduledEventHandler = () => void;

export interface ScheduledEvent {
  id: number;
  timeUs: number;
  label?: string;
  canceled: boolean;
  run: ScheduledEventHandler;
}

export class VirtualClock {
  private currentTimeUs = 0;

  nowUs(): number {
    return this.currentTimeUs;
  }

  setTimeUs(timeUs: number): void {
    if (!Number.isFinite(timeUs) || timeUs < this.currentTimeUs) {
      throw new Error(`Invalid virtual time: ${timeUs}`);
    }

    this.currentTimeUs = timeUs;
  }

  reset(): void {
    this.currentTimeUs = 0;
  }
}

export class EventScheduler {
  private nextId = 1;
  private readonly queue: ScheduledEvent[] = [];

  constructor(private readonly clock: VirtualClock) {}

  scheduleAt(timeUs: number, run: ScheduledEventHandler, label?: string): ScheduledEvent {
    if (!Number.isFinite(timeUs) || timeUs < this.clock.nowUs()) {
      throw new Error(`Cannot schedule event in the past: ${timeUs}`);
    }

    const event: ScheduledEvent = {
      id: this.nextId++,
      timeUs,
      label,
      canceled: false,
      run
    };

    this.queue.push(event);
    this.queue.sort((left, right) => left.timeUs - right.timeUs || left.id - right.id);

    return event;
  }

  scheduleIn(delayUs: number, run: ScheduledEventHandler, label?: string): ScheduledEvent {
    if (!Number.isFinite(delayUs) || delayUs < 0) {
      throw new Error(`Invalid delay: ${delayUs}`);
    }

    return this.scheduleAt(this.clock.nowUs() + delayUs, run, label);
  }

  cancel(event: ScheduledEvent): void {
    event.canceled = true;
  }

  runNext(): boolean {
    while (this.queue.length > 0) {
      const event = this.queue.shift();

      if (!event || event.canceled) {
        continue;
      }

      this.clock.setTimeUs(event.timeUs);
      event.run();
      return true;
    }

    return false;
  }

  runUntil(timeUs: number): void {
    if (timeUs < this.clock.nowUs()) {
      throw new Error(`Cannot run backwards to ${timeUs}`);
    }

    while (this.queue.length > 0 && this.queue[0].timeUs <= timeUs) {
      this.runNext();
    }

    this.clock.setTimeUs(timeUs);
  }

  clear(): void {
    this.queue.length = 0;
  }

  pendingCount(): number {
    return this.queue.filter((event) => !event.canceled).length;
  }
}
