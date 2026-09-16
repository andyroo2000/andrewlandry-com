import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { tripYears, tripSegments, tripYearPath, tripSegmentPath, requestedTrip, tripSegmentUrl, createTripUrlSync } = await server.ssrLoadModule('/src/data/japan-trip-links.ts');
const { tripItems, itemAtTime } = await server.ssrLoadModule('/src/data/japan-trip-items.ts');
const slugs = JSON.parse(await readFile(new URL('../src/data/japan-trip-slugs.json', import.meta.url), 'utf8'));
const origin = 'https://andrewlandry.com';

for (const year of tripYears) {
  test(`${year}: every story has a unique, permanent link that seeks inside the correct cut`, () => {
    const segments = tripSegments[year];
    assert.equal(segments.length, tripItems[year].length);
    assert.equal(new Set(segments.map(item => item.slug)).size, segments.length);
    for (const segment of segments) {
      assert.match(segment.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/);
      assert.equal(slugs[segment.id], segment.slug);
      const href = origin + tripSegmentPath(year, segment.index);
      for (const link of [href, href.slice(0, -1)]) {
        const requested = requestedTrip(link);
        assert.equal(requested.year, year);
        assert.equal(itemAtTime(year, requested.seconds), segment.index);
        assert.equal(requested.seconds, segment.seconds);
      }
      if (segment.index) assert.ok(segment.seconds > tripItems[year][segment.index].at);
    }
  });

  test(`${year}: a year link starts at the beginning, and its path wins over an old year parameter`, () => {
    const href = origin + tripYearPath(year);
    assert.deepEqual(requestedTrip(href), { year, seconds: 0 });
    assert.deepEqual(requestedTrip(`${href}?trip=2020`), { year, seconds: 0 });
    assert.deepEqual(requestedTrip(`${href}?t=119`), { year, seconds: 119 });
  });
}

test('published Kamikawa and ferry links identify the intended original clips', () => {
  const kamikawa = requestedTrip(`${origin}/japan-cycling-trips/2026/kamikawa-01/?trip=2025&t=0`);
  assert.equal(kamikawa.year, '2026');
  assert.equal(tripItems['2026'][itemAtTime('2026', kamikawa.seconds)].id, '2026-1-016');
  const ferry = requestedTrip(`${origin}/japan-cycling-trips/2025/rishiri-01/`);
  assert.equal(tripItems['2025'][itemAtTime('2025', ferry.seconds)].id, '2025-1-048');
  assert.equal(Object.keys(slugs).length, tripYears.reduce((sum, year) => sum + tripItems[year].length, 0));
});

test('legacy links retain their exact timestamp, and invalid timestamps safely start at zero', () => {
  assert.deepEqual(requestedTrip(`${origin}/japan-cycling-trips/?trip=2025&t=386.27`), { year: '2025', seconds: 386.27 });
  assert.deepEqual(requestedTrip(`${origin}/japan-cycling-trips?t=119`), { year: '2026', seconds: 119 });
  for (const time of ['-10', 'Infinity', 'not-a-time', '']) {
    assert.deepEqual(requestedTrip(`${origin}/japan-cycling-trips/?t=${time}`), { year: '2026', seconds: 0 });
  }
});

test('unknown years, stories and extra path segments do not resolve to the wrong video', () => {
  for (const path of ['2024/', '2026/not-a-story/', '2025/kamikawa-01/', '2026/kamikawa-01/extra/']) {
    assert.equal(requestedTrip(`${origin}/japan-cycling-trips/${path}`), undefined);
  }
});

test('story URLs remove old playback parameters and preserve origin, unrelated parameters and fragments', () => {
  const url = tripSegmentUrl('2026', 15, 'https://www.andrewlandry.com/japan-cycling-trips/?trip=2025&t=300&utm_source=friend#main');
  assert.equal(url.href, 'https://www.andrewlandry.com/japan-cycling-trips/2026/kamikawa-01/?utm_source=friend#main');
});

test('playback changes history only at story boundaries, including backward seeks and year changes', () => {
  const original = globalThis.window;
  const calls = [];
  const state = { existing: 'page-state' };
  const location = { href: `${origin}/japan-cycling-trips/?trip=2026&t=123` };
  globalThis.window = { location, history: { state, replaceState(...args) { calls.push(args); location.href = args[2].href; } } };
  try {
    const sync = createTripUrlSync();
    sync('2026', 15);
    for (let tick = 0; tick < 100; tick++) sync('2026', 15);
    sync('2026', 16);
    sync('2026', 15);
    sync('2025', 15);
    assert.equal(calls.length, 4);
    assert.ok(calls.every(call => call[0] === state));
    assert.equal(location.href, origin + tripSegmentPath('2025', 15));
    createTripUrlSync()('2025', 15);
    assert.equal(calls.length, 4, 'loading an already-correct link needs no history write');
  } finally {
    globalThis.window = original;
  }
});
