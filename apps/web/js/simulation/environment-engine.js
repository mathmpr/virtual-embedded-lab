export class EnvironmentEngine {
  #channels = new Map();

  createChannel(channel) {
    this.#channels.set(channel.id, { ...channel });
  }

  read(id) {
    const channel = this.#channels.get(id);

    if (!channel) {
      throw new Error(`Unknown environment channel: ${id}`);
    }

    return channel.value;
  }

  write(id, value) {
    const channel = this.#channels.get(id);

    if (!channel) {
      throw new Error(`Unknown environment channel: ${id}`);
    }

    channel.value = value;
  }

  snapshot() {
    return [...this.#channels.values()].map((channel) => ({ ...channel }));
  }
}
