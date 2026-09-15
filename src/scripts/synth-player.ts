import { connectSynthPlayer, createTrackTitleLoader, readSynthPlayback, youtubeVideoId, type SynthPlayer } from './synth-youtube';
import { initSynthKeyboard } from './synth-keyboard';
import { initSynthVolume } from './synth-volume';
import { syncSynthTrackUrl, synthTrackPageTitle } from './synth-track-links';

export function initSynthPlayer() {
  const iframe = document.querySelector<HTMLIFrameElement>('#synth-youtube');
  if (!iframe) return () => undefined;
  const listen = document.querySelector<HTMLButtonElement>('[data-listen]')!;
  const label = document.querySelector<HTMLElement>('[data-listen-label]')!;
  const icon = document.querySelector<HTMLElement>('[data-listen-icon]')!;
  const previous = document.querySelector<HTMLButtonElement>('[data-previous-track]')!;
  const next = document.querySelector<HTMLButtonElement>('[data-next-track]')!;
  const title = document.querySelector<HTMLElement>('[data-track-title]')!;
  const message = document.querySelector<HTMLElement>('[data-player-message]')!;
  const volume = document.querySelector<HTMLInputElement>('[data-volume]')!;
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const loadTitle = createTrackTitleLoader();
  let player: SynthPlayer | undefined;
  let currentUrl = '';
  let hasPlayed = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  const syncVolume = initSynthVolume(volume, () => player, abort.signal);

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
  function updateTitle(url: string, index: number) {
    currentUrl = url;
    title.textContent = `Track ${index + 1}`;
    void loadTitle(url).then(name => {
      if (!abort.signal.aborted && currentUrl === url) {
        title.textContent = name;
        document.title = synthTrackPageTitle(name);
      }
    }).catch(() => { if (currentUrl === url) currentUrl = ''; });
  }
  function updateTrack() {
    if (!player) return;
    syncVolume();
    const index = updateNavigation(player);
    const videoId = youtubeVideoId(player.getVideoUrl());
    if (!videoId) return;
    syncSynthTrackUrl(videoId);
    // YouTube can append seek timestamps; those do not change the track title.
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (url !== currentUrl) updateTitle(url, index);
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
    player.setShuffle(false);
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
  void connectSynthPlayer(iframe, {
    onReady: ready,
    onStateChange: event => updatePlayback(event.data),
    onError: () => showMessage('This track could not play. Try the next track or reload the page.'),
    onAutoplayBlocked: () => showMessage('Tap play in the video to start listening.'),
  }, abort.signal).catch(() => showMessage('You can still use the play button in the video.'));
  return () => readSynthPlayback(player);
}
