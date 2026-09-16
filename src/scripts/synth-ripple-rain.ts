import { seed, TAU, type Viewport, type VisualSettings } from './synth-visual-types';
import { RAIN_ENTRY_SECONDS, type RippleEvent } from './synth-ripple-events';

export const RAIN_CYCLE = 30;
export const RAIN_OPEN_AT = 23;
export const RAIN_FLIGHT_SECONDS = 10;
const FLOOR_MARGIN = 8;
const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = unit(value); return t * t * (3 - 2 * t); };
type RainView = Viewport & { depth: number };
export type RainPlan = RippleEvent & {
  radius: number; startX: number; landing: number; spin: number; angle: number;
  restX: number; restY: number; drainAt: number; floor: number; center: number; passThrough: boolean;
  fallSpeed: number; launchDistance: number;
};

function rainMotion(view: Viewport) {
  return { fallSpeed: (view.height + 16) / RAIN_FLIGHT_SECONDS, launchDistance: Math.min(110, view.height * .14) };
}

export function rainEntryLine(view: Viewport) {
  const { fallSpeed, launchDistance } = rainMotion(view);
  // Every drop's lower edge reaches this height at its audio timestamp.
  return -24 + fallSpeed * RAIN_ENTRY_SECONDS + launchDistance;
}

export function rainGate(time: number) {
  const phase = ((time % RAIN_CYCLE) + RAIN_CYCLE) % RAIN_CYCLE;
  return smooth((phase - RAIN_OPEN_AT) / .8) * (1 - smooth(phase - 29));
}

export function rainGap(view: Pick<Viewport, 'width'>, time: number) {
  return Math.min(view.width * .34, 420) * rainGate(time) / 2;
}

function floorArrival(contact: Pick<RainPlan, 'landing' | 'startX' | 'radius'>, view: Viewport) {
  const { landing, startX, radius } = contact;
  const opening = Math.floor(landing / RAIN_CYCLE) * RAIN_CYCLE + RAIN_OPEN_AT;
  const passThrough = Math.abs(startX - view.width / 2) + radius < rainGap(view, landing);
  // Rain over the open hole keeps falling. New arrivals on the remaining
  // floor collect for the next cycle; no arrivals are delayed in midair.
  const drainAt = landing <= opening ? opening : opening + RAIN_CYCLE;
  return { passThrough, drainAt };
}

function rainBurst(event: RippleEvent) {
  if (event.object) return { count: 1, scale: 1 };
  if (event.energy >= .8) return { count: 1, scale: 4 };
  if (event.energy >= .5) return { count: 2, scale: 2 };
  return { count: 4 + Math.floor(seed(event.id + 307) * 3), scale: 1 };
}

function planDrop(event: RippleEvent, view: RainView, scale: number): RainPlan {
  const baseRadius = event.object ? 34 : [5.5, 4.75, 4][event.band] * scale;
  const desired = baseRadius * (.8 + view.depth * .5);
  const radius = Math.min(desired, (view.width - 24) / 2);
  const room = Math.max(0, view.width - radius * 2 - 24);
  const startX = radius + 12 + room * seed(event.id + 71);
  const floor = view.height - FLOOR_MARGIN;
  const { fallSpeed, launchDistance } = rainMotion(view);
  const landing = event.born + (view.height + 16 - launchDistance) / fallSpeed;
  return {
    ...event, radius, landing, startX, restX: startX, restY: floor - radius,
    ...floorArrival({ landing, startX, radius }, view),
    floor, center: view.width / 2, fallSpeed, launchDistance,
    ...dropRotation(event),
  };
}

function dropRotation(event: RippleEvent) {
  const direction = seed(event.id + 181) > .5 ? 1 : -1;
  if (event.object) return { spin: .16 * direction, angle: (seed(event.id + 163) - .5) * .6 };
  return { spin: [.35, .8, 1.3][event.band] * direction, angle: seed(event.id + 163) * TAU };
}

export function buildRainPlan(events: RippleEvent[], view: RainView) {
  // Stronger onsets trade a shower of small drops for fewer, larger shapes.
  // Every drop keeps its own x coordinate and can overlap its neighbors.
  return events.flatMap(event => {
    const burst = rainBurst(event);
    return Array.from({ length: burst.count }, (_, index) => planDrop({
      ...event, id: event.id * 8 + index, born: event.born - RAIN_ENTRY_SECONDS,
    }, view, burst.scale));
  });
}

function fallingDrop(drop: RainPlan, time: number) {
  const elapsed = time - drop.born;
  // The extra entrance velocity eases to zero, joining the normal rain speed
  // continuously. Every size shares this motion; no ongoing speed variation.
  const launch = 1 - (1 - unit(elapsed / RAIN_ENTRY_SECONDS)) ** 3;
  const startY = -drop.radius - 24;
  return {
    x: drop.startX,
    y: startY + drop.fallSpeed * elapsed + drop.launchDistance * launch,
    angle: drop.angle + (time - drop.born) * drop.spin,
    grounded: false,
  };
}

function drainingDrop(drop: RainPlan, time: number) {
  const distance = Math.abs(drop.restX - drop.center) / Math.max(1, drop.center);
  const elapsed = time - drop.drainAt - .12 - distance * .55;
  const travel = 1.4 + distance * 1.5;
  const slide = smooth(elapsed / travel);
  const falling = Math.max(0, elapsed - travel);
  return {
    x: drop.restX + (drop.center + (seed(drop.id + 239) - .5) * 60 - drop.restX) * slide,
    y: drop.restY + (drop.floor - drop.radius - drop.restY) * slide + falling * falling * 360,
    angle: drop.angle + (drop.landing - drop.born) * drop.spin + Math.max(0, elapsed) * drop.spin * 1.8,
    grounded: falling === 0,
  };
}

export function sampleRainDrop(drop: RainPlan, time: number) {
  if (time < drop.born || time >= drop.drainAt + 6) return;
  let motion;
  if (time < drop.landing || drop.passThrough) motion = fallingDrop(drop, time);
  else if (time >= drop.drainAt) motion = drainingDrop(drop, time);
  else motion = { x: drop.restX, y: drop.restY, angle: drop.angle + (drop.landing - drop.born) * drop.spin, grounded: true };
  return { ...motion, radius: drop.radius, id: drop.id, alpha: .88, object: drop.object };
}

export function createRainPlanReader() {
  let key = '';
  let track: VisualSettings['timeline'];
  let plan: RainPlan[] = [];
  return (events: RippleEvent[], size: Viewport, settings: VisualSettings) => {
    const nextKey = [events[0]?.id, events.at(-1)?.id, events.length, size.width, size.height, settings.depth].join(':');
    const sameLayout = track?.track === settings.timeline?.track;
    if (key === nextKey && sameLayout) return plan;
    key = nextKey; track = settings.timeline;
    plan = buildRainPlan(events, { ...size, depth: settings.depth });
    return plan;
  };
}
