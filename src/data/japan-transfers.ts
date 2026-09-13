import { geoInterpolate } from 'd3-geo';
import geography from '../../public/data/japan-transfers.json';
import { mapProjection, type buildRouteMap } from './japan-route-map';
import { tripItems } from './japan-trip-items';
import { buildJourneyStops } from './japan-journey-stops';
import type { TripYear } from './japan-trips';
import { smoothRide, distanceAtSourceFraction } from './japan-route-smoothing';

export type TransferMode = 'dot' | 'bike' | 'train' | 'ferry' | 'plane' | 'bus';
export type TransferPoint = [number, number];
export type JourneyLeg = {
  mode: TransferMode;
  points: TransferPoint[];
  distances: number[];
  start: number;
  end: number;
  fromProgress: number;
  toProgress: number;
  d: string;
  destination?: string;
  activity?: string;
  segment?: number;
};
export type JourneyStop = {
  position: number;
  place: string;
  locationBasis: 'route' | 'station-arrival' | 'previous' | 'throwback';
};
export type MapJourney = { legs: JourneyLeg[]; stops: JourneyStop[]; total: number };
type Route = ReturnType<typeof buildRouteMap>;
type PathName = keyof typeof geography;
const asahikawaArrivalItems = new Set(['2026-1-006', '2026-1-007']);

// One ordered path for the whole trip. The marker, camera, and completed rides
// share this cursor, including when navigation interrupts an animation.
export function buildJourney(year: TripYear, route: Route): MapJourney {
  const legs: JourneyLeg[] = [];
  const anchors: Record<string, number> = {};
  const rideFractions = new Map<JourneyLeg, number[]>();
  let total = 0;
  function add(mode: TransferMode, points: TransferPoint[], fromProgress: number,
    details: { toProgress?: number; destination?: string; activity?: string; segment?: number } = {}): JourneyLeg {
    const { toProgress = fromProgress, destination, activity, segment } = details;
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
    const leg = { mode, points, distances, start: total, end: total + distances.at(-1)!, fromProgress, toProgress, destination, activity, segment,
      d: points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('') };
    total = leg.end;
    legs.push(leg);
    return leg;
  }
  function connect(point: TransferPoint) {
    const previous = legs.at(-1);
    if (!previous) return;
    const from = previous.points.at(-1)!;
    if (Math.hypot(from[0] - point[0], from[1] - point[1]) > .0001) {
      // Only small gaps at GPX recording boundaries and station/port entrances.
      // These visible links do not add to cycling progress or daily mileage.
      add('dot', [from, point], previous.toProgress);
    }
  }
  function path(name: PathName, mode: TransferMode, progress: number, options: { destination?: string; reverse?: boolean } = {}) {
    const points = geography[name].coordinates.map(p => mapProjection(p as TransferPoint)! as TransferPoint);
    if (options.reverse) points.reverse();
    connect(points[0]!);
    return add(mode, points, progress, { destination: options.destination });
  }

  function addArrival() {
    if (year === '2025') {
      path('sapporo-fukagawa', 'train', 0, { destination: 'Fukagawa' });
      path('fukagawa-station-ride', 'dot', 0);
    } else {
      // Illustrative airport-to-airport arc, not a recorded flight track.
      const arc = geoInterpolate(tripItems[year][0]!.coordinates!, tripItems[year][1]!.coordinates!);
      const flight = add('plane', Array.from({ length: 81 }, (_, i) => mapProjection(arc(i / 80))! as TransferPoint), 0, { destination: 'New Chitose Airport' });
      anchors['2026-1-002'] = flight.end;
      const bus = path('chitose-sapporo', 'bus', 0, { destination: 'Sapporo' });
      for (const id of ['2026-1-003', '2026-1-004', '2026-1-005']) anchors[id] = bus.end;
      path('sapporo-city-station', 'dot', 0);
      const train = path('sapporo-asahikawa', 'train', 0, { destination: 'Asahikawa' });
      // Arrive during the bike-on-train clip and hold the exact same position
      // for the Day 1 Strava card, as requested by Andrew. Only the following
      // cycle-road clip starts the station exit and approach to the recording.
      for (const id of asahikawaArrivalItems) anchors[id] = train.end;
      path('asahikawa-station-ride', 'dot', 0);
    }
  }

  addArrival();

  function addTransferBeforeRide(segment: Route['segments'][number]) {
    if (segment.segment !== 0) return;
    if (segment.activity === '15003096355') {
      path('wakkanai-ride-port', 'dot', segment.start);
      path('wakkanai-oshidomari', 'ferry', segment.start, { destination: 'Rishiri Island' });
    } else if (segment.activity === '15021289273') {
      const ferry = path('oshidomari-kafuka', 'ferry', segment.start, { destination: 'Rebun Island' });
      anchors['2025-1-059'] = ferry.end;
    } else if (segment.activity === '15022389167') {
      path('oshidomari-kafuka', 'ferry', segment.start, { destination: 'Rishiri Island', reverse: true });
    } else if (segment.activity === '15032573721') {
      const ferry = path('wakkanai-oshidomari', 'ferry', segment.start, { destination: 'Wakkanai', reverse: true });
      anchors['2025-1-065'] = ferry.end;
      path('wakkanai-port-ride', 'dot', segment.start);
    } else if (segment.activity === '19209523543') {
      path('teshikaga-recording-gap', 'dot', segment.start);
    } else if (segment.activity === '19239062959') {
      path('ashoro-recording-gap', 'dot', segment.start);
    }
  }

  for (const segment of route.segments) {
    addTransferBeforeRide(segment);
    connect(segment.points[0]!);
    const storyFractions = tripItems[year].flatMap(item => item.routePosition?.activity === segment.activity
      && item.routePosition.segment === segment.segment ? [item.routePosition.fraction] : []);
    const smoothed = smoothRide(segment.points, segment.distances, storyFractions);
    const ride = add('bike', smoothed.points, segment.start, { toProgress: segment.end, activity: segment.activity, segment: segment.segment });
    rideFractions.set(ride, smoothed.sourceFractions);
  }

  if (year === '2026') {
    // The published itinerary confirms a train back to Sapporo after Day 12.
    path('sapporo-asahikawa', 'train', route.total, { destination: 'Sapporo', reverse: true });
    anchors['2026-2-018'] = path('sapporo-city-station', 'dot', route.total, { reverse: true }).end;
  }

  function itemPosition(item: (typeof tripItems)[TripYear][number]) {
    if (anchors[item.id] !== undefined) return anchors[item.id];
    const source = item.routePosition;
    if (!source) return;
    const ride = legs.find(leg => leg.activity === source.activity && leg.segment === source.segment);
    if (!ride) return;
    return ride.start + distanceAtSourceFraction(rideFractions.get(ride)!, ride.distances, source.fraction);
  }

  return { legs, stops: buildJourneyStops(tripItems[year], itemPosition, asahikawaArrivalItems), total };
}
