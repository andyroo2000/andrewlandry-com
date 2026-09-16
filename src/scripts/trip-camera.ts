import type { TripYear } from '../data/japan-trips';
import { createTripLabels } from './trip-labels';
import { createLabelCanvas } from './trip-label-canvas';
import { createTripSign } from './trip-sign';
import { createMapCanvas } from './trip-map-canvas';
import type { TripDay } from '../data/japan-trip-days';
import type { MapJourney } from '../data/japan-transfers';
import { createTransferMarker, sampleJourney } from './trip-transfer';

const MAP_ZOOM = 2.15;
const ease = (t: number) => t * t * (3 - 2 * t);

export function createTripCamera(root: HTMLElement) {
  const map = root.querySelector<HTMLElement>('[data-map]')!;
  const svg = map.querySelector<SVGSVGElement>('svg')!;
  const pin = map.querySelector<SVGGElement>('[data-pin]')!;
  const sign = createTripSign(root);
  const journeys = JSON.parse(map.dataset.journeys!) as Record<TripYear, MapJourney>;
  const marker = createTransferMarker(pin);
  const labels = createTripLabels(root);
  const labelArtwork = createLabelCanvas(root);
  const artwork = createMapCanvas(map, journeys);
  const desktop = matchMedia('(min-width: 901px) and (hover: hover)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let year: TripYear = '2026';
  let index = -1;
  let width = 1440;
  let height = 900;
  let baseScale = .8;
  let position = 0;
  let targetPosition = 0;
  let moving = false;
  let direction = 1;
  let animation = 0;
  let disposed = false;

  function draw() {
    const frame = sampleJourney(journeys[year], position);
    const [x, y] = frame.point;
    const scale = baseScale * MAP_ZOOM;
    artwork.draw({ x, y, scale, width, height }, year, position);
    // The marker has its own small SVG at the camera's fixed CSS anchor.
    // Its pulse must not invalidate the full viewport's label mask.
    pin.dataset.journeyPosition = String(position);
    marker.draw(frame, moving, direction);
    labels.select(year, moving && frame.leg.destination ? frame.leg.destination : journeys[year].stops[index]?.place ?? '');
    labels.draw({ x, y, scale, width, height, zoom: MAP_ZOOM });
    labelArtwork.draw({ x, y, scale, width, height });
  }

  function warmNextStop() {
    if (!desktop.matches) return;
    const next = journeys[year].stops[index + 1];
    if (!next) return;
    const [x, y] = sampleJourney(journeys[year], next.position).point;
    artwork.warm({ x, y, scale: baseScale * MAP_ZOOM, width, height }, year);
  }

  function shouldAnimate(animate: boolean, next: number) {
    if (!desktop.matches || reduced.matches) return false;
    if (document.hidden) return false;
    return animate && Math.abs(next - position) > .0001;
  }

  function animationDuration(from: number, next: number) {
    const transports = journeys[year].legs.filter(leg => !['dot', 'bike'].includes(leg.mode));
    const hasTransport = transports.some(leg => leg.end > Math.min(from, next) && leg.start < Math.max(from, next));
    return hasTransport ? 3500 : 2800;
  }

  function animateTo(next: number) {
    const from = position;
    const duration = animationDuration(from, next);
    const began = performance.now();
    let lastDraw = began - 1000 / 30;
    function step(now: number) {
      if (disposed) return;
      const t = Math.min(1, (now - began) / duration);
      // Match the video's cadence instead of repainting two map frames per
      // video frame. Always draw the endpoint, including reduced frame rates.
      if (t < 1 && now - lastDraw < 1000 / 30 - .5) {
        animation = requestAnimationFrame(step);
        return;
      }
      lastDraw = now;
      // Interpolate distance along the journey, never screen coordinates. A
      // rapid second seek retargets from this cursor and preserves every bend.
      position = t === 1 ? next : from + (next - from) * ease(t);
      moving = t < 1;
      draw();
      if (moving) animation = requestAnimationFrame(step);
      else warmNextStop();
    }
    animation = requestAnimationFrame(step);
  }

  function move(animate: boolean) {
    const next = journeys[year].stops[index]?.position ?? 0;
    // An unlocated card or throwback can arrive before the previous animation
    // ends. Keep that animation running instead of restarting its easing.
    const sameDestination = moving && next === targetPosition;
    if (animate && sameDestination) { draw(); return; }
    cancelAnimationFrame(animation);
    targetPosition = next;
    direction = Math.sign(next - position);
    moving = shouldAnimate(animate, next);
    if (moving) { animateTo(next); return; }
    position = next;
    if (desktop.matches) draw();
  }

  function resize() {
    if (!desktop.matches) { cancelAnimationFrame(animation); return; }
    width = root.clientWidth;
    height = root.clientHeight;
    baseScale = Math.min(width / 1350, height / 1020);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    labels.measure(true);
    move(false);
    warmNextStop();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  desktop.addEventListener('change', resize);
  const settle = () => { cancelAnimationFrame(animation); moving = false; position = targetPosition; if (desktop.matches) draw(); };
  reduced.addEventListener('change', settle);
  document.addEventListener('visibilitychange', settle);
  void document.fonts.ready.then(() => { if (!disposed) resize(); });

  return {
    showTrip(nextYear: TripYear) {
      year = nextYear;
      index = -1;
      pin.style.opacity = '0';
      sign.hide();
      labels.select(year, '');
      labels.measure();
      move(false);
    },
    sync(nextYear: TripYear, nextIndex: number, tripDay: TripDay) {
      const dateChanged = sign.showDay(tripDay);
      if (year === nextYear && index === nextIndex) {
        if (dateChanged && desktop.matches) { labels.measure(); draw(); }
        return;
      }
      const hadPrevious = year === nextYear && index >= 0;
      year = nextYear;
      index = nextIndex;
      const stop = journeys[year].stops[index]!;
      sign.showPlace(stop);
      pin.style.opacity = '1';
      labels.select(year, stop.place);
      labels.measure();
      move(hadPrevious);
      if (!moving) warmNextStop();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      artwork.destroy();
      labelArtwork.destroy();
      desktop.removeEventListener('change', resize);
      reduced.removeEventListener('change', settle);
      document.removeEventListener('visibilitychange', settle);
    },
  };
}
