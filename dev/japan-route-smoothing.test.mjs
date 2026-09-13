import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { smoothRide, distanceAtSourceFraction } = await server.ssrLoadModule('/src/data/japan-route-smoothing.ts');
const distancesFor = points => points.reduce((distances, point, i) => [...distances,
  i ? distances[i - 1] + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) : 0], []);
const sample = (points, distances, at) => {
  let i = 1;
  while (i < points.length - 1 && distances[i] < at) i++;
  const t = (at - distances[i - 1]) / (distances[i] - distances[i - 1] || 1);
  return points[i - 1].map((value, axis) => value + (points[i][axis] - value) * t);
};

test('small zigzags disappear without changing the source data or endpoints', () => {
  const points = Array.from({ length: 31 }, (_, i) => Object.freeze([i, i === 0 || i === 30 ? 0 : i % 2 ? .2 : -.2]));
  const result = smoothRide(Object.freeze(points), distancesFor(points));
  assert.deepEqual(result.points, [[0, 0], [30, 0]]);
  assert.deepEqual(result.sourceFractions, [0, 1]);
});

test('major bends stay in place but sharp corners become short rounded curves', () => {
  const points = [[0, 0], [100, 0], [100, 100]];
  const result = smoothRide(points, distancesFor(points));
  assert.deepEqual(result.points[0], points[0]);
  assert.deepEqual(result.points.at(-1), points.at(-1));
  assert.ok(result.points.some(([x, y]) => x > 99 && x < 100 && y > 0 && y < 1));
  assert.ok(result.points.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100));
  let maximumTurn = 0;
  for (let i = 1; i < result.points.length - 1; i++) {
    const [a, b, c] = result.points.slice(i - 1, i + 2);
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    maximumTurn = Math.max(maximumTurn, Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])));
  }
  assert.ok(maximumTurn < Math.PI / 8, 'no angular step larger than 22.5 degrees');
});

test('uneven simplification cannot shift a protected story along the remaining ride', () => {
  const points = Array.from({ length: 101 }, (_, i) => [i, i === 0 || i === 100 ? 0 : i % 2 ? .25 : -.25]);
  points.push([1000, 0]);
  const source = distancesFor(points), fraction = source[50] / source.at(-1);
  const result = smoothRide(points, source, [fraction]);
  const distances = distancesFor(result.points);
  const displayed = sample(result.points, distances, distanceAtSourceFraction(result.sourceFractions, distances, fraction));
  assert.ok(Math.hypot(displayed[0] - points[50][0], displayed[1] - points[50][1]) < 1.21);
  assert.ok(Math.abs(distances.at(-1) * fraction - 50) > 4, 'naively scaling by the shorter length would shift this story');
  for (let i = 1; i < result.sourceFractions.length; i++) assert.ok(result.sourceFractions[i] >= result.sourceFractions[i - 1]);
});

test('loops, repeated GPS samples and tiny recordings produce finite continuous paths', () => {
  for (const points of [[[2, 3]], [[2, 3], [2, 3]], [[0, 0], [1, 1]],
    [[0, 0], [0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]]) {
    const result = smoothRide(points, distancesFor(points), [.5]);
    assert.deepEqual(result.points[0], points[0]);
    assert.deepEqual(result.points.at(-1), points.at(-1));
    assert.ok(result.points.flat().every(Number.isFinite));
    assert.ok(Number.isFinite(distanceAtSourceFraction(result.sourceFractions, distancesFor(result.points), .5)));
  }
});
