export class VirtualClock {
  #timeUs = 0;

  nowUs() {
    return this.#timeUs;
  }

  setTimeUs(timeUs) {
    if (!Number.isFinite(timeUs) || timeUs < this.#timeUs) {
      throw new Error(`Invalid virtual time: ${timeUs}`);
    }

    this.#timeUs = timeUs;
  }
}

export class EventScheduler {
  #nextId = 1;
  #queue = [];

  constructor(clock) {
    this.clock = clock;
  }

  scheduleIn(delayUs, run, label = '') {
    return this.scheduleAt(this.clock.nowUs() + delayUs, run, label);
  }

  scheduleAt(timeUs, run, label = '') {
    const event = {
      id: this.#nextId++,
      timeUs,
      run,
      label,
      canceled: false
    };

    this.#queue.push(event);
    this.#queue.sort((left, right) => left.timeUs - right.timeUs || left.id - right.id);
    return event;
  }

  runNext() {
    while (this.#queue.length > 0) {
      const event = this.#queue.shift();

      if (event.canceled) {
        continue;
      }

      this.clock.setTimeUs(event.timeUs);
      event.run();
      return true;
    }

    return false;
  }

  runUntil(timeUs) {
    while (this.#queue.length > 0 && this.#queue[0].timeUs <= timeUs) {
      this.runNext();
    }

    this.clock.setTimeUs(timeUs);
  }
}
