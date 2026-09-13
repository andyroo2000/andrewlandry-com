import { trips, type TripYear } from '../data/japan-trips';
import { createTripCamera } from './trip-camera';
import { tripDayAtTime } from '../data/japan-trip-days';
import { adjacentItem, itemAtTime, tripItems } from '../data/japan-trip-items';

interface YouTubePlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  cueVideoById(video: { videoId: string; startSeconds: number }): void;
  loadVideoById(video: { videoId: string; startSeconds: number }): void;
  destroy(): void;
}
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: { Player: new (element: HTMLIFrameElement, options: {
      events: { onReady: () => void; onStateChange: (event: { data: number }) => void; onError: () => void; onAutoplayBlocked: () => void };
    }) => YouTubePlayer };
  }
}

const root = document.querySelector<HTMLElement>('[data-trip-page]');
if (root) {
  const camera = createTripCamera(root);
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-year]');
  const previous = root.querySelector<HTMLButtonElement>('[data-previous-item]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-next-item]')!;
  const video = root.querySelector<HTMLVideoElement>('[data-local-video]');
  const iframe = root.querySelector<HTMLIFrameElement>('#trip-youtube');
  const fallback = root.querySelector<HTMLAnchorElement>('[data-video-fallback]')!;
  const params = new URLSearchParams(location.search);
  let year: TripYear = params.get('trip') === '2025' ? '2025' : '2026';
  let initialTime = Math.max(0, Number(params.get('t')) || 0);
  if (!Number.isFinite(initialTime)) initialTime = 0;
  let player: YouTubePlayer | undefined;
  let youtubeReady = false;
  let pendingYouTubeSound: { muted: boolean; readyState: number } | undefined;
  let disposed = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  let pendingItem: { index: number; until: number } | undefined;

  function pendingExpired() {
    return pendingItem !== undefined && performance.now() > pendingItem.until;
  }
  function playbackReady() {
    return video ? video.readyState >= 1 : youtubeReady;
  }
  function currentItem(seconds: number) {
    if (pendingItem && !pendingExpired()) return pendingItem.index;
    return itemAtTime(year, seconds);
  }
  function updateNavigation(seconds: number) {
    const current = itemAtTime(year, seconds);
    if (pendingItem?.index === current || pendingExpired()) pendingItem = undefined;
    const index = pendingItem?.index ?? current;
    const ready = playbackReady();
    previous.disabled = !ready || index === 0;
    next.disabled = !ready || index === tripItems[year].length - 1;
  }
  function skipItem(direction: -1 | 1) {
    if (!playbackReady()) return;
    const seconds = video ? video.currentTime : player!.getCurrentTime();
    const current = currentItem(seconds);
    const index = adjacentItem(year, current, direction);
    if (index === current) return;
    // Land one frame inside the item, avoiding floating-point/keyframe edge
    // cases that can briefly leave the preceding still on screen after a seek.
    const target = tripItems[year][index]!.at + 1 / 30;
    pendingItem = { index, until: performance.now() + 2000 };
    if (video) video.currentTime = target;
    else {
      const wasPlaying = player!.getPlayerState() === 1;
      player!.seekTo(target, true);
      if (!wasPlaying) player!.pauseVideo();
    }
    sync(target, true);
    // Keep pending state until the player's clock catches up, so rapid clicks
    // continue through items even while YouTube is still seeking/buffering.
    pendingItem = { index, until: performance.now() + 2000 };
  }
  previous.addEventListener('click', () => skipItem(-1), options);
  next.addEventListener('click', () => skipItem(1), options);
  function toggleYouTube(event: KeyboardEvent) {
    const pageFocused = event.target === root || event.target === document.body;
    if (!iframe || !youtubeReady) return false;
    if (!pageFocused) return false;
    event.preventDefault();
    if (!event.repeat) {
      if (player!.getPlayerState() === 1) player!.pauseVideo();
      else player!.playVideo();
    }
    return true;
  }
  function hasModifier(event: KeyboardEvent) {
    return [event.altKey, event.ctrlKey, event.metaKey, event.shiftKey, event.isComposing].some(Boolean);
  }
  function ownsArrowKeys(target: EventTarget | null) {
    return target instanceof Element && target.closest('video, input, textarea, select, [contenteditable="true"], [role="slider"]');
  }
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && toggleYouTube(event)) return;
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (hasModifier(event) || ownsArrowKeys(event.target)) return;
    event.preventDefault();
    skipItem(event.key === 'ArrowLeft' ? -1 : 1);
  }, { ...options, capture: true });

  function sync(seconds: number, started = false) {
    const waitingForSeek = currentItem(seconds) !== itemAtTime(year, seconds);
    updateNavigation(seconds);
    if (waitingForSeek) return;
    if (seconds > 0 || started) camera.sync(year, itemAtTime(year, seconds), tripDayAtTime(year, seconds));
  }
  function setPlaying(playing: boolean) {
    root!.classList.toggle('is-playing', playing);
    if (playing) fallback.hidden = true;
  }
  function updateSelection() {
    buttons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.year === year)); });
    fallback.href = `https://youtu.be/${trips[year].videoId}`;
    fallback.hidden = true;
    pendingItem = undefined;
    previous.disabled = true;
    next.disabled = true;
    camera.showTrip(year);
  }
  updateSelection();

  if (video) {
    function loadLocal(autoplay: boolean) {
      video!.poster = `/images/japan-cycling-${year}.webp`;
      video!.src = `/__trip-media/${year}.mp4`;
      video!.setAttribute('aria-label', `Hokkaido cycling trip ${year}`);
      video!.load();
      if (autoplay) void video!.play().catch(() => setPlaying(false));
    }
    video.addEventListener('loadedmetadata', () => {
      if (initialTime > 0) video.currentTime = Math.min(initialTime, video.duration);
      sync(video.currentTime, true);
      initialTime = 0;
    }, options);
    video.addEventListener('timeupdate', () => sync(video.currentTime, !video.paused), options);
    video.addEventListener('seeked', () => sync(video.currentTime, true), options);
    video.addEventListener('play', () => { setPlaying(true); sync(video.currentTime, true); }, options);
    video.addEventListener('pause', () => setPlaying(false), options);
    video.addEventListener('ended', () => setPlaying(false), options);
    video.addEventListener('error', () => { fallback.hidden = false; setPlaying(false); }, options);
    buttons.forEach(button => button.addEventListener('click', () => {
      if (year === button.dataset.year) return;
      const wasPlaying = !video.paused;
      year = button.dataset.year as TripYear;
      initialTime = 0;
      updateSelection();
      loadLocal(wasPlaying);
      updateUrl();
    }, options));
    // Start silently so autoplay works without a prior gesture. The native
    // volume control remains available, and switching trips preserves it.
    video.muted = true;
    loadLocal(true);
  } else if (iframe) {
    // YouTube owns playback/controls; its actual clock drives the same map as
    // the local MP4 preview. No second simulated timeline to drift out of sync.
    const url = new URL(iframe.src);
    url.pathname = `/embed/${trips[year].videoId}`;
    url.searchParams.set('origin', location.origin);
    if (initialTime) url.searchParams.set('start', String(Math.floor(initialTime)));
    iframe.src = url.href;
    iframe.title = `Hokkaido cycling trip ${year}`;
    function pollYouTube() {
      if (!disposed && !document.hidden) sync(player!.getCurrentTime(), player!.getPlayerState() === 1);
    }
    function onYouTubeReady() {
      youtubeReady = true;
      pendingYouTubeSound = { muted: true, readyState: 1 };
      player!.mute();
      player!.loadVideoById({ videoId: trips[year].videoId, startSeconds: initialTime });
      sync(initialTime, true);
      initialTime = 0;
      poll = setInterval(pollYouTube, 250);
    }
    function setYouTubeMuted(muted: boolean) {
      if (muted) player!.mute();
      else player!.unMute();
    }
    function onYouTubeStateChange(event: { data: number }) {
      // Restore sound after YouTube finishes replacing its media element;
      // setting it only before loadVideoById can be lost during that load.
      if (pendingYouTubeSound?.readyState === event.data) {
        setYouTubeMuted(pendingYouTubeSound.muted);
        pendingYouTubeSound = undefined;
      }
      setPlaying(event.data === 1);
    }
    const initialize = () => {
      if (disposed || !window.YT) return;
      player = new window.YT.Player(iframe, { events: {
        onReady: onYouTubeReady,
        onStateChange: onYouTubeStateChange,
        onError() { fallback.hidden = false; setPlaying(false); },
        onAutoplayBlocked() { setPlaying(false); },
      } });
    };
    window.onYouTubeIframeAPIReady = initialize;
    if (window.YT?.Player) initialize();
    else {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { fallback.hidden = false; };
      document.head.append(script);
    }
    function loadSelectedYouTube(wasPlaying: boolean) {
      if (!youtubeReady) return;
      const wasMuted = pendingYouTubeSound?.muted ?? player!.isMuted();
      pendingYouTubeSound = { muted: wasMuted, readyState: wasPlaying ? 1 : 5 };
      const next = { videoId: trips[year].videoId, startSeconds: 0 };
      if (wasPlaying) player!.loadVideoById(next);
      else player!.cueVideoById(next);
      // YouTube can reset its sound setting when loading another video.
      setYouTubeMuted(wasMuted);
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      if (year === button.dataset.year) return;
      const wasPlaying = youtubeReady && player?.getPlayerState() === 1;
      year = button.dataset.year as TripYear;
      initialTime = 0;
      updateSelection();
      iframe.title = `Hokkaido cycling trip ${year}`;
      loadSelectedYouTube(wasPlaying);
      updateUrl();
    }, options));
  }

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('trip', year);
    url.searchParams.delete('t');
    history.replaceState(null, '', url);
  }
  function cleanup() {
    disposed = true;
    clearInterval(poll);
    camera.destroy();
    abort.abort();
    player?.destroy();
  }
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
}
