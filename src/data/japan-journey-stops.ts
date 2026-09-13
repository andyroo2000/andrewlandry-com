import type { TripItem } from './japan-trip-items';
import type { JourneyStop } from './japan-transfers';

type Progress = { position: number; place: string; latestCapture: number };

function isThrowback(candidate: number, captured: number, progress: Progress) {
  const olderCapture = captured > 0 && captured < progress.latestCapture;
  return candidate < progress.position - .001 || olderCapture;
}

function advanceStop(item: TripItem, candidate: number | undefined, progress: Progress): JourneyStop['locationBasis'] {
  if (candidate === undefined) return 'previous';
  const captured = item.capturedAt ? Date.parse(item.capturedAt) : 0;
  if (isThrowback(candidate, captured, progress)) return 'throwback';
  // Only located media advances the capture clock. An unlocated recap
  // must not suppress the next day's real route locations.
  progress.latestCapture = Math.max(progress.latestCapture, captured);
  if (candidate <= progress.position) return 'previous';
  progress.position = candidate;
  progress.place = item.place ?? progress.place;
  return 'route';
}

export function buildJourneyStops(items: TripItem[], positionFor: (item: TripItem) => number | undefined, stationArrivals: Set<string>) {
  const progress: Progress = { position: 0, place: items[0]!.place!, latestCapture: 0 };
  return items.map((item, index): JourneyStop => {
    const candidate = positionFor(item);
    const basis = advanceStop(item, candidate, progress);
    const locationBasis = index === 0 ? 'route' : basis;
    if (stationArrivals.has(item.id)) {
      if (basis === 'route') progress.place = 'Asahikawa';
      return { position: progress.position, place: progress.place, locationBasis: 'station-arrival' };
    }
    return { position: progress.position, place: progress.place, locationBasis };
  });
}
