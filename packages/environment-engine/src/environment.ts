export interface EnvironmentChannel<TValue = number> {
  id: string;
  type: string;
  value: TValue;
  unit?: string;
  sourceComponentId?: string;
  updatedAtUs: number;
}

export class EnvironmentEngine {
  private readonly channels = new Map<string, EnvironmentChannel>();

  createChannel<TValue>(channel: Omit<EnvironmentChannel<TValue>, 'updatedAtUs'>, timeUs = 0): void {
    if (this.channels.has(channel.id)) {
      throw new Error(`Environment channel already exists: ${channel.id}`);
    }

    this.channels.set(channel.id, { ...channel, updatedAtUs: timeUs });
  }

  setValue<TValue>(id: string, value: TValue, timeUs: number): void {
    const channel = this.channels.get(id);

    if (!channel) {
      throw new Error(`Unknown environment channel: ${id}`);
    }

    this.channels.set(id, { ...channel, value, updatedAtUs: timeUs });
  }

  read<TValue = number>(id: string): TValue {
    const channel = this.channels.get(id);

    if (!channel) {
      throw new Error(`Unknown environment channel: ${id}`);
    }

    return channel.value as TValue;
  }

  snapshot(): EnvironmentChannel[] {
    return [...this.channels.values()].map((channel) => ({ ...channel }));
  }
}
