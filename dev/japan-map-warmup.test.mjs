import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { scheduleMapWarmup } = await server.ssrLoadModule('/src/scripts/trip-map-warmup.ts');
const originalWindow = globalThis.window;
afterEach(() => { globalThis.window = originalWindow; });

function scheduler(idle = true) {
  const pending = new Map();
  let sequence = 0;
  const add = callback => { pending.set(++sequence, callback); return sequence; };
  const remove = id => pending.delete(id);
  globalThis.window = idle ? { requestIdleCallback: add, cancelIdleCallback: remove }
    : { setTimeout: add, clearTimeout: remove };
  return { pending, next() {
    const [id, callback] = pending.entries().next().value;
    pending.delete(id);
    callback();
  } };
}

for (const idle of [true, false]) {
  test(`prepares at most one tile per scheduling opportunity (${idle ? 'idle callbacks' : 'timer fallback'})`, () => {
    const queue = scheduler(idle), painted = [];
    scheduleMapWarmup([() => painted.push('first'), () => painted.push('second')]);
    assert.deepEqual(painted, [], 'Starting warmup must never block the story transition');
    queue.next();
    assert.deepEqual(painted, ['first']);
    queue.next();
    assert.deepEqual(painted, ['first', 'second']);
    assert.equal(queue.pending.size, 0);
  });
}

test('switching trips, resizing, or leaving the page cancels stale tile work', () => {
  const queue = scheduler(), painted = [];
  const cancel = scheduleMapWarmup([() => painted.push('old trip')]);
  const alreadyDispatched = queue.pending.values().next().value;
  cancel();
  assert.equal(queue.pending.size, 0);
  alreadyDispatched();
  assert.deepEqual(painted, [], 'Even an already dispatched callback must respect cancellation');
});
