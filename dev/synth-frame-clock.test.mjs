import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { createFrameClock } = await server.ssrLoadModule('/src/scripts/synth-frame-clock.ts');

test('background rendering retains 60 fps without following high-refresh screens above it', () => {
  for (const refreshRate of [30, 60, 90, 120, 144, 240]) {
    const shouldDraw = createFrameClock();
    const timestamps = Array.from({ length: refreshRate * 10 }, (_, frame) => frame * 1000 / refreshRate);
    assert.equal(timestamps.filter(shouldDraw).length, Math.min(60, refreshRate) * 10);
  }
});

test('returning after a pause draws once, without a burst of catch-up frames', () => {
  const shouldDraw = createFrameClock();
  assert.equal(shouldDraw(0), true);
  assert.equal(shouldDraw(8), false);
  assert.equal(shouldDraw(10000), true);
  assert.equal(shouldDraw(10001), false);
  assert.equal(shouldDraw(10008), false);
  assert.equal(shouldDraw(10017), true);
});

test('ordinary display jitter and an arbitrary clock phase do not discard 60 Hz frames', () => {
  for (const phase of [0, 4.3, 16.5, 1834.75]) {
    const shouldDraw = createFrameClock();
    const timestamps = Array.from({ length: 600 }, (_, frame) => phase + frame * 1000 / 60 + Math.sin(frame * .7) * .8);
    assert.equal(timestamps.filter(shouldDraw).length, 600);
  }
});
