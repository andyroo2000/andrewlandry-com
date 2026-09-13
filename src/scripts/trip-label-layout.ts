import type { MapPlace } from '../data/hokkaido-places';
import type { TripYear } from '../data/japan-trips';

export type Bounds = { left: number; top: number; right: number; bottom: number };
export type MeasuredPlace = MapPlace & { point: [number, number]; textWidth: number; fontSize: number };
export type LabelPlacement = { dx: number; dy: number; opacity: number };
const intersects = (a: Bounds, b: Bounds) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const fade = (value: number) => Math.max(0, Math.min(1, value));

type LayoutOptions = { year: TripYear; scale: number; zoom: number; isLand: (bounds: Bounds) => boolean };

function priority(label: MeasuredPlace, year: TripYear) {
  if (label.kind === 'city') return 70;
  return label.trips?.includes(year) ? 50 : 20;
}

function belongsToTrip(label: MeasuredPlace, year: TripYear) {
  return !label.trips || label.trips.includes(year) || label.kind === 'city';
}

function candidatePositions(label: MeasuredPlace, fontSize: number, textWidth: number): [number, number][] {
  const gap = label.kind === 'city' || label.kind === 'stop' ? 32 : 16;
  return [gap, gap + 20, gap + 40, gap + 60].flatMap(distance => [
    [distance, fontSize * .35], [-distance - textWidth, fontSize * .35],
    [-textWidth / 2, -distance], [-textWidth / 2, distance + fontSize],
    [distance * .7, -distance * .7], [-distance * .7 - textWidth, -distance * .7],
    [distance * .7, distance * .7 + fontSize], [-distance * .7 - textWidth, distance * .7 + fontSize],
  ] as [number, number][]);
}

function placeLabel(label: MeasuredPlace, occupied: Bounds[], { scale, zoom, isLand }: LayoutOptions): LabelPlacement | undefined {
  const x = label.point[0] * scale, y = label.point[1] * scale;
  // Reserve room for highlighting before the label ever becomes active.
  const fontSize = Math.max(18, label.fontSize);
  const textWidth = label.textWidth * fontSize / label.fontSize;
  const opacity = label.minZoom ? fade((zoom - label.minZoom) / .28) : 1;
  if (opacity <= 0) return;
  for (const [dx, dy] of candidatePositions(label, fontSize, textWidth)) {
    const bounds = { left: x + dx - 6, right: x + dx + textWidth + 6,
      top: y + dy - fontSize - 5, bottom: y + dy + 6 };
    if (occupied.some(box => intersects(box, bounds))) continue;
    // Test the full padded, highlighted text bounds against the actual
    // land polygon, independently of where the camera is looking.
    if (!isLand({ left: bounds.left / scale, right: bounds.right / scale,
      top: bounds.top / scale, bottom: bounds.bottom / scale })) continue;
    occupied.push(bounds);
    return { dx, dy, opacity };
  }
}

// Layout in projected map space, without a camera position, current stop, or
// screen-edge constraints. Panning can never change the selected labels or
// shuffle them between sides of their towns.
export function layoutTripLabels(labels: MeasuredPlace[], options: LayoutOptions): (LabelPlacement | undefined)[] {
  const { year, scale, zoom } = options;
  const placements: (LabelPlacement | undefined)[] = Array(labels.length);
  const eligible = labels.map((label, index) => ({ label, index })).filter(({ label }) =>
    belongsToTrip(label, year) && zoom >= label.minZoom);
  eligible.sort((a, b) => priority(b.label, year) - priority(a.label, year) || a.index - b.index);
  const occupied: Bounds[] = eligible.map(({ label }) => ({
    left: label.point[0] * scale - 8, right: label.point[0] * scale + 8,
    top: label.point[1] * scale - 8, bottom: label.point[1] * scale + 8,
  }));
  for (const { label, index } of eligible) placements[index] = placeLabel(label, occupied, options);
  return placements;
}
