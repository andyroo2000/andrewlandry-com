import type { JourneyLeg, MapJourney } from '../data/japan-transfers';
import { sampleJourney } from './trip-transfer';

type RoutePath = Pick<CanvasPath, 'moveTo' | 'lineTo'>;

function traceLeg(path: RoutePath, leg: JourneyLeg, distance: number) {
  path.moveTo(...leg.points[0]!);
  for (let i = 1; i < leg.points.length; i++) {
    if (leg.distances[i]! > distance) break;
    path.lineTo(...leg.points[i]!);
  }
}

// Use the marker's same distance cursor so the visible trail ends exactly
// beneath it, including when seeking backward or crossing transport legs.
export function traceTripRoute(path: RoutePath, journey: MapJourney, position: number) {
  const frame = sampleJourney(journey, position);
  for (const leg of journey.legs.slice(0, frame.index)) traceLeg(path, leg, Infinity);
  traceLeg(path, frame.leg, Math.max(0, position - frame.leg.start));
  path.lineTo(...frame.point);
}
