import type { MapJourney, TransferMode, TransferPoint } from '../data/japan-transfers';

export function sampleJourney(journey: MapJourney, position: number) {
  const at = Math.max(0, Math.min(journey.total, position));
  let low = 0, high = journey.legs.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (journey.legs[middle]!.end < at) low = middle + 1;
    else high = middle;
  }
  const leg = journey.legs[low]!;
  const distance = at - leg.start;
  let i = 0;
  while (i < leg.points.length - 2 && leg.distances[i + 1]! < distance) i++;
  const a = leg.points[i]!, b = leg.points[i + 1] ?? a;
  const span = (leg.distances[i + 1] ?? 0) - leg.distances[i]!;
  const t = span ? Math.max(0, Math.min(1, (distance - leg.distances[i]!) / span)) : 0;
  const fraction = leg.end > leg.start ? (at - leg.start) / (leg.end - leg.start) : 1;
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as TransferPoint,
    progress: leg.fromProgress + (leg.toProgress - leg.fromProgress) * fraction,
    heading: Math.atan2(b[0] - a[0], a[1] - b[1]) * 180 / Math.PI,
    mode: leg.mode, leg, index: low };
}

export function createTransferMarker(pin: SVGGElement) {
  const plane = pin.querySelector<SVGGElement>('[data-plane-heading]')!;
  let mode: TransferMode = 'dot';
  return {
    draw(frame: ReturnType<typeof sampleJourney>, moving: boolean, direction: number) {
      // Cycling uses the pulsing location dot. Keep the ride classification
      // in the journey data for its route, mileage, and transition timing.
      const nextMode = moving && frame.mode !== 'bike' ? frame.mode : 'dot';
      if (mode !== nextMode) { mode = nextMode; pin.dataset.mode = mode; }
      if (mode === 'plane') plane.setAttribute('transform', `rotate(${frame.heading + (direction < 0 ? 180 : 0)})`);
      return mode;
    },
  };
}
