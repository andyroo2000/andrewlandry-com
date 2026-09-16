import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { createMuxPlaylist } = await server.ssrLoadModule('/src/scripts/synth-mux.ts');
const { readSynthPlayback } = await server.ssrLoadModule('/src/scripts/synth-youtube.ts');

class Media extends EventTarget {
  paused = true;
  muted = false;
  volume = 1;
  currentTime = 0;
  playbackRate = 1;
  plays = 0;
  setAttribute() {}
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  async play() { this.plays++; this.paused = false; this.dispatchEvent(new Event('playing')); }
}

function setup(index = 0) {
  const media = new Media();
  const abort = new AbortController();
  const errors = [];
  const events = { onReady() {}, onStateChange() {}, onError() { errors.push('error'); }, onAutoplayBlocked() { errors.push('blocked'); } };
  const player = createMuxPlaylist(media, events, abort.signal, index);
  return { media, abort, errors, player };
}

test('shared tracks start paused and expose the real media clock to visualizers', () => {
  const { media, player } = setup(3);
  assert.equal(media.plays, 0);
  assert.equal(player.getPlaylistIndex(), 3);
  media.currentTime = 52.4;
  media.playbackRate = 1.5;
  player.playVideo();
  assert.deepEqual(readSynthPlayback(player), { videoId: 'Y_FqCI1uqUI', seconds: 52.4, playing: true, rate: 1.5 });
  player.pauseVideo();
  assert.equal(readSynthPlayback(player).playing, false);
});

test('track changes preserve sound and advance on completion without looping the final track', () => {
  const { media, player } = setup();
  player.setVolume(37);
  media.muted = true;
  player.nextVideo();
  assert.equal(media.plays, 0, 'wait for the new source before requesting playback');
  media.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(media.plays, 1);
  assert.equal(player.getPlaylistIndex(), 1);
  assert.equal(player.getVolume(), 37);
  assert.equal(player.isMuted(), true);
  media.dispatchEvent(new Event('ended'));
  assert.equal(player.getPlaylistIndex(), 2);
  for (let i = 0; i < 20; i++) player.nextVideo();
  assert.equal(player.getPlaylistIndex(), 8);
  media.dispatchEvent(new Event('ended'));
  assert.equal(player.getPlayerState(), 0);
  assert.equal(player.getPlaylistIndex(), 8);
});

test('old play rejections cannot overwrite the state of a newly selected track', async () => {
  const { media, player, errors } = setup();
  let reject;
  media.play = () => new Promise((_, fail) => { reject = fail; });
  player.playVideo();
  const rejectOld = reject;
  player.nextVideo();
  media.dispatchEvent(new Event('loadedmetadata'));
  rejectOld(new DOMException('Old source', 'NotAllowedError'));
  await Promise.resolve();
  assert.deepEqual(errors, []);
  reject(new DOMException('Gesture required', 'NotAllowedError'));
  await Promise.resolve();
  assert.deepEqual(errors, ['blocked']);
  assert.equal(player.getPlayerState(), 2);
});

test('pausing while a new track loads cancels its pending playback', () => {
  const { media, player } = setup();
  player.nextVideo();
  player.pauseVideo();
  media.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(media.plays, 0);
  assert.equal(player.getPlayerState(), 2);
});

test('cleanup removes media listeners and ignores pending playback errors', async () => {
  const { media, player, abort, errors } = setup();
  let reject;
  media.play = () => new Promise((_, fail) => { reject = fail; });
  player.playVideo();
  abort.abort();
  player.destroy();
  media.dispatchEvent(new Event('ended'));
  reject(new Error('Network failed'));
  await Promise.resolve();
  assert.equal(player.getPlaylistIndex(), 0);
  assert.deepEqual(errors, []);
});
