import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { requestedSynthTrack, synthTrackUrl, syncSynthTrackUrl, synthTrackPageTitle } = await server.ssrLoadModule('/src/scripts/synth-track-links.ts');
const tracks = JSON.parse(await readFile(new URL('../src/data/synth-tracks.json', import.meta.url), 'utf8'));
const origin = 'https://andrewlandry.com';

test('every published slug is unique and resolves to the same video with or without a trailing slash', () => {
  assert.equal(new Set(tracks.map(track => track.slug)).size, tracks.length);
  assert.equal(new Set(tracks.map(track => track.videoId)).size, tracks.length);
  for (const track of tracks) {
    assert.match(track.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const link = `${origin}/synth-and-chill/${track.slug}/`;
    assert.equal(synthTrackUrl(track.videoId, origin).href, link);
    assert.equal(requestedSynthTrack(link), track.videoId);
    assert.equal(requestedSynthTrack(link.slice(0, -1)), track.videoId);
  }
  assert.equal(requestedSynthTrack(`${origin}/synth-and-chill/`), undefined);
  assert.equal(requestedSynthTrack(`${origin}/synth-and-chill/does-not-exist/`), undefined);
});

test('changing tracks replaces the previous selection while preserving unrelated query parameters and fragments', () => {
  const link = synthTrackUrl('D8bjcI4pkiE', `${origin}/synth-and-chill/wave/?track=Y_FqCI1uqUI&utm_source=friend#main`);
  assert.equal(link.href, `${origin}/synth-and-chill/hes-a-bad-guy/?utm_source=friend#main`);
  assert.equal(requestedSynthTrack(`${link.href.split('#')[0]}&track=Y_FqCI1uqUI`), 'D8bjcI4pkiE', 'the named path takes precedence');
  assert.equal(synthTrackUrl('NdHyJ1-wiys', 'https://www.andrewlandry.com/synth-and-chill/').host, 'www.andrewlandry.com');
});

test('new playlist videos get a working query link until a stable slug is published', () => {
  const link = synthTrackUrl('new-video01', `${origin}/synth-and-chill/wave/`);
  assert.equal(link.href, `${origin}/synth-and-chill/?track=new-video01`);
  assert.equal(requestedSynthTrack(link.href), 'new-video01');
  assert.equal(synthTrackUrl('invalid/id', origin), undefined);
  assert.equal(requestedSynthTrack(`${origin}/synth-and-chill/?track=invalid%2Fid`), undefined);
});

test('URL updates replace history only when the track changes and preserve existing history state', () => {
  const original = globalThis.window;
  const calls = [];
  const state = { existing: 'page-state' };
  const location = { href: `${origin}/synth-and-chill/` };
  globalThis.window = { location, history: { state, replaceState(...args) { calls.push(args); location.href = args[2].href; } } };
  try {
    syncSynthTrackUrl('D8bjcI4pkiE');
    syncSynthTrackUrl('D8bjcI4pkiE');
    syncSynthTrackUrl('Y_FqCI1uqUI');
    assert.equal(calls.length, 2, 'polling the same track does not keep rewriting history');
    assert.equal(calls[0][0], state);
    assert.equal(location.href, `${origin}/synth-and-chill/wave/`);
  } finally {
    globalThis.window = original;
  }
});

test('track page titles distinguish shared links and retain the site identity', () => {
  assert.equal(synthTrackPageTitle('WAVE'), 'WAVE — Synth & Chill — Andrew Landry');
  assert.equal(synthTrackPageTitle(), 'Synth & Chill — Andrew Landry');
});
