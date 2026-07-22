import test from 'node:test';
import assert from 'node:assert/strict';
import { EventScheduler, VirtualClock } from '../../packages/simulation-kernel/src/scheduler.ts';

test('scheduler executes events in deterministic time and insertion order', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const executed: string[] = [];

  scheduler.scheduleIn(20, () => executed.push('third'));
  scheduler.scheduleIn(10, () => executed.push('first'));
  scheduler.scheduleIn(10, () => executed.push('second'));

  scheduler.runUntil(20);

  assert.deepEqual(executed, ['first', 'second', 'third']);
  assert.equal(clock.nowUs(), 20);
});

test('scheduler skips canceled events', () => {
  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const executed: string[] = [];

  const canceled = scheduler.scheduleIn(10, () => executed.push('canceled'));
  scheduler.scheduleIn(20, () => executed.push('kept'));
  scheduler.cancel(canceled);

  scheduler.runUntil(20);

  assert.deepEqual(executed, ['kept']);
});
