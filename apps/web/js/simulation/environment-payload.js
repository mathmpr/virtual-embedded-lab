export function environmentPayloadForComponent(component) {
  const behavior = component.behavior ?? {};

  if (behavior.channel === 'distance') {
    return normalizeEnvironmentValue('distance', component.properties[behavior.valueProperty]);
  }

  if (behavior.channel === 'rain') {
    return normalizeEnvironmentValue('rain', {
      active: component.properties[behavior.activeProperty],
      intensityPercent: component.properties[behavior.intensityProperty]
    });
  }

  if (behavior.channel === 'light') {
    return normalizeEnvironmentValue('light', {
      enabled: component.properties[behavior.activeProperty],
      intensityPercent: component.properties[behavior.intensityProperty]
    });
  }

  if (behavior.channel === 'climate') {
    return normalizeEnvironmentValue('climate', {
      enabled: component.properties[behavior.activeProperty],
      temperatureC: component.properties[behavior.temperatureProperty],
      pressureHpa: component.properties[behavior.pressureProperty]
    });
  }

  if (behavior.channel === 'analog-voltage') {
    return normalizeEnvironmentValue('analog-voltage', {
      enabled: component.properties[behavior.activeProperty],
      voltageVolts: component.properties[behavior.voltageProperty]
    });
  }

  return normalizeEnvironmentValue(behavior.channel, component.properties[behavior.valueProperty]);
}

export function environmentUnitForComponent(component) {
  const behavior = component.behavior ?? {};
  const propertyName = behavior.valueProperty ?? behavior.voltageProperty ?? behavior.temperatureProperty;
  return component.propertySchema?.[propertyName]?.unit ?? null;
}

export function wifiEnvironmentPayload(wifiSignals) {
  return {
    networks: wifiSignals.map((wifiSignal) => normalizeWifiNetworkValue({
      ssid: wifiSignal.properties.ssid,
      internetAvailable: wifiSignal.properties.connected,
      strengthPercent: wifiSignal.properties.strengthPercent
    }))
  };
}

export function normalizeEnvironmentValue(channel, value) {
  if (channel === 'distance') {
    return Number(value ?? 150);
  }

  if (channel === 'rain') {
    return {
      active: Boolean(value?.active),
      intensityPercent: clamp(Number(value?.intensityPercent ?? 100), 0, 100)
    };
  }

  if (channel === 'light') {
    return {
      enabled: Boolean(value?.enabled ?? true),
      intensityPercent: clamp(Number(value?.intensityPercent ?? 50), 0, 100)
    };
  }

  if (channel === 'climate') {
    return {
      enabled: Boolean(value?.enabled ?? true),
      temperatureC: clamp(Number(value?.temperatureC ?? 25), -40, 85),
      pressureHpa: clamp(Number(value?.pressureHpa ?? 1013.25), 300, 1100)
    };
  }

  if (channel === 'analog-voltage') {
    return {
      enabled: Boolean(value?.enabled ?? true),
      voltageVolts: clamp(Number(value?.voltageVolts ?? 0), 0, 5)
    };
  }

  return value ?? null;
}

function normalizeWifiNetworkValue(value) {
  return {
    ssid: String(value?.ssid ?? 'VirtualLab'),
    internetAvailable: Boolean(value?.internetAvailable),
    strengthPercent: clamp(Number(value?.strengthPercent ?? 0), 0, 100)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
