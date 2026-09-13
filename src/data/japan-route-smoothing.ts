type Point = [number, number];
type Node = { point: Point; fraction: number; anchor?: boolean };
type SourceSamples = { nodes: Node[]; distances: number[] };

// Projected map units: about one screen pixel of simplification at the usual
// desktop scale. Round only the immediate corner, not whole road sections.
const tolerance = .6;
const cornerRadius = 1.2;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const interpolate = (a: Node, b: Node, t: number): Node => ({
  point: [mix(a.point[0], b.point[0], t), mix(a.point[1], b.point[1], t)],
  fraction: mix(a.fraction, b.fraction, t),
});
const length = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

function furthestFromSegment(nodes: Node[], [first, last]: [number, number]) {
  const a = nodes[first]!.point, b = nodes[last]!.point;
  let maximum = tolerance, furthest = -1;
  for (let i = first + 1; i < last; i++) {
    const distance = distanceToSegment(nodes[i]!.point, a, b);
    if (distance > maximum) { maximum = distance; furthest = i; }
  }
  return furthest;
}

function simplify(nodes: Node[]) {
  const keep = nodes.map(node => !!node.anchor);
  keep[0] = true;
  keep[nodes.length - 1] = true;
  const anchors = keep.flatMap((value, i) => value ? [i] : []);
  const stack: [number, number][] = anchors.slice(1).map((index, i) => [anchors[i]!, index]);
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const furthest = furthestFromSegment(nodes, [first, last]);
    if (furthest !== -1) {
      keep[furthest] = true;
      stack.push([first, furthest], [furthest, last]);
    }
  }
  return nodes.filter((_, i) => keep[i]);
}

function sourceInterval(distances: number[], at: number) {
  let i = 1;
  while (i < distances.length - 1 && distances[i]! < at) i++;
  return i;
}

function sourceNode({ nodes, distances }: SourceSamples, fraction: number): Node {
  const at = fraction * distances.at(-1)!;
  const i = sourceInterval(distances, at);
  const t = (at - distances[i - 1]!) / (distances[i]! - distances[i - 1]! || 1);
  return { ...interpolate(nodes[i - 1]!, nodes[i]!, t), fraction, anchor: true };
}

function addStoryAnchors(source: SourceSamples, fractions: number[]) {
  for (const fraction of new Set(fractions)) {
    if (fraction <= 0 || fraction >= 1) continue;
    source.nodes.push(sourceNode(source, fraction));
  }
}

function distinctNodes(nodes: Node[]) {
  nodes.sort((a, b) => a.fraction - b.fraction);
  const distinct: Node[] = [];
  for (const node of nodes) {
    const previous = distinct.at(-1);
    if (previous && previous.fraction === node.fraction) previous.anchor ||= node.anchor;
    else distinct.push({ ...node });
  }
  return distinct;
}

function roundedCorner(a: Node, p: Node, b: Node): Node[] {
  const incoming = length(a.point, p.point), outgoing = length(p.point, b.point);
  const trim = Math.min(cornerRadius, incoming / 4, outgoing / 4);
  if (!trim) return [p];
  const entry = interpolate(p, a, trim / incoming), exit = interpolate(p, b, trim / outgoing);
  const rounded = [entry];
  // A short quadratic fillet, sampled densely enough that the trail and
  // marker can share the same polyline without visible faceting or overshoot.
  const steps = Math.max(2, Math.ceil(trim * 2 / .25));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    rounded.push(interpolate(interpolate(entry, p, t), interpolate(p, exit, t), t));
  }
  return rounded;
}

// Build-time presentation geometry only. Keep the source distance parameter
// through simplification and rounding so stories do not move along the ride
// when the displayed path becomes shorter. Recordings are processed separately.
export function smoothRide(points: Point[], distances: number[], storyFractions: number[] = []) {
  const total = distances.at(-1) ?? 0;
  const divisor = total || 1;
  if (!total || points.length < 3) return { points: points.map(point => [...point] as Point),
    sourceFractions: distances.map(distance => distance / divisor) };
  const nodes: Node[] = points.map((point, i) => ({ point, fraction: distances[i]! / total }));
  addStoryAnchors({ nodes, distances }, storyFractions);
  const reduced = simplify(distinctNodes(nodes));
  const rounded: Node[] = [reduced[0]!];
  for (let i = 1; i < reduced.length - 1; i++) {
    rounded.push(...roundedCorner(reduced[i - 1]!, reduced[i]!, reduced[i + 1]!));
  }
  rounded.push(reduced.at(-1)!);
  return { points: rounded.map(node => node.point), sourceFractions: rounded.map(node => node.fraction) };
}

export function distanceAtSourceFraction(sourceFractions: number[], distances: number[], fraction: number) {
  const at = Math.max(0, Math.min(1, fraction));
  const i = sourceInterval(sourceFractions, at);
  if (sourceFractions.length < 2) return 0;
  const span = sourceFractions[i]! - sourceFractions[i - 1]!;
  const t = span ? Math.max(0, Math.min(1, (at - sourceFractions[i - 1]!) / span)) : 0;
  return mix(distances[i - 1]!, distances[i]!, t);
}
