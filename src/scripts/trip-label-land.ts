import type { Bounds } from './trip-label-layout';

type Point = [number, number];
type Ring = { points: Point[]; bounds: Bounds };
const overlaps = (a: Bounds, b: Bounds) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

// geoPath emits these polygon outlines using absolute M/L/Z commands. Read
// the rendered outlines themselves so placement uses exactly the same coast
// and lake edges, without shipping a second copy of the map data.
function ringsFromPath(path: string): Ring[] {
  return [...path.matchAll(/M([^M]+?)Z/g)].map(([, ring]) => {
    const values = ring!.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)!.map(Number);
    const points: Point[] = [];
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let i = 0; i < values.length; i += 2) {
      const x = values[i]!, y = values[i + 1]!;
      points.push([x, y]);
      bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
    }
    return { points, bounds };
  });
}

function pointInBounds([x, y]: Point, bounds: Bounds) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function ringContainsPoint({ points, bounds }: Ring, point: Point) {
  if (!pointInBounds(point, bounds)) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function containsPoint(rings: Ring[], point: Point) {
  return rings.reduce((inside, ring) => ringContainsPoint(ring, point) ? !inside : inside, false);
}

function axisInterval([origin, delta]: Point, [min, max]: Point): [number, number] {
  if (delta === 0) return origin < min || origin > max ? [Infinity, -Infinity] : [0, 1];
  const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
  return [Math.min(t1, t2), Math.max(t1, t2)];
}

function touchesBox(a: Point, b: Point, box: Bounds) {
  // Clip a boundary segment against both axes of the label rectangle.
  const x = axisInterval([a[0], b[0] - a[0]], [box.left, box.right]);
  const y = axisInterval([a[1], b[1] - a[1]], [box.top, box.bottom]);
  return Math.max(0, x[0], y[0]) <= Math.min(1, x[1], y[1]);
}

export function createLabelLandTest(coastline: string, lakes: string) {
  const land = ringsFromPath(coastline), water = ringsFromPath(lakes);
  const boundaries = [...land, ...water];
  return (box: Bounds) => {
    if (!containsPoint(land, [box.left, box.top]) || containsPoint(water, [box.left, box.top])) return false;
    // A land corner plus no boundary inside/crossing the rectangle proves
    // the entire label is on land. Checking corners alone misses bays or
    // small lakes enclosed by the text, so inspect every intersecting edge.
    return !boundaries.some(ring => overlaps(ring.bounds, box) && ring.points.some((point, i) =>
      touchesBox(point, ring.points[(i + 1) % ring.points.length]!, box)));
  };
}
