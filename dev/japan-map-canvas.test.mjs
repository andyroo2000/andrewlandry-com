import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { mapRasterSettings } = await server.ssrLoadModule('/src/scripts/trip-map-canvas.ts');

function assertRasterBudget(width, height, ratio) {
  const { density, maxTiles } = mapRasterSettings({ width, height }, ratio);
  const tilePixels = 256 * density;
  const visibleTiles = (Math.ceil(width / 256) + 1) * (Math.ceil(height / 256) + 1);
  assert.ok(maxTiles >= visibleTiles, 'Visible tiles must not evict each other every frame');
  assert.ok(maxTiles * tilePixels ** 2 * 4 * 2 <= 128 * 1024 ** 2);
  assert.ok(width * height * density ** 2 <= 6_000_000);
  assert.ok(density <= ratio && density <= 2);
  assert.ok(Number.isInteger(tilePixels), 'Adjacent tiles must meet on physical pixel boundaries');
}

for (const [width, height] of [[1024, 768], [1357, 985], [1920, 1080], [2560, 1440], [3840, 2160], [7680, 4320]]) {
  test(`${width}×${height}: the cache fits a whole panning viewport without exceeding its memory budget`, () => {
    for (const ratio of [1, 1.25, 1.5, 2, 3]) assertRasterBudget(width, height, ratio);
  });
}
