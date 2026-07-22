export interface LedSeriesInput {
  supplyVoltage: number;
  forwardVoltage: number;
  resistanceOhms: number;
  recommendedCurrentAmps: number;
  minimumVisibleCurrentAmps: number;
  maximumCurrentAmps: number;
  resistorMaximumPowerWatts: number;
}

export interface ElectricalDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  message: string;
}

export interface LedSeriesResult {
  ledCurrentAmps: number;
  ledVoltageDrop: number;
  resistorVoltageDrop: number;
  resistorPowerWatts: number;
  ledBrightness: number;
  ledIsVisible: boolean;
  ledState: 'off' | 'low-current' | 'on' | 'overcurrent';
  diagnostics: ElectricalDiagnostic[];
}

export function solveLedSeriesCircuit(input: LedSeriesInput): LedSeriesResult {
  const diagnostics: ElectricalDiagnostic[] = [];

  if (input.resistanceOhms <= 0) {
    return {
      ledCurrentAmps: Number.POSITIVE_INFINITY,
      ledVoltageDrop: input.forwardVoltage,
      resistorVoltageDrop: input.supplyVoltage - input.forwardVoltage,
      resistorPowerWatts: Number.POSITIVE_INFINITY,
      ledBrightness: 1,
      ledIsVisible: true,
      ledState: 'overcurrent',
      diagnostics: [
        {
          severity: 'error',
          code: 'LED_WITHOUT_RESISTOR',
          message: 'LED connected without effective current-limiting resistance.'
        }
      ]
    };
  }

  const resistorVoltageDrop = Math.max(input.supplyVoltage - input.forwardVoltage, 0);
  const ledCurrentAmps = resistorVoltageDrop / input.resistanceOhms;
  const resistorPowerWatts = ledCurrentAmps * ledCurrentAmps * input.resistanceOhms;
  const ledBrightness = clamp(ledCurrentAmps / input.recommendedCurrentAmps, 0, 1);
  const ledIsVisible = ledCurrentAmps >= input.minimumVisibleCurrentAmps;
  const ledVoltageDrop = resistorVoltageDrop > 0 ? input.forwardVoltage : input.supplyVoltage;
  const ledState = ledIsVisible ? 'on' : ledCurrentAmps > 0 ? 'low-current' : 'off';

  if (input.supplyVoltage < input.forwardVoltage) {
    diagnostics.push({
      severity: 'warning',
      code: 'LED_INSUFFICIENT_VOLTAGE',
      message: `Supply voltage ${input.supplyVoltage.toFixed(2)} V is below LED forward voltage ${input.forwardVoltage.toFixed(2)} V.`
    });
  }

  if (ledCurrentAmps > 0 && ledCurrentAmps < input.minimumVisibleCurrentAmps) {
    diagnostics.push({
      severity: 'warning',
      code: 'LED_CURRENT_TOO_LOW',
      message: `LED current ${formatAmps(ledCurrentAmps)} is below visible minimum ${formatAmps(input.minimumVisibleCurrentAmps)}; resistance is likely too high.`
    });
  }

  if (ledCurrentAmps > input.maximumCurrentAmps) {
    diagnostics.push({
      severity: 'error',
      code: 'LED_OVERCURRENT',
      message: `LED current ${formatAmps(ledCurrentAmps)} exceeds maximum ${formatAmps(input.maximumCurrentAmps)}.`
    });
  }

  if (resistorPowerWatts > input.resistorMaximumPowerWatts) {
    diagnostics.push({
      severity: 'warning',
      code: 'RESISTOR_POWER_EXCEEDED',
      message: `Resistor power ${resistorPowerWatts.toFixed(3)} W exceeds rated ${input.resistorMaximumPowerWatts.toFixed(3)} W.`
    });
  }

  return {
    ledCurrentAmps,
    ledVoltageDrop,
    resistorVoltageDrop,
    resistorPowerWatts,
    ledBrightness,
    ledIsVisible,
    ledState,
    diagnostics
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatAmps(value: number): string {
  return `${(value * 1000).toFixed(1)} mA`;
}
