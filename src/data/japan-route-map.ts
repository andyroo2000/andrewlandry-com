import { geoMercator } from 'd3-geo';
import rides2025 from './japan-rides-2025.json';
import rides2026 from './japan-rides-2026.json';
import type { TripYear } from './japan-trips';

type Point = [number, number];
type Ride = { id: string; date: string; name: string; miles: number; segments: number[][][] };
type RouteSegment = { date: string; activity: string; segment: number; points: Point[]; distances: number[]; start: number; end: number; d: string };
export const mapProjection = geoMercator().center([142.6, 43.6]).scale(9000).translate([900, 700]);
const rides: Record<TripYear, Ride[]> = { '2025': rides2025, '2026': rides2026 };

// Build-time only: project the coastline and GPS into the same coordinate space.
// Each recording/GPX segment remains a separate path, including island transfers.
export function buildRouteMap(year: TripYear) {
  let total = 0;
  const miles: Record<string, number> = {};
  const segments: RouteSegment[] = [];
  for (const ride of rides[year]) {
    miles[ride.date] = Math.round(((miles[ride.date] ?? 0) + ride.miles) * 100) / 100;
    for (const [segmentIndex, coordinates] of ride.segments.entries()) {
      const points = coordinates.map(point => mapProjection([point[0]!, point[1]!])!.map(n => +n.toFixed(3)) as Point);
      const distances = [0];
      for (let i = 1; i < points.length; i++) {
        distances.push(distances[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
      }
      const start = total;
      total += distances.at(-1)!;
      segments.push({ date: ride.date, activity: ride.id, segment: segmentIndex, points, distances, start, end: total,
        d: points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') });
    }
  }

  return { segments, miles, total };
}
