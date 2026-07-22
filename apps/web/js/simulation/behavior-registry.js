export function createSimulationBehaviorRegistry() {
  const adapters = new Map();

  return {
    register(behaviorType, adapter) {
      if (!behaviorType || typeof adapter !== 'function') {
        return;
      }

      adapters.set(behaviorType, adapter);
    },
    bindAll(context) {
      const bindings = {
        rainBindings: [],
        lightBindings: [],
        buttonBindings: [],
        buzzerBindings: [],
        waterBindings: [],
        sevenSegmentBindings: []
      };

      for (const [behaviorType, adapter] of adapters.entries()) {
        const components = context.graph.findComponentsByBehaviorType(behaviorType);

        if (components.length === 0) {
          continue;
        }

        const result = adapter({ ...context, behaviorType, components }) ?? {};

        bindings.rainBindings.push(...(result.rainBindings ?? []));
        bindings.lightBindings.push(...(result.lightBindings ?? []));
        bindings.buttonBindings.push(...(result.buttonBindings ?? []));
        bindings.buzzerBindings.push(...(result.buzzerBindings ?? []));
        bindings.waterBindings.push(...(result.waterBindings ?? []));
        bindings.sevenSegmentBindings.push(...(result.sevenSegmentBindings ?? []));
      }

      return bindings;
    }
  };
}
