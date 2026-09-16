import tracks from '../data/synth-tracks.json';
import { readSynthPlayback, type SynthPlayer } from './synth-playback';
import { initSynthKeyboard } from './synth-keyboard';
import { syncSynthTrackUrl, synthTrackPageTitle } from './synth-track-links';
import type MuxPlayerElement from '@mux/mux-player';
import { connectMuxSynth } from './synth-mux';

export function initSynthPlayer() {
  const mux = document.querySelector<MuxPlayerElement>('#synth-mux');
  if (!mux) return () => undefined;
  const listen = document.querySelector<HTMLButtonElement>('[data-listen]')!;
  const label = document.querySelector<HTMLElement>('[data-listen-label]')!;
  const icon = document.querySelector<HTMLElement>('[data-listen-icon]')!;
  const previous = document.querySelector<HTMLButtonElement>('[data-previous-track]')!;
  const next = document.querySelector<HTMLButtonElement>('[data-next-track]')!;
  const title = document.querySelector<HTMLElement>('[data-track-title]')!;
  const message = document.querySelector<HTMLElement>('[data-player-message]')!;
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let player: SynthPlayer | undefined;
  let currentId = '';
  let hasPlayed = false;
  let poll: ReturnType<typeof setInterval> | undefined;

  function showMessage(text: string) {
    message.textContent = text;
    message.hidden = false;
  }
  function updateNavigation(current: SynthPlayer) {
    const videos = current.getPlaylist() || [];
    const index = current.getPlaylistIndex();
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index >= videos.length - 1;
    return index;
  }
  function updateTrack() {
    if (!player) return;
    const index = updateNavigation(player);
    const videoId = player.getVideoId();
    syncSynthTrackUrl(videoId);
    if (videoId === currentId) return;
    currentId = videoId;
    const name = tracks.find(track => track.videoId === videoId)?.title ?? `Track ${index + 1}`;
    title.textContent = name;
    document.title = synthTrackPageTitle(name);
  }
  function updatePlayback(state: number) {
    if (state === 1) { hasPlayed = true; message.hidden = true; }
    const playing = state === 1 || state === 3;
    label.textContent = playing ? 'Pause listening' : hasPlayed ? 'Resume listening' : 'Start listening';
    icon.textContent = playing ? 'Ⅱ' : '▶';
    updateTrack();
  }
  function startPolling() {
    clearInterval(poll);
    if (player && !document.hidden) poll = setInterval(updateTrack, 1000);
  }
  function ready(event: { target: SynthPlayer }) {
    player = event.target;
    listen.disabled = false;
    updateTrack();
    startPolling();
  }
  listen.addEventListener('click', () => {
    if (!player) return;
    if ([1, 3].includes(player.getPlayerState())) player.pauseVideo();
    else {
      if (!hasPlayed) player.unMute();
      player.playVideo();
    }
  }, options);
  previous.addEventListener('click', () => player?.previousVideo(), options);
  next.addEventListener('click', () => player?.nextVideo(), options);
  initSynthKeyboard({ listen, previous, next }, abort.signal);
  document.addEventListener('visibilitychange', startPolling, options);
  window.addEventListener('pageshow', startPolling, options);
  window.addEventListener('pagehide', event => {
    clearInterval(poll);
    if (!event.persisted) { abort.abort(); player?.destroy(); }
  }, options);
  const events = {
    onReady: ready,
    onStateChange: (event: { data: number }) => updatePlayback(event.data),
    onError: () => showMessage('This track could not play. Try the next track or reload the page.'),
    onAutoplayBlocked: () => showMessage('Tap play in the video to start listening.'),
  };
  const connection = connectMuxSynth(mux, events, abort.signal);
  void connection.catch(() => showMessage('The player could not load. Please reload the page to try again.'));
  return () => readSynthPlayback(player);
}
