import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { geoPath } from 'd3-geo';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { createTripLabels } = await server.ssrLoadModule('/src/scripts/trip-labels.ts');
const { layoutTripLabels } = await server.ssrLoadModule('/src/scripts/trip-label-layout.ts');
const { createLabelLandTest } = await server.ssrLoadModule('/src/scripts/trip-label-land.ts');
const { mapPlaces } = await server.ssrLoadModule('/src/data/hokkaido-places.ts');
const { mapProjection } = await server.ssrLoadModule('/src/data/japan-route-map.ts');
const path = geoPath(mapProjection);
const coast = path(JSON.parse(readFileSync(new URL('../public/data/hokkaido-coastline.json', import.meta.url), 'utf8')));
const lakes = path(JSON.parse(readFileSync(new URL('../public/data/hokkaido-lakes.json', import.meta.url), 'utf8')));
const isLand = createLabelLandTest(coast, lakes);
const places = mapPlaces.map(place => ({ ...place, point: mapProjection(place.coordinates) }));
const measured = places.map(place => ({ ...place, textWidth: place.japanese.length * 17.5,
  fontSize: place.kind === 'mountain' ? 14 : 16 }));

function element() {
  return { attributes: {}, dataset: {}, setAttribute(name, value) { this.attributes[name] = value; } };
}
function setup() {
  const nodes = places.map(() => {
    const text = element();
    return { ...element(), text, querySelector: () => text };
  });
  const layer = { dataset: { places: JSON.stringify(places) }, querySelectorAll: () => nodes };
  const root = { querySelector: selector => {
    if (selector === '[data-map-labels]') return layer;
    if (selector === '#hokkaido-land' || selector === '[data-lakes]') return { getAttribute: () => selector === '#hokkaido-land' ? coast : lakes };
    return { querySelector: () => element() };
  } };
  return { labels: createTripLabels(root), nodes };
}
const fixedLayout = nodes => nodes.map(node => ({ opacity: node.attributes.opacity, x: node.text.attributes.x, y: node.text.attributes.y }));

test('panning across screen edges and changing current towns cannot hide or reposition labels', () => {
  const { labels, nodes } = setup();
  labels.select('2026', 'Fukagawa');
  labels.draw({ width: 1440, height: 900, x: 800, y: 670, scale: 1.897, zoom: 2.15 });
  const initial = fixedLayout(nodes);
  for (let i = 0; i < 50; i++) {
    labels.select('2026', ['Asahikawa', 'Tohma', 'Sapporo', ''][i % 4]);
    labels.draw({ width: 1440, height: 900, x: 800 + i * 20, y: 670 - i * 20, scale: 1.897, zoom: 2.15 });
    assert.deepEqual(fixedLayout(nodes), initial);
  }
});

for (const year of ['2025', '2026']) for (const scale of [1.3, 1.897, 2.6]) {
  test(`${year}, scale ${scale}: labels and active names stay on land without overlaps`, () => {
    const layout = layoutTripLabels(measured, { year, scale, zoom: 2.15, isLand });
    const boxes = layout.flatMap((placement, i) => {
      if (!placement) return [];
      const label = measured[i], size = Math.max(18, label.fontSize);
      const x = label.point[0] * scale + placement.dx, y = label.point[1] * scale + placement.dy;
      return [{ name: label.japanese, left: x - 6, right: x + label.textWidth * size / label.fontSize + 6,
        top: y - size - 5, bottom: y + 6 }];
    });
    assert.ok(boxes.length > 25);
    for (const box of boxes) assert.ok(isLand({ left: box.left / scale, right: box.right / scale,
      top: box.top / scale, bottom: box.bottom / scale }), `${box.name} touches water`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(!(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top), `${a.name} overlaps ${b.name}`);
    }
    for (const name of ['Fukagawa', 'Asahikawa', 'Sapporo', ...(year === '2026' ? ['Tohma'] : [])]) {
      assert.ok(layout[places.findIndex(place => place.name === name)], `${name} must be selected`);
    }
  });
}

test('land clearance detects bays, enclosed lakes, holes and shoreline contact', () => {
  // A bay reaches into the top of the island; a small lake lies inland.
  const testLand = createLabelLandTest('M0,0L40,0L40,40L60,40L60,0L100,0L100,100L0,100Z',
    'M70,70L80,70L80,80L70,80ZM73,73L77,73L77,77L73,77Z');
  assert.equal(testLand({ left: 10, top: 10, right: 30, bottom: 30 }), true);
  assert.equal(testLand({ left: -20, top: 10, right: -10, bottom: 30 }), false);
  assert.equal(testLand({ left: 20, top: 20, right: 80, bottom: 50 }), false, 'all four corners are on land but a bay intersects');
  assert.equal(testLand({ left: 65, top: 65, right: 85, bottom: 85 }), false, 'small enclosed lake must not be missed');
  assert.equal(testLand({ left: 71, top: 71, right: 72, bottom: 72 }), false);
  assert.equal(testLand({ left: 74, top: 74, right: 76, bottom: 76 }), true, 'island inside a lake remains land');
  assert.equal(testLand({ left: 10, top: 10, right: 40, bottom: 30 }), false, 'even touching a shoreline is rejected');
});

test('sea and ocean names are not included', () => {
  assert.ok(places.every(place => !['日本海', 'オホーツク海', '太平洋'].includes(place.japanese)));
});
