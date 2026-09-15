import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { drawRipple, RIPPLE_PALETTE } = await server.ssrLoadModule('/src/scripts/synth-ripple.ts');
const { buildRippleEvents, activeRippleEvents, createRippleEventReader, RAIN_ENTRY_SECONDS } = await server.ssrLoadModule('/src/scripts/synth-ripple-events.ts');
const { buildRainPlan, sampleRainDrop, rainGate, createRainPlanReader } = await server.ssrLoadModule('/src/scripts/synth-ripple-rain.ts');
const { createRippleFloor } = await server.ssrLoadModule('/src/scripts/synth-ripple-floor.ts');
const { paintNeonObject } = await server.ssrLoadModule('/src/scripts/synth-rain-objects.ts');
const { visualModes } = await server.ssrLoadModule('/src/scripts/synth-visual-types.ts');
const originalPath = globalThis.Path2D;
globalThis.Path2D = class { constructor(data) { this.data = data; } };
after(() => { globalThis.Path2D = originalPath; });
const quiet = { level: 0, bass: 0, mid: 0, high: 0, deepBass: 0 };
const base = { time: 20, depth: .35, dark: true, audio: quiet };
const viewport = { width: 1440, height: 900 };

function makeTrack(notes = []) {
  const frames = new Uint8Array(201 * 4);
  for (const [seconds, band, volume] of notes) {
    const offset = Math.round(seconds * 20) * 4;
    frames[offset] = Math.round(volume * 255);
    frames[offset + band + 1] = Math.round(volume * 255);
  }
  return { videoId: 'test-song', duration: 10, fps: 20, frames };
}

function drawingContext(shapes, layer) {
  let position;
  let angle;
  let radius;
  const capture = () => shapes.push({ position, angle, radius, color: context.fillStyle, alpha: context.globalAlpha, layer });
  const context = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, arc() {}, moveTo() {}, lineTo() {}, rect() {}, clip() {}, fillRect() {},
    translate(x, y) { position = [x, y]; },
    rotate(value) { angle = value; },
    scale(value) { radius = value; },
    fill: capture, stroke: capture,
  };
  return context;
}

function render(settings = base) {
  const shapes = [];
  drawRipple(drawingContext(shapes, 'rain'), viewport, settings, drawingContext(shapes, 'floor'));
  return shapes;
}

test('new bass, midrange and treble attacks produce events at their playback times with distinct strengths', () => {
  const notes = [[1, 0, .25], [2, 0, 1], [3, 1, .6], [4, 2, .9]];
  const events = buildRippleEvents(makeTrack(notes));
  assert.equal(events.length, notes.length);
  events.forEach((event, index) => {
    assert.ok(Math.abs(event.born - notes[index][0]) < .05);
    assert.equal(event.band, notes[index][1]);
  });
  assert.ok(events[1].energy > events[0].energy * 3);
  const sustained = makeTrack();
  sustained.frames.fill(150);
  assert.equal(buildRippleEvents(sustained).length, 3, 'one onset per band, not a new shape on every frame of a held tone');
  assert.equal(buildRippleEvents(makeTrack()).length, 0);
});

function planFor(events, size = viewport) {
  return buildRainPlan(events, { ...size, depth: .35 });
}

test('stronger hits trade small showers for two medium shapes or one large shape', () => {
  const event = { id: 7, born: 0, band: 0, energy: .2 };
  const small = planFor([event]);
  const medium = planFor([{ ...event, energy: .6 }]);
  const large = planFor([{ ...event, energy: 1 }]);
  assert.ok(small.length >= 4 && small.length <= 6);
  assert.ok(small[0].radius < 8, 'soft hits retain the tiny size');
  assert.equal(medium.length, 2);
  assert.equal(large.length, 1);
  assert.equal(medium[0].radius, small[0].radius * 2);
  assert.equal(large[0].radius, small[0].radius * 4);
  const showerCounts = new Set(Array.from({ length: 30 }, (_, id) => planFor([{ ...event, id }]).length));
  assert.deepEqual([...showerCounts].sort(), [4, 5, 6]);
});

test('shapes enter above the screen, fall straight down, and keep musical differences in size and spin', () => {
  const event = { id: 7, born: 0, band: 0, energy: 1 };
  const [bass] = planFor([event]);
  const [treble] = planFor([{ ...event, band: 2 }]);
  assert.ok(bass.radius > treble.radius);
  assert.ok(Math.abs(treble.spin) > Math.abs(bass.spin) * 3);
  assert.ok(bass.landing > 8 && bass.landing < 10);
  const birth = sampleRainDrop(bass, bass.born);
  assert.ok(birth.y + birth.radius < 0, 'birth is completely outside the viewport');
  const middle = sampleRainDrop(bass, bass.landing / 2);
  const entry = sampleRainDrop(bass, bass.born + .2);
  assert.ok(entry.y - entry.radius > 0, 'the hit is fully visible within 200 milliseconds');
  assert.ok(middle.y > 0 && middle.y < bass.restY);
  assert.equal(middle.radius, birth.radius, 'no on-screen pop or scale-in');
  assert.equal(middle.alpha, birth.alpha, 'the rain does not fade before landing');
  for (const progress of [.1, .5, .9, 1]) {
    assert.equal(sampleRainDrop(bass, bass.landing * progress).x, birth.x, 'the fall has no sideways drift');
  }
});

test('entrances begin before upcoming sounds and every shape in a burst arrives on the beat', () => {
  const track = makeTrack([[2, 0, .25]]);
  const events = buildRippleEvents(track);
  const hit = events[0].born;
  const launch = hit - RAIN_ENTRY_SECONDS;
  assert.equal(activeRippleEvents(events, launch - .001).length, 0);
  const upcoming = activeRippleEvents(events, launch + .1);
  assert.equal(upcoming.length, 1, 'the next hit is available during its pre-beat entrance');
  const burst = planFor(upcoming);
  assert.ok(burst.length >= 4);
  for (const drop of burst) {
    assert.equal(sampleRainDrop(drop, launch - .001), undefined);
    assert.equal(drop.born, launch, 'all shapes in the hit share its lead-in');
    const arrival = sampleRainDrop(drop, hit);
    const expectedY = -drop.radius - 24 + drop.fallSpeed * RAIN_ENTRY_SECONDS + drop.launchDistance;
    assert.ok(Math.abs(arrival.y - expectedY) < 1e-8, 'the fast entrance is complete at the audio timestamp');
    assert.ok(arrival.y - arrival.radius > 0);
  }
  const settings = { ...base, timeline: { track, seconds: launch + .1 } };
  const beforeBeat = render(settings);
  assert.ok(beforeBeat.length > 0);
  render({ ...settings, timeline: { track, seconds: hit + 1 } });
  assert.deepEqual(render(settings), beforeBeat, 'seeking back reconstructs the same lead-in');
  assert.deepEqual(render({ ...settings, timeline: { track, seconds: launch - .01 } }), []);
});

test('landed shapes overlap on one floor level without snapping into rows or stacking', () => {
  const events = Array.from({ length: 45 }, (_, id) => ({ id, born: id * .18, band: id % 3, energy: .7 }));
  const pile = planFor(events).filter(drop => drop.landing < 20);
  assert.ok(pile.length > 20);
  assert.ok(pile.some((drop, index) => pile.slice(index + 1).some(other => Math.abs(drop.restX - other.restX) < drop.radius + other.radius)), 'neighbors can overlap');
  for (const drop of pile) {
    assert.equal(drop.restX, drop.startX, 'landing keeps the random horizontal position');
    assert.equal(drop.restY + drop.radius, viewport.height - 8, 'every shape rests on the same floor');
    const settled = sampleRainDrop(drop, drop.landing + 1);
    assert.deepEqual(sampleRainDrop(drop, 22), settled, 'resting shapes do not keep spinning or fading');
  }
});

test('after the quick entrance, all sizes fall at one speed with uninterrupted arrivals through clearing', () => {
  const events = Array.from({ length: 90 }, (_, id) => ({ id, born: 11 + id * .1, band: id % 3, energy: [.2, .6, 1][id % 3] }));
  for (const size of [viewport, { width: 390, height: 844 }]) {
    const rain = planFor(events, size);
    for (const drop of rain) {
      assert.ok(Math.abs(drop.landing - drop.born - (rain[0].landing - rain[0].born)) < 1e-10, 'the floor cycle never delays an arrival');
      const before = sampleRainDrop(drop, drop.born + 5);
      const after = sampleRainDrop(drop, drop.born + 5.1);
      assert.ok(Math.abs((after.y - before.y) - (size.height + 16) / 100) < 1e-8, 'every shape has the same downward velocity');
      const joined = sampleRainDrop(drop, drop.born + .32);
      const justBefore = sampleRainDrop(drop, drop.born + .3199);
      const justAfter = sampleRainDrop(drop, drop.born + .3201);
      assert.ok(Math.abs((joined.y - justBefore.y) - (justAfter.y - joined.y)) < .0001, 'the entrance joins normal motion without a speed jump');
    }
    for (const time of [22.9, 23.5, 25, 28]) {
      assert.ok(rain.some(drop => {
        const point = sampleRainDrop(drop, time);
        return point && !point.grounded && point.y < drop.restY && point.y > drop.restY - 35;
      }), 'falling rain continues right down to the floor before and during clearing');
    }
  }
});

test('the middle opens, the pile slides inward and falls below the screen, then the doors close', () => {
  const [drop] = planFor([{ id: 7, born: 0, band: 0, energy: 1 }]);
  assert.equal(rainGate(22), 0);
  assert.equal(rainGate(24), 1);
  const sliding = sampleRainDrop(drop, 25);
  assert.ok(Math.abs(sliding.x - drop.center) < Math.abs(drop.restX - drop.center));
  const emptied = sampleRainDrop(drop, 28.8);
  assert.ok(emptied.y - emptied.radius > viewport.height, 'the shape exits rather than disappearing in the pile');
  assert.equal(sampleRainDrop(drop, 29), undefined);
  assert.ok(rainGate(29.5) > 0 && rainGate(29.5) < 1);
  assert.equal(rainGate(30), 0);
  const [incoming] = planFor([{ id: 11, born: 17, band: 0, energy: 1 }]);
  assert.ok(incoming.landing > 25 && incoming.landing < 27, 'new rain arrives on time while the floor is open');
  const arriving = planFor(Array.from({ length: 100 }, (_, id) => ({ id, born: 15, band: 0, energy: 1 })));
  const overHole = arriving.find(drop => drop.passThrough);
  const overFloor = arriving.find(drop => !drop.passThrough);
  assert.ok(overHole && overFloor);
  assert.equal(sampleRainDrop(overHole, 25.2).grounded, false);
  assert.ok(sampleRainDrop(overHole, 25.2).y > overHole.restY, 'rain above the opening falls straight through');
  assert.equal(sampleRainDrop(overFloor, 25.2).grounded, true);
  assert.equal(overFloor.drainAt, 53, 'new arrivals on the remaining floor collect for the next cycle');
});

test('rain spans the whole viewport, including the space behind the video and text', () => {
  const events = Array.from({ length: 90 }, (_, id) => ({ id, born: id * .1, band: id % 3, energy: .6 }));
  for (const size of [viewport, { width: 390, height: 844 }]) {
    const plan = planFor(events, size);
    for (let quarter = 0; quarter < 4; quarter++) {
      assert.ok(plan.some(drop => drop.startX >= size.width * quarter / 4 && drop.startX < size.width * (quarter + 1) / 4));
    }
    assert.ok(plan.every(drop => Number.isFinite(drop.restY) && drop.radius > 0));
  }
});

test('silent preview uses a varied palette and shape positions; a loaded player at zero keeps the preview', () => {
  const shapes = [20, 25, 30, 35, 40].flatMap(time => render({ ...base, time }));
  assert.equal(new Set(shapes.map(shape => shape.color)).size, RIPPLE_PALETTE.length);
  assert.ok(new Set(shapes.map(shape => shape.position.join(','))).size > 20);
  assert.ok(shapes.every(shape => Number.isFinite(shape.radius) && shape.radius > 0));
  assert.ok(shapes.some(shape => shape.radius < 6) && shapes.some(shape => shape.radius > 15), 'the silent preview also shows the contrast between tiny and large shapes');
  assert.deepEqual(render({ ...base, timeline: { track: makeTrack(), seconds: 0 } }), render(base));
});

test('pause, rewind and song changes preserve the right rain history and completed cycles expire', () => {
  const track = makeTrack([[1, 0, .8], [2, 2, .7]]);
  const settings = { ...base, timeline: { track, seconds: 2.5 } };
  const first = render(settings);
  assert.ok(first.length > 0);
  assert.deepEqual(render({ ...settings, time: 100 }), first);
  render({ ...settings, timeline: { track, seconds: 8 } });
  assert.deepEqual(render(settings), first);
  assert.deepEqual(render({ ...settings, timeline: { track: makeTrack(), seconds: 2.5 } }), []);
  const events = buildRippleEvents(track);
  assert.deepEqual(activeRippleEvents(events, 60), []);
  const read = createRippleEventReader();
  assert.deepEqual(read(settings).events, read(settings).events);
  const dense = Array.from({ length: 1000 }, (_, id) => ({ id, born: id / 1000, band: 0, energy: 1 }));
  assert.equal(activeRippleEvents(dense, 1).length, 1000);
  const planReader = createRainPlanReader();
  const plan = planReader(events, viewport, settings);
  assert.equal(planReader(events, viewport, settings), plan, 'unchanged layouts reuse their rain plan');
});

test('deep bass only shakes collected shapes, while falling rain stays on its original path', () => {
  const settings = { ...base, time: 20.017 };
  const resting = render(settings);
  assert.deepEqual(render({ ...settings, audio: { ...quiet, bass: 1, mid: 1, high: 1, deepBass: .35 } }), resting);
  const shaking = render({ ...settings, audio: { ...quiet, deepBass: 1 } });
  assert.notDeepEqual(shaking, resting);
  const airborne = shapes => shapes.filter(shape => shape.layer === 'rain');
  assert.ok(airborne(resting).length > 0 && resting.some(shape => shape.layer === 'floor'));
  assert.deepEqual(airborne(shaking), airborne(resting), 'falling shapes never inherit the floor rumble');
  shaking.forEach((shape, index) => {
    assert.ok(Math.abs(shape.position[0] - resting[index].position[0]) <= 3.5);
    assert.ok(Math.abs(shape.position[1] - resting[index].position[1]) <= 4.9);
  });
  assert.deepEqual(shaking.map(shape => shape.radius), resting.map(shape => shape.radius));
  assert.deepEqual(render(settings), resting);
});

test('Rain keeps its gentler blur on the short floor canvas and hides it for other visualizers', () => {
  const transforms = [];
  const layer = {
    style: {}, removed: false, setAttribute() {}, remove() { this.removed = true; },
    getContext: () => ({ setTransform: (...values) => transforms.push(values), clearRect() {} }),
  };
  const canvas = { width: 2880, ownerDocument: { createElement: () => layer }, after(value) { this.sibling = value; } };
  const floor = createRippleFloor(canvas);
  floor.prepare(viewport, { ...base, mode: 'ripple', audio: { ...quiet, deepBass: 1 } });
  assert.equal(layer.style.filter, 'blur(3px)');
  assert.equal(layer.hidden, false);
  assert.equal(layer.height, 256, 'only the bottom 128 CSS pixels are rendered and blurred');
  assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, -1544]);
  floor.prepare(viewport, { ...base, mode: 'terrain' });
  assert.equal(layer.hidden, true);
  floor.prepare(viewport, { ...base, mode: 'ripple' });
  assert.equal(layer.style.filter, 'none');
  floor.destroy();
  assert.equal(layer.removed, true);
});

test('rare neon objects stay on musical hits, survive seeking, and rotate through all ten designs', () => {
  const frames = new Uint8Array(480 * 20 * 4);
  for (let second = 1; second < 480; second++) frames.set([240, 230, 0, 0], second * 20 * 4);
  const track = { videoId: 'cameo-song', duration: 480, fps: 20, frames };
  const events = buildRippleEvents(track);
  const cameos = events.filter(event => event.object);
  assert.ok(cameos.length >= 10 && cameos.length <= 15);
  assert.deepEqual(new Set(cameos.map(event => event.object)), new Set(['plane', 'satellite', 'ufo', 'astronaut', 'saturn', 'pizza', 'hotdog', 'hamburger', 'godzilla', 'banana']));
  cameos.slice(1).forEach((event, index) => assert.ok(event.born - cameos[index].born >= 32));
  for (const event of cameos) {
    const [drop, ...extra] = planFor([event]);
    assert.equal(extra.length, 0, 'a cameo produces one recognizable object');
    assert.ok(drop.radius >= 30 && Math.abs(drop.spin) < .2);
    assert.equal(sampleRainDrop(drop, event.born + 1).object, event.object);
  }
  assert.deepEqual(activeRippleEvents(events, 120), activeRippleEvents(buildRippleEvents(track), 120));
  assert.equal(visualModes.find(mode => mode.id === 'ripple').label, 'Rain');
});

test('neon outlines reuse their paths and paint a colored halo and bright core', () => {
  const strokes = [];
  const context = { globalAlpha: .88, stroke(path) { strokes.push({ path, width: this.lineWidth, color: this.strokeStyle }); } };
  for (const object of ['plane', 'satellite', 'ufo', 'astronaut', 'saturn', 'pizza', 'hotdog', 'hamburger', 'godzilla', 'banana']) {
    paintNeonObject(context, object);
    const first = strokes.at(-1).path;
    paintNeonObject(context, object);
    assert.equal(strokes.at(-1).path, first);
    assert.ok(first.data.length > 100);
  }
  assert.equal(new Set(strokes.map(stroke => stroke.path)).size, 10);
  assert.ok(strokes.some(stroke => stroke.width > .1) && strokes.some(stroke => stroke.width < .02));
});
