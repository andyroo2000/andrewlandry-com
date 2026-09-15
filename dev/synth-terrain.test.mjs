import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { buildTerrainField, sampleTerrainHeight, createTerrainFieldCache, createTerrainFrame, terrainRowTime, TERRAIN_COLUMNS, TERRAIN_HISTORY_SECONDS, TERRAIN_ROWS_PER_SECOND, MOUND_RADIUS_COLUMNS, MOUND_RADIUS_SECONDS, MOUND_ATTACK_SECONDS } = await server.ssrLoadModule('/src/scripts/synth-terrain-field.ts');
const { drawVisualizer } = await server.ssrLoadModule('/src/scripts/synth-renderers.ts');
const { createTerrainCamera, projectTerrainPoint, TERRAIN_FAR_DISTANCE, TERRAIN_FOREGROUND_DISTANCE } = await server.ssrLoadModule('/src/scripts/synth-terrain-camera.ts');

function isolatedHit(channel, volume = 1, frame = 80) {
  const frames = new Uint8Array(241 * 4);
  frames[frame * 4] = Math.round(volume * 255);
  frames[frame * 4 + channel] = Math.round(volume * 255);
  return { videoId: `hit-${channel}`, duration: 12, fps: 20, frames };
}

function slice(field, seconds) {
  return Array.from({ length: TERRAIN_COLUMNS }, (_, column) => sampleTerrainHeight(field, column, seconds));
}

test('isolated hits rise ahead of the sound, crest on the beat, and leave a rounded decay', () => {
  const bass = buildTerrainField(isolatedHit(1));
  const treble = buildTerrainField(isolatedHit(3));
  const peakTime = 4;
  const crest = Math.max(...slice(bass, peakTime));
  assert.ok(crest > 1);
  assert.ok(Math.max(...slice(treble, peakTime)) > 1.5);
  assert.deepEqual(slice(bass, peakTime - .5), Array(TERRAIN_COLUMNS).fill(0));
  assert.ok(Math.max(...slice(bass, peakTime - .1)) > crest * .8);
  assert.deepEqual(slice(bass, 4 - MOUND_ATTACK_SECONDS), Array(TERRAIN_COLUMNS).fill(0));
  assert.ok(Math.max(...slice(bass, 4.1)) < crest, 'the crest has passed by the time the sound is ringing out');
  assert.ok(Math.max(...slice(bass, peakTime + 1)) > .3);
  assert.deepEqual(slice(bass, peakTime + 3.5), Array(TERRAIN_COLUMNS).fill(0));
});

test('the fast attack retains rounded sides, a smooth summit and a broad trailing slope', () => {
  const field = buildTerrainField(isolatedHit(1));
  const peakTime = 4;
  const summit = slice(field, peakTime);
  const center = summit.indexOf(Math.max(...summit));
  const halfWidth = MOUND_RADIUS_COLUMNS / 2;
  const across = sampleTerrainHeight(field, center + halfWidth, peakTime);
  const along = sampleTerrainHeight(field, center, peakTime + MOUND_RADIUS_SECONDS / 2);
  assert.ok(Math.abs(across - along) < .002);
  assert.equal(across, sampleTerrainHeight(field, center - halfWidth, peakTime));
  assert.ok(sampleTerrainHeight(field, center, peakTime) - sampleTerrainHeight(field, center, peakTime - .05) < summit[center] * .04);
});

function moundDimensions(channel, volume) {
  const field = buildTerrainField(isolatedHit(channel, volume));
  const values = slice(field, 4).map(Math.abs);
  const height = Math.max(...values);
  return { height, width: values.filter(value => value > height / 2).length };
}

test('louder notes create taller and wider landforms without flattening every strong hit to one size', () => {
  for (const channel of [1, 2, 3]) {
    const soft = moundDimensions(channel, .25);
    const medium = moundDimensions(channel, .5);
    const loud = moundDimensions(channel, 1);
    assert.ok(soft.height > .05, 'quiet notes still leave a visible mark');
    assert.ok(loud.height > soft.height * 7, 'loudness produces a substantial range of heights');
    assert.ok(medium.height > soft.height && medium.height < loud.height);
    assert.ok(loud.width > soft.width, 'strong notes also pull up a wider area');
  }
});

test('bass creates broad hills, treble creates taller narrow peaks, and midrange retains rounded valleys', () => {
  const bass = moundDimensions(1, 1);
  const treble = moundDimensions(3, 1);
  assert.ok(treble.height > bass.height * 1.4);
  assert.ok(bass.width >= treble.width * 2);
  const valley = slice(buildTerrainField(isolatedHit(2)), 4);
  assert.ok(Math.min(...valley) < -.8);
  assert.equal(Math.max(...valley), 0);
});

test('wide and overlapping landforms remain finite and join seamlessly at the field borders', () => {
  const track = isolatedHit(1, 1, 56);
  track.frames.fill(255, 56 * 4, 57 * 4);
  const field = buildTerrainField(track);
  assert.ok(field.heights.every(value => Number.isFinite(value) && Math.abs(value) < 3));
  assert.ok(sampleTerrainHeight(field, 0, 2.8) > 1, 'a hill crosses the seam instead of leaving a flat lane');
  for (let frame = 0; frame < field.heights.length / TERRAIN_COLUMNS; frame++) {
    assert.equal(field.heights[frame * TERRAIN_COLUMNS], field.heights[(frame + 1) * TERRAIN_COLUMNS - 1]);
  }
});

test('all frequency bands place peaks across the whole field with rounded shoulders through the seam', () => {
  const period = TERRAIN_COLUMNS - 1;
  for (const channel of [1, 2, 3]) {
    const centers = [];
    for (let frame = 40; frame <= 200; frame++) {
      const field = buildTerrainField(isolatedHit(channel, 1, frame));
      const summit = slice(field, frame / field.fps).map(Math.abs);
      const center = summit.indexOf(Math.max(...summit));
      centers.push(center);
      for (let offset = 1; offset <= 4; offset++) {
        assert.equal(summit[(center + offset) % period], summit[(center - offset + period) % period], 'wrapping preserves both sides of the mound');
      }
    }
    assert.equal(Math.min(...centers), 0, 'the left edge can host a peak');
    assert.equal(Math.max(...centers), period - 1, 'the right edge can host a peak');
    for (let lane = 0; lane < 8; lane++) {
      assert.ok(centers.some(center => Math.floor(center / (period / 8)) === lane), 'no lane is excluded from peak placement');
    }
  }
});

test('a recorded ridge retains its shape as it travels and after rewinding', () => {
  const track = isolatedHit(1);
  const field = buildTerrainField(track);
  const nearHorizon = terrainRowTime(4.5, 2);
  const foreground = terrainRowTime(29.5, 102);
  assert.equal(nearHorizon, 4);
  assert.equal(foreground, 4);
  assert.ok(Math.max(...slice(field, nearHorizon)) > 1);
  assert.deepEqual(slice(field, nearHorizon), slice(field, foreground));
  assert.deepEqual(buildTerrainField(track).heights, field.heights);
});

test('silence, missing analysis and time outside the recording stay flat', () => {
  const silent = { ...isolatedHit(1), frames: new Uint8Array(241 * 4) };
  const field = buildTerrainField(silent);
  assert.ok(field.heights.every(height => height === 0));
  for (const seconds of [-1, 13, NaN, Infinity]) assert.equal(sampleTerrainHeight(field, 10, seconds), 0);
  const cache = createTerrainFieldCache();
  const first = cache(isolatedHit(1));
  assert.notEqual(cache(silent), first);
  assert.equal(cache(undefined), undefined);
});

function renderedPaths(settings) {
  const paths = [];
  const colors = [];
  const masks = [];
  const contours = [];
  let path = [];
  let moves = 0;
  let width = 0;
  const context = {
    beginPath() { path = []; moves = 0; },
    moveTo(x, y) { path.push([x, y]); moves++; },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    fill() { masks.push(path); },
    fillRect() {},
    stroke() { paths.push(path); colors.push(this.strokeStyle); width = Math.max(width, this.lineWidth); if (moves === 1 && path.length > 2) contours.push(path); },
    clearRect() {},
    save() {},
    restore() {},
  };
  drawVisualizer(context, { width: 1440, height: 900 }, { ...settings, mode: 'terrain' });
  return { paths, width, colors, masks, contours };
}

test('music gently brightens the lines while their geometry and width stay stable', () => {
  const settings = { time: 0, depth: .55, dark: true, audio: { level: 0, bass: 0, mid: 0, high: 0 }, timeline: { track: isolatedHit(1), seconds: 6 } };
  const quiet = renderedPaths(settings);
  const loud = renderedPaths({ ...settings, time: 123, audio: { level: 1, bass: 1, mid: 1, high: 1 } });
  const horizon = quiet.paths.at(-1);
  const farthestRow = quiet.contours.at(-1);
  assert.equal(horizon[0][1], horizon[1][1]);
  assert.ok(farthestRow[0][0] <= 0, 'terrain reaches the left edge at the horizon');
  assert.ok(farthestRow.at(-1)[0] >= 1440, 'terrain reaches the right edge at the horizon');
  assert.deepEqual(loud.paths, quiet.paths);
  assert.equal(loud.width, quiet.width);
  const soft = renderedPaths({ ...settings, audio: { ...settings.audio, level: .1 } });
  assert.equal(soft.width, quiet.width);
  const alpha = color => Number(color.slice(color.lastIndexOf(',') + 1, -1));
  quiet.colors.forEach((color, index) => {
    assert.ok(alpha(loud.colors[index]) > alpha(color));
    assert.ok(alpha(loud.colors[index]) / alpha(color) < 1.3);
  });
  assert.ok(loud.paths.flat(2).every(Number.isFinite));
});

test('new peaks appear at the far edge and its live waveform is not quantized to grid rows', () => {
  const settings = { time: 0, depth: .55, dark: true, audio: { level: .7, bass: .7, mid: 0, high: 0 }, timeline: { track: isolatedHit(1), seconds: 4 } };
  const current = renderedPaths(settings);
  const liveEdge = current.contours.at(-1);
  const baseline = renderedPaths({ ...settings, timeline: undefined }).contours.at(-1)[0][1];
  assert.ok(baseline - Math.min(...liveEdge.map(point => point[1])) > 17, 'a fresh peak rises visibly above the distant ground at the gentler height');
  const advanced = renderedPaths({ ...settings, timeline: { ...settings.timeline, seconds: 4.1 } });
  const nextEdge = advanced.contours.at(-1);
  assert.notDeepEqual(nextEdge, liveEdge, 'the horizon updates within the same quarter-second grid interval');
});

test('the rendered crest reaches its overshoot on the sound and settles afterward', () => {
  const track = isolatedHit(1, 1, 90); // Sound and overshoot crest both at 4.5 s.
  const camera = createTerrainCamera({ width: 1440, height: 900 });
  const crestHeight = age => {
    const settings = { time: 0, depth: .2, dark: true, audio: { level: 0, bass: 0, mid: 0, high: 0 }, timeline: { track, seconds: 4.5 + age } };
    // Before the next half-second contour, this is always the same recorded
    // row at 4.5 s. Remove perspective magnification to measure its own lift.
    const crest = renderedPaths(settings).contours.at(-2);
    const z = TERRAIN_FAR_DISTANCE - age * (TERRAIN_FAR_DISTANCE - TERRAIN_FOREGROUND_DISTANCE) / TERRAIN_HISTORY_SECONDS;
    const ground = projectTerrainPoint(camera, { x: 0, y: 0, z });
    return (ground.y - Math.min(...crest.map(point => point[1]))) * z / camera.focalLength;
  };
  const born = crestHeight(0);
  const settling = crestHeight(.15);
  const settled = crestHeight(.3);
  assert.ok(born / settled > 1.04 && born / settled < 1.07);
  assert.ok(settling < born && settling > settled);
  assert.ok(Math.abs(crestHeight(.45) - settled) < 1e-10, 'the permanent geometry stays fixed after settling');
  assert.equal(crestHeight(0), born, 'rewinding reproduces the entrance');
});

test('each frequency band anticipates the sound, overshoots on the beat, and preserves settled ground', () => {
  for (const channel of [1, 2, 3]) {
    const field = buildTerrainField(isolatedHit(channel));
    const recordedAt = 4;
    const permanent = slice(field, recordedAt);
    const column = permanent.map(Math.abs).indexOf(Math.max(...permanent.map(Math.abs)));
    const heightAt = seconds => Math.abs(createTerrainFrame(field, seconds)(column, recordedAt));
    const resting = Math.abs(permanent[column]);
    assert.ok(heightAt(recordedAt) > resting * 1.03);
    assert.ok(heightAt(recordedAt + .15) < heightAt(recordedAt));
    for (const seconds of [3.5, 3.55]) {
      const frame = createTerrainFrame(field, seconds);
      for (let column = 0; column < TERRAIN_COLUMNS; column++) {
        assert.equal(Math.abs(frame(column, seconds)), 0, 'the rise does not begin more than 450 ms before the sound');
      }
    }
    const approaching = Math.abs(createTerrainFrame(field, 3.9)(column, 3.9));
    assert.ok(approaching > 0 && approaching < heightAt(4), 'the visible rise leads into the overshoot on the beat');
    assert.ok(heightAt(4.25) > resting, 'the bounce is still settling after the sound');
    for (const seconds of [4.3, 4.31, 5, 10]) assert.equal(heightAt(seconds), resting);
    assert.deepEqual(slice(field, recordedAt), permanent, 'the overshoot is never baked into the landscape');
  }
});

test('the camera projects world positions and mountain heights with one inverse-distance scale', () => {
  const camera = createTerrainCamera({ width: 1440, height: 900 });
  const near = projectTerrainPoint(camera, { x: 1, y: 0, z: 4 });
  const far = projectTerrainPoint(camera, { x: 1, y: 0, z: 8 });
  assert.ok(Math.abs((near.x - camera.centerX) / (far.x - camera.centerX) - 2) < 1e-10);
  assert.ok(Math.abs((near.y - camera.horizonY) / (far.y - camera.horizonY) - 2) < 1e-10);
  const raised = projectTerrainPoint(camera, { x: 1, y: .5, z: 4 });
  const distantRaised = projectTerrainPoint(camera, { x: 1, y: .5, z: 8 });
  assert.ok(Math.abs((near.y - raised.y) / (far.y - distantRaised.y) - 2) < 1e-10);
  assert.ok(Math.abs((near.x - camera.centerX) / (near.y - camera.horizonY) - (far.x - camera.centerX) / (far.y - camera.horizonY)) < 1e-10);
});

test('the elevated viewpoint reveals a smaller peak behind a taller ridge and keeps the live edge near the top', () => {
  const camera = createTerrainCamera({ width: 1440, height: 900 });
  const nearerRidge = projectTerrainPoint(camera, { x: 0, y: .65, z: 10 });
  const distantPeak = projectTerrainPoint(camera, { x: 0, y: .3, z: 16 });
  assert.ok(distantPeak.y + 15 < nearerRidge.y, 'the smaller distant peak clears the nearer silhouette');
  const liveEdge = projectTerrainPoint(camera, { x: 0, y: 0, z: 21 });
  assert.ok(liveEdge.y < 900 * .18, 'new land still appears in the visible strip above the video');
});

test('equal world intervals open up toward the viewer and resizing preserves proportions', () => {
  const camera = createTerrainCamera({ width: 1440, height: 900 });
  const doubled = createTerrainCamera({ width: 2880, height: 1800 });
  const ground = z => projectTerrainPoint(camera, { x: 0, y: 0, z }).y;
  assert.ok(ground(2) - ground(3) > (ground(10) - ground(11)) * 10);
  const point = { x: 2, y: .4, z: 8 };
  const first = projectTerrainPoint(camera, point);
  const second = projectTerrainPoint(doubled, point);
  assert.equal(second.x, first.x * 2);
  assert.equal(second.y, first.y * 2);
});

test('terrain rumble stays out of the upper quarter and grows toward the bottom at every viewport size', () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const resting = createTerrainCamera(size);
    const shaking = createTerrainCamera(size, { x: 5, y: -7 });
    assert.equal(shaking.horizonY, resting.horizonY);
    let previous = 0;
    for (const position of [.1, .2, .25, .5, .75, 1, 1.2]) {
      const z = resting.focalLength * resting.height / (position * size.height - resting.horizonY);
      const point = { x: 2, y: 0, z };
      const before = projectTerrainPoint(resting, point);
      const after = projectTerrainPoint(shaking, point);
      const movement = after.x - before.x;
      if (position <= .25) assert.deepEqual(after, before, 'new peaks near the horizon stay still');
      if (position === .5) assert.ok(movement < 1, 'the middle remains much quieter than the foreground');
      if (position >= 1) assert.ok(Math.abs(movement - 5) < 1e-10, 'the bottom gets the full rumble');
      assert.ok(movement >= previous && movement <= 5 + 1e-10);
      assert.ok(Math.abs((after.y - before.y) + movement * 7 / 5) < 1e-10);
      previous = movement;
    }
  }
});

test('only deep bass shakes the solid ground and it settles without altering the recorded landscape', () => {
  const settings = { time: .017, depth: .35, dark: true, audio: { level: 1, bass: 1, mid: 1, high: 1 }, timeline: { track: isolatedHit(1), seconds: 30 } };
  const resting = renderedPaths(settings);
  const renderBass = deepBass => renderedPaths({ ...settings, audio: { ...settings.audio, deepBass } });
  assert.deepEqual(renderBass(.35).paths, resting.paths);
  const shaking = renderBass(1);
  assert.notDeepEqual(shaking.contours, resting.contours);
  assert.deepEqual(shaking.paths.at(-1), resting.paths.at(-1), 'the true horizon stays still');
  assert.equal(shaking.width, resting.width);
  assert.equal(shaking.masks.length, resting.masks.length, 'shake adds no extra rendering passes');
  measureMasks(shaking.masks);
  assert.deepEqual(renderBass(0).paths, resting.paths, 'no residual displacement after the bass releases');
});

test('the ground takes thirty-six seconds to travel from the horizon to the foreground', () => {
  const rows = TERRAIN_HISTORY_SECONDS * TERRAIN_ROWS_PER_SECOND;
  assert.equal(terrainRowTime(4, 0), terrainRowTime(40, rows));
  assert.equal(TERRAIN_HISTORY_SECONDS, 36);
});

function contourHeight(row, x) {
  const index = row.findIndex(point => point[0] >= x);
  const [left, right] = [row[index - 1], row[index]];
  const fraction = (x - left[0]) / (right[0] - left[0]);
  return left[1] + (right[1] - left[1]) * fraction;
}

function measureMasks(masks) {
  let painted = 0;
  let fullHeight = 0;
  for (let x = 0; x <= 1440; x += 40) {
    let covered = 900;
    for (const mask of masks) {
      const surface = contourHeight(mask.slice(1, -1), x);
      const bottom = mask[0][1];
      if (surface >= 900) continue;
      assert.ok(bottom >= covered, 'successive masks meet without exposing hidden ground');
      covered = Math.min(covered, surface);
      painted += Math.max(0, Math.min(900, bottom) - Math.max(0, surface));
      fullHeight += 900 - Math.max(0, surface);
    }
  }
  return { painted, fullHeight };
}

test('smaller ground masks preserve opaque coverage across peaks and valleys with far less overdraw', () => {
  for (const channel of [1, 2, 3]) for (const depth of [.35, 1]) for (const seconds of [4.1, 15, 30]) {
    const settings = { time: 0, depth, dark: true, audio: { level: .7, bass: .7, mid: 0, high: 0 }, timeline: { track: isolatedHit(channel), seconds } };
    const { painted, fullHeight } = measureMasks(renderedPaths(settings).masks);
    assert.ok(painted < fullHeight / 2, 'painting hidden lower areas is eliminated');
  }
});

const { terrainBirthScale, terrainDepth, terrainForegroundWeight, terrainResponse } = await server.ssrLoadModule('/src/scripts/synth-terrain-style.ts');
const quiet = { level: 0, bass: 0, mid: 0, high: 0 };
const audioAt = level => ({ level, bass: level, mid: level, high: level });

function phrase(low, high) {
  const frames = new Uint8Array(81 * 4);
  for (let frame = 0; frame < 81; frame++) frames.fill(Math.round((frame % 10 < 5 ? low : high) * 255), frame * 4, frame * 4 + 4);
  return { track: { videoId: 'phrase', duration: 4, fps: 20, frames }, seconds: 2 };
}

test('the entrance settles smoothly within 300 ms with no undershoot or repeated bounce', () => {
  assert.equal(terrainBirthScale(0), 1.06);
  let previous = terrainBirthScale(0);
  for (let step = 1; step <= 60; step++) {
    const scale = terrainBirthScale(step / 200);
    assert.ok(scale >= 1 && scale <= previous);
    previous = scale;
  }
  for (const age of [.3, .5, 1, 36]) assert.equal(terrainBirthScale(age), 1);
});

test('blur and rumble share a gradual foreground falloff with a calm upper quarter', () => {
  for (const position of [-1, 0, .16, .25]) assert.equal(terrainForegroundWeight(position), 0);
  assert.ok(terrainForegroundWeight(.5) < .15);
  assert.ok(terrainForegroundWeight(.75) > .4 && terrainForegroundWeight(.75) < .5);
  assert.equal(terrainForegroundWeight(1), 1);
  assert.equal(terrainForegroundWeight(2), 1);
  for (let step = 26; step <= 100; step++) assert.ok(terrainForegroundWeight(step / 100) > terrainForegroundWeight((step - 1) / 100));
});

test('depth reserves most of the slider for gentle terrain while retaining both endpoints', () => {
  assert.equal(terrainDepth(0), 0);
  assert.equal(terrainDepth(1), 1);
  assert.ok(terrainDepth(.35) < .05);
  assert.equal(terrainDepth(.5), .125);
  assert.ok(terrainDepth(.36) - terrainDepth(.35) < .005);
  for (let step = 1; step <= 100; step++) assert.ok(terrainDepth(step / 100) > terrainDepth((step - 1) / 100));
});

test('both quiet and loud phrases visibly swell, instead of staying at maximum response', () => {
  for (const [low, high] of [[.08, .24], [.72, .96]]) {
    const timeline = phrase(low, high);
    const resting = terrainResponse(audioAt(low), timeline);
    const peak = terrainResponse(audioAt(high), timeline);
    assert.ok(peak - resting > .7);
    assert.ok(peak > .8 && peak <= 1);
    assert.equal(terrainResponse(quiet, timeline), 0);
  }
});

test('steady tones and tiny fluctuations stay restrained, with no stale response after a seek or track change', () => {
  const steady = phrase(.6, .61);
  assert.ok(terrainResponse(audioAt(.61), steady) < .25);
  const soft = phrase(.08, .24);
  const loud = phrase(.72, .96);
  const response = terrainResponse(audioAt(.24), soft);
  terrainResponse(audioAt(.96), loud);
  assert.equal(terrainResponse(audioAt(.24), soft), response);
  assert.equal(terrainResponse(quiet), 0);
  assert.equal(terrainResponse(audioAt(1)), 1);
});
