import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { decodeAudioTrack, quietFeatures, sampleAudioTrack } = await server.ssrLoadModule('/src/scripts/synth-audio-data.ts');
const { createPlaybackClock, createAudioFollower } = await server.ssrLoadModule('/src/scripts/synth-audio.ts');
const { readSynthPlayback, youtubeVideoId } = await server.ssrLoadModule('/src/scripts/synth-youtube.ts');
const { createTerrainSoftness } = await server.ssrLoadModule('/src/scripts/synth-terrain-softness.ts');
const dataFile = name => new URL(`../public/data/synth-audio/${name}`, import.meta.url);
const track = { videoId: 'D8bjcI4pkiE', fps: 20, duration: .1, frames: new Uint8Array([0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255, 255]) };

test('audio frames interpolate at the playback time and never repeat beyond the song', () => {
  assert.deepEqual(sampleAudioTrack(track, .025), { level: .5, bass: .5, mid: 0, high: 0, deepBass: 0 });
  assert.deepEqual(sampleAudioTrack(track, .1), { level: 0, bass: 0, mid: 1, high: 1, deepBass: 0 });
  for (const time of [-1, .11, NaN, Infinity]) assert.deepEqual(sampleAudioTrack(track, time), quietFeatures());
});

test('deep bass follows playback, releases on pause, and does not leak across tracks', () => {
  const deepTrack = { ...track, deepBass: new Uint8Array([0, 255, 0]) };
  assert.equal(sampleAudioTrack(deepTrack, .025).deepBass, .5);
  let snapshot = { videoId: track.videoId, seconds: .05, playing: true, rate: 1 };
  const follow = createAudioFollower(() => snapshot, { request() {}, get: id => id === track.videoId ? deepTrack : undefined });
  assert.ok(follow(100).audio.deepBass > .9);
  snapshot = { ...snapshot, playing: false };
  for (let now = 200; now <= 1200; now += 100) follow(now);
  assert.ok(follow(1300).audio.deepBass < .001);
  snapshot = { ...snapshot, videoId: 'missing', playing: true };
  assert.equal(follow(1400).audio.deepBass, 0);
});

test('deep bass adds up to 8px of masked foreground blur while the original terrain stays sharp', () => {
  const properties = new Map();
  const layer = { style: { setProperty: (name, value) => properties.set(name, value) }, hidden: true };
  const canvas = { style: {} };
  const update = createTerrainSoftness(layer, canvas);
  const settings = { mode: 'terrain', time: 0, depth: .35, dark: true };
  const apply = deepBass => {
    update({ ...settings, audio: { level: 1, bass: 1, mid: 1, high: 1, deepBass } });
    assert.equal(canvas.style.filter, 'none', 'no full-screen blur reaches the distant terrain');
    return parseFloat(properties.get('--terrain-blur'));
  };
  for (const level of [undefined, 0, .2, .35]) assert.equal(apply(level), 0);
  assert.equal(layer.hidden, true);
  assert.equal(canvas.style.filter, 'none');
  assert.ok(apply(.5) > 0);
  assert.ok(apply(.5) < 2);
  assert.ok(Math.abs(apply(1) - 8) < 1e-10);
  assert.equal(layer.hidden, false);
  assert.equal(apply(0), 0);
  assert.equal(layer.hidden, true);
  apply(1);
  update({ ...settings, mode: 'ripple', audio: { ...quietFeatures(), deepBass: 1 } });
  assert.equal(layer.hidden, true);
  assert.equal(canvas.style.filter, 'none');
});

test('playback follows seeks, pause and speed changes without accumulating drift', () => {
  const clock = createPlaybackClock();
  let snapshot = { videoId: 'D8bjcI4pkiE', seconds: 10, playing: true, rate: 1 };
  assert.equal(clock(snapshot, 0), 10);
  assert.equal(clock(snapshot, 100), 10.1);
  assert.equal(clock(snapshot, 2000), 10.25, 'stale timestamps have bounded extrapolation');
  snapshot = { ...snapshot, seconds: 2, playing: false };
  assert.equal(clock(snapshot, 2100), 2);
  assert.equal(clock(snapshot, 3100), 2);
  snapshot = { ...snapshot, seconds: 90, playing: true, rate: 2 };
  assert.equal(clock(snapshot, 3200), 90);
  assert.equal(clock(snapshot, 3300), 90.2);
  assert.equal(clock({ ...snapshot, videoId: 'JymTYy5km_I' }, 3400), 90);
});

test('switching to a song without analysis immediately drops the old song’s response', () => {
  let snapshot = { videoId: track.videoId, seconds: .05, playing: true, rate: 1 };
  const store = { request() {}, get: id => id === track.videoId ? track : undefined };
  const follow = createAudioFollower(() => snapshot, store);
  assert.ok(follow(100).audio.bass > .9);
  snapshot = { ...snapshot, videoId: 'unavailable' };
  assert.deepEqual(follow(200), { audio: quietFeatures(), timeline: undefined });
});

test('terrain history follows the same clock and survives pause without leaking across tracks', () => {
  let snapshot = { videoId: track.videoId, seconds: .05, playing: true, rate: 1 };
  const store = { request() {}, get: id => id === track.videoId ? track : undefined };
  const follow = createAudioFollower(() => snapshot, store);
  assert.deepEqual(follow(100).timeline, { track, seconds: .05 });
  snapshot = { ...snapshot, seconds: .02, playing: false };
  assert.equal(follow(200).timeline.seconds, .02);
  assert.equal(follow(5000).timeline.seconds, .02);
  snapshot = { ...snapshot, videoId: 'unavailable' };
  assert.equal(follow(5100).timeline, undefined);
  snapshot = undefined;
  assert.equal(follow(5200).timeline, undefined);
});

test('the player adapter reads the actual video and transport state', () => {
  const player = { getVideoUrl: () => 'https://www.youtube.com/watch?v=D8bjcI4pkiE&list=example',
    getCurrentTime: () => 12.75, getPlayerState: () => 3, getPlaybackRate: () => 1.5 };
  assert.deepEqual(readSynthPlayback(player), { videoId: track.videoId, seconds: 12.75, playing: false, rate: 1.5 });
  assert.equal(readSynthPlayback(undefined), undefined);
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=D8bjcI4pkiE&t=123'), track.videoId);
  assert.equal(youtubeVideoId(''), undefined);
});

test('every playlist entry has complete, correctly identified audio measurements', async () => {
  const manifest = JSON.parse(await readFile(dataFile('manifest.json'), 'utf8'));
  assert.equal(manifest.tracks.length, 17);
  assert.equal(new Set(manifest.tracks.map(item => item.videoId)).size, 17);
  for (const item of manifest.tracks) {
    const encoded = JSON.parse(await readFile(dataFile(`${item.videoId}.json`), 'utf8'));
    const decoded = decodeAudioTrack(encoded, item.videoId);
    assert.equal(decoded.duration, item.duration);
    assert.deepEqual(encoded.deepBassHz, [30, 90]);
    assert.equal(decoded.deepBass.length, decoded.frames.length / 4);
    assert.ok(decoded.frames.some(value => value > 100), `${item.title} contains a musical signal`);
    assert.throws(() => decodeAudioTrack({ ...encoded, videoId: 'wrong' }, item.videoId));
    assert.throws(() => decodeAudioTrack({ ...encoded, data: '' }, item.videoId));
    assert.throws(() => decodeAudioTrack({ ...encoded, deepBass: '' }, item.videoId));
  }
});
