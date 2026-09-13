import type { TripYear } from '../data/japan-trips';
import { createTripLabels } from './trip-labels';
import { createTripSign } from './trip-sign';
import { createTripRoute } from './trip-route';
import type { TripDay } from '../data/japan-trip-days';
import type { MapJourney } from '../data/japan-transfers';
import { createTransferMarker, sampleJourney } from './trip-transfer';

const MAP_ZOOM = 2.15;
const ease = (t: number) => t * t * (3 - 2 * t);

export function createTripCamera(root: HTMLElement) {
  const map = root.querySelector<HTMLElement>('[data-map]')!;
  const svg = map.querySelector<SVGSVGElement>('svg')!;
  const world = map.querySelector<SVGGElement>('[data-world]')!;
  const pin = map.querySelector<SVGGElement>('[data-pin]')!;
  const sign = createTripSign(root);
  const journeys = JSON.parse(map.dataset.journeys!) as Record<TripYear, MapJourney>;
  const marker = createTransferMarker(pin);
  const labels = createTripLabels(root);
  const route = createTripRoute(map);
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
    world.style.setProperty('--map-scale', String(scale));
    world.setAttribute('transform', `translate(${width * .79},${height * .53}) scale(${scale}) translate(${-x},${-y})`);
    route.draw(year, position);
    // The marker sits above the label layer at the camera's fixed anchor.
    pin.setAttribute('transform', `translate(${width * .79},${height * .53})`);
    pin.dataset.journeyPosition = String(position);
    marker.draw(frame, moving, direction);
    labels.select(year, moving && frame.leg.destination ? frame.leg.destination : journeys[year].stops[index]?.place ?? '');
    labels.draw({ x, y, scale, width, height, zoom: MAP_ZOOM });
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
    function step(now: number) {
      if (disposed) return;
      const t = Math.min(1, (now - began) / duration);
      // Interpolate distance along the journey, never screen coordinates. A
      // rapid second seek retargets from this cursor and preserves every bend.
      position = t === 1 ? next : from + (next - from) * ease(t);
      moving = t < 1;
      draw();
      if (moving) animation = requestAnimationFrame(step);
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
      map.querySelectorAll<SVGGElement>('[data-route]').forEach(route => { route.style.display = route.dataset.route === year ? '' : 'none'; });
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
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      desktop.removeEventListener('change', resize);
      reduced.removeEventListener('change', settle);
      document.removeEventListener('visibilitychange', settle);
    },
  };
}
