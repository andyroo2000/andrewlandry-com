import { trips, type TripYear } from '../data/japan-trips';
import { createTripCamera } from './trip-camera';
import { tripDayAtTime } from '../data/japan-trip-days';
import { adjacentItem, itemAtTime, tripItems } from '../data/japan-trip-items';
import type MuxPlayerElement from '@mux/mux-player';
import { muxPlaybackId } from '../data/mux-videos';
import { createTripUrlSync, requestedTrip, tripSegments } from '../data/japan-trip-links';

const root = document.querySelector<HTMLElement>('[data-trip-page]');
if (root) {
  const camera = createTripCamera(root);
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const yearLinks = root.querySelectorAll<HTMLAnchorElement>('a[data-year]');
  const previous = root.querySelector<HTMLButtonElement>('[data-previous-item]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-next-item]')!;
  const video = root.querySelector<HTMLVideoElement | MuxPlayerElement>('[data-local-video], #trip-mux');
  const errorMessage = root.querySelector<HTMLElement>('[data-video-error]')!;
  const requested = requestedTrip(location.href)!;
  let year = requested.year;
  let initialTime = requested.seconds;
  let loadingSelection = true;
  const syncUrl = createTripUrlSync();
  let pendingItem: { index: number; until: number } | undefined;

  function pendingExpired() {
    return pendingItem !== undefined && performance.now() > pendingItem.until;
  }
  function playbackReady() {
    return !loadingSelection && (video !== null && video.readyState >= 1);
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
    const seconds = video!.currentTime;
    const current = currentItem(seconds);
    const index = adjacentItem(year, current, direction);
    if (index === current) return;
    // Land one frame inside the item, avoiding floating-point/keyframe edge
    // cases that can briefly leave the preceding still on screen after a seek.
    const target = tripSegments[year][index]!.seconds;
    pendingItem = { index, until: performance.now() + 2000 };
    video!.currentTime = target;
    sync(target);
    // Keep pending state until the player's clock catches up, so rapid clicks
    // continue through items even while the player is still seeking/buffering.
    pendingItem = { index, until: performance.now() + 2000 };
  }
  previous.addEventListener('click', () => skipItem(-1), options);
  next.addEventListener('click', () => skipItem(1), options);
  function toggleVideo() {
    if (video!.paused) void video!.play().catch(() => setPlaying(false));
    else video!.pause();
  }
  function togglePlayback(event: KeyboardEvent) {
    const pageFocused = event.target === root || event.target === document.body;
    if (!playbackReady()) return false;
    if (!pageFocused) return false;
    event.preventDefault();
    if (!event.repeat) toggleVideo();
    return true;
  }
  function hasModifier(event: MouseEvent | KeyboardEvent) {
    return [event.altKey, event.ctrlKey, event.metaKey, event.shiftKey, 'isComposing' in event && event.isComposing].some(Boolean);
  }
  function ownsArrowKeys(target: EventTarget | null) {
    return target instanceof Element && target.closest('mux-player, video, input, textarea, select, [contenteditable="true"], [role="slider"]');
  }
  document.addEventListener('keydown', event => {
    if (hasModifier(event) || event.defaultPrevented) return;
    if (event.code === 'Space' && togglePlayback(event)) return;
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (ownsArrowKeys(event.target)) return;
    event.preventDefault();
    skipItem(event.key === 'ArrowLeft' ? -1 : 1);
  }, { ...options, capture: true });

  function sync(seconds: number) {
    if (loadingSelection) return;
    const waitingForSeek = currentItem(seconds) !== itemAtTime(year, seconds);
    updateNavigation(seconds);
    if (waitingForSeek) return;
    camera.sync(year, itemAtTime(year, seconds), tripDayAtTime(year, seconds));
    syncUrl(year, itemAtTime(year, seconds));
  }
  function setPlaying(playing: boolean) {
    root!.classList.toggle('is-playing', playing);
    if (playing) errorMessage.hidden = true;
  }
  function updateSelection() {
    loadingSelection = true;
    yearLinks.forEach(link => {
      if (link.dataset.year === year) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = `Japan Cycling Trips ${year} — Andrew Landry`;
    errorMessage.hidden = true;
    pendingItem = undefined;
    previous.disabled = true;
    next.disabled = true;
    camera.showTrip(year);
    camera.sync(year, itemAtTime(year, initialTime), tripDayAtTime(year, initialTime));
    syncUrl(year, itemAtTime(year, initialTime));
  }
  function selectYear(event: MouseEvent, link: HTMLAnchorElement) {
    if (event.button !== 0 || hasModifier(event)) return false;
    event.preventDefault();
    if (year === link.dataset.year) return false;
    year = link.dataset.year as TripYear;
    initialTime = 0;
    updateSelection();
    return true;
  }
  updateSelection();

  if (video) {
    let playOnLoad = false;
    function onLoadedMetadata() {
      if (initialTime > 0) video!.currentTime = Math.min(initialTime, video!.duration);
      loadingSelection = false;
      sync(video!.currentTime);
      initialTime = 0;
      if (playOnLoad) {
        playOnLoad = false;
        void video!.play().catch(() => setPlaying(false));
      }
    }
    function loadVideo(autoplay: boolean) {
      playOnLoad = autoplay;
      video!.poster = `/images/japan-cycling-${year}.webp`;
      if (video instanceof HTMLVideoElement) {
        video.src = `/__trip-media/${year}.mp4`;
        video.load();
      } else {
        const unchanged = video!.playbackId === muxPlaybackId(trips[year].videoId);
        video!.metadata = { video_id: trips[year].videoId, video_title: `Hokkaido cycling trip ${year}` };
        video!.playbackId = muxPlaybackId(trips[year].videoId);
        if (unchanged && video!.readyState >= 1) onLoadedMetadata();
      }
      video!.setAttribute('aria-label', `Hokkaido cycling trip ${year}`);
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata, options);
    video.addEventListener('timeupdate', () => sync(video.currentTime), options);
    video.addEventListener('seeked', () => sync(video.currentTime), options);
    video.addEventListener('play', () => { setPlaying(true); sync(video.currentTime); }, options);
    video.addEventListener('pause', () => setPlaying(false), options);
    video.addEventListener('ended', () => setPlaying(false), options);
    video.addEventListener('error', () => { errorMessage.hidden = false; setPlaying(false); }, options);
    yearLinks.forEach(link => link.addEventListener('click', event => {
      const wasPlaying = !video.paused;
      if (selectYear(event, link)) loadVideo(wasPlaying);
    }, options));
    // Start silently so autoplay works without a prior gesture. The native
    // volume control remains available, and switching trips preserves it.
    video.muted = true;
    loadVideo(true);
  }

  function cleanup() {
    camera.destroy();
    abort.abort();
  }
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
}
