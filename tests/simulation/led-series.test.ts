import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLedSeriesCircuit } from '../../packages/electrical-solver/src/led-series.ts';

test('solver computes current, power and brightness for LED with resistor', () => {
  const result = solveLedSeriesCircuit({
    supplyVoltage: 5,
    forwardVoltage: 2,
    resistanceOhms: 220,
    recommendedCurrentAmps: 0.01,
    minimumVisibleCurrentAmps: 0.001,
    maximumCurrentAmps: 0.02,
    resistorMaximumPowerWatts: 0.25
  });

  assert.equal(Number(result.ledCurrentAmps.toFixed(6)), 0.013636);
  assert.equal(Number(result.resistorPowerWatts.toFixed(4)), 0.0409);
  assert.equal(result.ledBrightness, 1);
  assert.deepEqual(result.diagnostics, []);
});

test('solver reports missing current limiting resistance', () => {
  const result = solveLedSeriesCircuit({
    supplyVoltage: 5,
    forwardVoltage: 2,
    resistanceOhms: 0,
    recommendedCurrentAmps: 0.01,
    minimumVisibleCurrentAmps: 0.001,
    maximumCurrentAmps: 0.02,
    resistorMaximumPowerWatts: 0.25
  });

  assert.equal(result.diagnostics[0].code, 'LED_WITHOUT_RESISTOR');
});

test('solver reports excessive resistance when LED current is below visible threshold', () => {
  const result = solveLedSeriesCircuit({
    supplyVoltage: 5,
    forwardVoltage: 2,
    resistanceOhms: 1000000,
    recommendedCurrentAmps: 0.01,
    minimumVisibleCurrentAmps: 0.001,
    maximumCurrentAmps: 0.02,
    resistorMaximumPowerWatts: 0.25
  });

  assert.equal(result.ledIsVisible, false);
  assert.equal(result.ledState, 'low-current');
  assert.equal(Number(result.ledCurrentAmps.toFixed(6)), 0.000003);
  assert.equal(result.diagnostics[0].code, 'LED_CURRENT_TOO_LOW');
});

test('solver reports insufficient voltage for LED forward voltage', () => {
  const result = solveLedSeriesCircuit({
    supplyVoltage: 1.8,
    forwardVoltage: 2,
    resistanceOhms: 220,
    recommendedCurrentAmps: 0.01,
    minimumVisibleCurrentAmps: 0.001,
    maximumCurrentAmps: 0.02,
    resistorMaximumPowerWatts: 0.25
  });

  assert.equal(result.ledIsVisible, false);
  assert.equal(result.ledState, 'off');
  assert.equal(result.ledCurrentAmps, 0);
  assert.equal(result.diagnostics[0].code, 'LED_INSUFFICIENT_VOLTAGE');
});
