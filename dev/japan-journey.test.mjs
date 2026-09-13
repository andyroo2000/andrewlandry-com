// Run with: node --test dev/japan-journey.test.mjs
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { buildJourney } = await server.ssrLoadModule('/src/data/japan-transfers.ts');
const { buildRouteMap } = await server.ssrLoadModule('/src/data/japan-route-map.ts');
const { sampleJourney, createTransferMarker } = await server.ssrLoadModule('/src/scripts/trip-transfer.ts');
const { createTripRoute } = await server.ssrLoadModule('/src/scripts/trip-route.ts');
const { tripItems } = await server.ssrLoadModule('/src/data/japan-trip-items.ts');
const journeys = Object.fromEntries(['2025', '2026'].map(year => [year, buildJourney(year, buildRouteMap(year))]));
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const samePoint = (a, b) => { near(a[0], b[0]); near(a[1], b[1]); };

for (const year of ['2025', '2026']) {
  test(`${year}: every leg joins the preceding leg; transport never adds cycling distance`, () => {
    const journey = journeys[year];
    journey.legs.forEach((leg, i) => {
      assert.ok(leg.end >= leg.start);
      if (i) {
        const previous = journey.legs[i - 1];
        near(leg.start, previous.end);
        samePoint(leg.points[0], previous.points.at(-1));
        near(leg.fromProgress, previous.toProgress);
      }
      if (!leg.activity) near(leg.fromProgress, leg.toProgress);
    });
    const route = buildRouteMap(year);
    assert.equal(journey.legs.filter(leg => leg.activity).length, route.segments.length);
    near(sampleJourney(journey, journey.total).progress, route.total);
    route.segments.forEach(segment => {
      const leg = journey.legs.find(leg => leg.activity === segment.activity && leg.segment === segment.segment);
      samePoint(leg.points[0], segment.points[0]);
      samePoint(leg.points.at(-1), segment.points.at(-1));
      assert.equal(leg.mode, 'bike');
    });
  });

  test(`${year}: smoothing keeps original-media locations close to their matched source points`, () => {
    const route = buildRouteMap(year), journey = journeys[year];
    tripItems[year].forEach((item, i) => {
      const source = item.routePosition;
      if (!source || journey.stops[i].locationBasis !== 'route') return;
      const frame = sampleJourney(journey, journey.stops[i].position);
      // Explicit ferry/train arrival anchors override a media ride match.
      if (frame.mode !== 'bike') return;
      assert.equal(frame.leg.activity, source.activity);
      const segment = route.segments.find(segment => segment.activity === source.activity && segment.segment === source.segment);
      const at = Math.max(0, Math.min(1, source.fraction)) * segment.distances.at(-1);
      let j = 1;
      while (j < segment.points.length - 1 && segment.distances[j] < at) j++;
      const a = segment.points[j - 1], b = segment.points[j];
      const t = (at - segment.distances[j - 1]) / (segment.distances[j] - segment.distances[j - 1] || 1);
      const original = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const displayed = frame.point;
      assert.ok(Math.hypot(original[0] - displayed[0], original[1] - displayed[1]) <= 1.21, `${item.id} moved along the ride`);
    });
  });

  test(`${year}: story positions never retreat and held photos retain their place`, () => {
    const journey = journeys[year];
    assert.equal(journey.stops.length, tripItems[year].length);
    journey.stops.forEach((stop, i) => {
      assert.ok(stop.position >= 0 && stop.position <= journey.total);
      if (!i) return;
      const previous = journey.stops[i - 1];
      assert.ok(stop.position >= previous.position);
      if (stop.locationBasis === 'previous' || stop.locationBasis === 'throwback') {
        assert.equal(stop.position, previous.position);
        assert.equal(stop.place, previous.place);
      }
      if (!tripItems[year][i].coordinates && stop.locationBasis !== 'station-arrival') assert.equal(stop.position, previous.position);
    });
  });

  test(`${year}: sampling through a skipped interval stays on every intervening path`, () => {
    const journey = journeys[year];
    let previousProgress = 0;
    // Check all geometry vertices, boundaries, and intervening midpoints. This
    // also covers the otherwise-unseen Rishiri rides between the return ferries.
    for (const leg of journey.legs) {
      leg.points.forEach((point, i) => {
        const position = leg.start + leg.distances[i];
        samePoint(sampleJourney(journey, position).point, point);
        if (i) {
          const middle = leg.start + (leg.distances[i - 1] + leg.distances[i]) / 2;
          const frame = sampleJourney(journey, middle);
          const a = leg.points[i - 1];
          samePoint(frame.point, [(a[0] + point[0]) / 2, (a[1] + point[1]) / 2]);
          assert.ok(frame.progress >= previousProgress - 1e-8);
          previousProgress = frame.progress;
        }
      });
    }

  });
}

test('known throwbacks hold instead of returning offshore or to earlier towns', () => {
  for (const [year, indices] of [['2025', [49, 50, 130, 131, 136, 137]], ['2026', [35, 36, 67, 89, 90, 98, 99, 104]]]) {
    for (const i of indices) {
      assert.equal(journeys[year].stops[i].locationBasis, 'throwback', `${year} item ${i}`);
      assert.equal(journeys[year].stops[i].position, journeys[year].stops[i - 1].position);
    }
  }
});

test('airport arrival, bus, and trains occur in the correct order', () => {
  const journey = journeys['2026'];
  const vehicles = journey.legs.filter(leg => !['dot', 'bike'].includes(leg.mode));
  assert.deepEqual(vehicles.map(leg => leg.mode), ['plane', 'bus', 'train', 'train']);
  near(journey.stops[1].position, vehicles[0].end);
  near(journey.stops[2].position, vehicles[1].end);
  near(journey.stops[5].position, vehicles[2].end);
  assert.ok(journey.stops.at(-1).position > vehicles[3].end);
  assert.equal(journey.stops.at(-1).place, 'Sapporo');
});

test('four ferries include the complete intervening island rides', () => {
  const journey = journeys['2025'];
  assert.deepEqual(journey.legs.filter(leg => leg.mode === 'ferry').map(leg => leg.destination),
    ['Rishiri Island', 'Rebun Island', 'Rishiri Island', 'Wakkanai']);
  const returning = journey.legs.filter(leg => leg.start >= journey.stops[63].position && leg.end <= journey.stops[64].position);
  assert.deepEqual(returning.filter(leg => leg.activity).map(leg => leg.activity), ['15022389167', '15030059216']);
});

test('Asahikawa to Tohma is cycling; the bus ends in Sapporo', () => {
  const journey = journeys['2026'];
  const ride = journey.legs.find(leg => leg.activity === '19129076576');
  const train = journey.legs.find(leg => leg.mode === 'train');
  const stationPosition = journey.stops[6].position;
  const tohmasPosition = journey.stops[7].position;
  const bus = journey.legs.filter(leg => leg.mode === 'bus');
  assert.equal(bus.length, 1);
  assert.equal(bus[0].destination, 'Sapporo');
  assert.ok(bus[0].end < ride.start);
  near(stationPosition, train.end);
  assert.ok(stationPosition < ride.start);
  assert.equal(journey.stops[6].place, 'Asahikawa');
  assert.equal(journey.stops[6].locationBasis, 'station-arrival');
  samePoint(sampleJourney(journey, stationPosition).point, train.points.at(-1));
  for (let i = 1; i <= 100; i++) {
    const frame = sampleJourney(journey, stationPosition + (tohmasPosition - stationPosition) * i / 100);
    assert.ok(['dot', 'bike'].includes(frame.mode), 'station exit and cycle-road footage must never use a transport icon');
    if (frame.mode === 'bike') assert.equal(frame.leg.activity, '19129076576');
  }
});

test('train clip arrives at the station, Strava card holds there, and cycling starts with the following clip', () => {
  const journey = journeys['2026'];
  const train = journey.legs.find(leg => leg.mode === 'train');
  assert.ok(journey.stops[4].position < train.start);
  near(journey.stops[5].position, train.end);
  near(journey.stops[6].position, train.end);
  assert.deepEqual(journey.stops[5], journey.stops[6], 'train video and summary card must have identical location and provenance');
  const interval = journey.legs.filter(leg => leg.end > journey.stops[6].position && leg.start < journey.stops[7].position);
  samePoint(interval[0].points[0], train.points.at(-1));
  assert.ok(interval.every(leg => ['dot', 'bike'].includes(leg.mode)));
  assert.equal(interval.at(-1).activity, '19129076576');
  const trainClipDuration = tripItems['2026'][6].at - tripItems['2026'][5].at;
  assert.ok(trainClipDuration > 3.5, 'Train must finish before the Strava card is revealed');
});

test('transport leaves a completed breadcrumb trail before cycling begins', () => {
  const journey = journeys['2026'];
  const rows = journey.legs.map(leg => ({
    dataset: { start: String(leg.start), end: String(leg.end) }, style: {}, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }));
  const route = createTripRoute({ querySelectorAll: () => [{ dataset: { route: '2026' }, querySelectorAll: () => rows }] });
  const trainIndex = journey.legs.findIndex(leg => leg.mode === 'train');
  const train = journey.legs[trainIndex];
  const rideIndex = journey.legs.findIndex(leg => leg.activity === '19129076576');
  route.draw('2026', (train.start + train.end) / 2);
  near(Number(rows[trainIndex].attributes['stroke-dashoffset']), .5);
  assert.equal(rows[trainIndex].style.visibility, 'visible');
  assert.equal(rows[rideIndex].style.visibility, 'hidden');
  route.draw('2026', journey.stops[5].position);
  near(Number(rows[trainIndex].attributes['stroke-dashoffset']), 0);
  assert.ok(rows.slice(trainIndex + 1).every(row => row.style.visibility === 'hidden'), 'Day 1 card ends at the station without advancing the bike approach');
  const atStation = structuredClone(rows.map(row => ({ style: row.style, attributes: row.attributes })));
  route.draw('2026', journey.stops[6].position);
  assert.deepEqual(rows.map(row => ({ style: row.style, attributes: row.attributes })), atStation, 'Strava card must not advance or reset the trail');
  route.draw('2026', journey.stops[7].position);
  near(Number(rows[trainIndex].attributes['stroke-dashoffset']), 0);
  assert.equal(rows[rideIndex].style.visibility, 'visible');
  route.draw('2026', train.start);
  assert.equal(rows[trainIndex].style.visibility, 'hidden');
});

test('marker switches from transport to the location dot while riding and at ride stops', () => {
  const pin = { dataset: { mode: 'dot' }, querySelector: () => ({ setAttribute() {} }) };
  const marker = createTransferMarker(pin);
  const journey = journeys['2026'];
  const bus = journey.legs.find(leg => leg.mode === 'bus');
  const train = journey.legs.find(leg => leg.mode === 'train');
  const ride = journey.legs.find(leg => leg.activity === '19129076576');
  const returnTrain = journey.legs.findLast(leg => leg.mode === 'train');
  for (const [leg, moving, expected] of [[bus, true, 'bus'], [train, true, 'train'],
    [ride, true, 'dot'], [ride, false, 'dot'], [returnTrain, true, 'train']]) {
    marker.draw(sampleJourney(journey, (leg.start + leg.end) / 2), moving, 1);
    assert.equal(pin.dataset.mode, expected);
  }
  marker.draw(sampleJourney(journey, journey.total), false, 1);
  assert.equal(pin.dataset.mode, 'dot');
});
