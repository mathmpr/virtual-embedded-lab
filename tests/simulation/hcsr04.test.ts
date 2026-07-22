import test from 'node:test';
import assert from 'node:assert/strict';
import { ArduinoRuntime } from '../../packages/arduino-runtime/src/runtime.ts';
import { Hcsr04Behavior } from '../../packages/component-runtime/src/hcsr04.ts';
import { EnvironmentEngine } from '../../packages/environment-engine/src/environment.ts';
import { EventScheduler, VirtualClock } from '../../packages/simulation-kernel/src/scheduler.ts';

test('HC-SR04 schedules echo pulse proportional to distance', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler);
  const environment = new EnvironmentEngine();

  environment.createChannel({
    id: 'sensor-1.obstacleDistance',
    type: 'distance',
    value: 100,
    unit: 'cm',
    sourceComponentId: 'distance-1'
  });

  runtime.pinMode(7, 'OUTPUT');
  runtime.pinMode(6, 'INPUT');

  const sensor = new Hcsr04Behavior(clock, scheduler, environment, {
    readTrigger: () => runtime.digitalRead(7),
    driveEcho: (value) => runtime.driveInput(6, value)
  }, {
    minimumTriggerPulseUs: 10,
    echoMicrosecondsPerCentimeter: 58,
    echoStartDelayUs: 100,
    distanceChannelId: 'sensor-1.obstacleDistance'
  });

  sensor.setPowered(true);

  runtime.digitalWrite(7, 'HIGH');
  sensor.onTriggerChanged('HIGH');
  runtime.delayMicroseconds(10);
  runtime.digitalWrite(7, 'LOW');
  sensor.onTriggerChanged('LOW');

  const duration = runtime.pulseIn(6, 'HIGH', 30_000);

  assert.equal(duration, 5800);
  assert.equal(clock.nowUs(), 5910);
});
