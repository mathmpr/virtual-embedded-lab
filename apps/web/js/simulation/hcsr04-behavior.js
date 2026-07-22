export class Hcsr04Behavior {
  #triggerStartedAtUs = null;

  constructor({ component, clock, scheduler, environment, runtime, graph, channelId, pins }) {
    this.component = component;
    this.clock = clock;
    this.scheduler = scheduler;
    this.environment = environment;
    this.runtime = runtime;
    this.graph = graph;
    this.channelId = channelId;
    this.pins = pins;
  }

  onTrigger(value) {
    if (value === 'HIGH') {
      this.#triggerStartedAtUs ??= this.clock.nowUs();
      return;
    }

    if (this.#triggerStartedAtUs === null) {
      return;
    }

    const widthUs = this.clock.nowUs() - this.#triggerStartedAtUs;
    this.#triggerStartedAtUs = null;

    if (widthUs >= 10) {
      this.scheduleEcho();
    }
  }

  scheduleEcho() {
    const distanceCm = this.environment.read(this.channelId);
    const echoDurationUs = Math.round(distanceCm * 58);

    this.scheduler.scheduleIn(100, () => {
      this.runtime.driveInput(this.pins.echo, 'HIGH');
    }, `${this.component.id}.echo.high`);

    this.scheduler.scheduleIn(100 + echoDurationUs, () => {
      this.runtime.driveInput(this.pins.echo, 'LOW');
    }, `${this.component.id}.echo.low`);
  }
}
