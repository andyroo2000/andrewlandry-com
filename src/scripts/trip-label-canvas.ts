import type { MapPlace } from '../data/hokkaido-places';
import { mapRasterSettings, type MapView } from './trip-map-canvas';

type PaintedLabel = MapPlace & { point: [number, number]; element: SVGGElement; text: SVGTextElement; family: string; weight: string; size: number };

function symbol(context: CanvasRenderingContext2D, kind: MapPlace['kind'], [x, y]: [number, number]) {
  context.beginPath();
  if (kind === 'mountain') {
    context.moveTo(x - 5, y + 3); context.lineTo(x, y - 5); context.lineTo(x + 5, y + 3); context.closePath();
    context.lineWidth = 1.4;
    context.stroke();
  } else {
    context.arc(x, y, kind === 'city' ? 3.5 : 2.5, 0, Math.PI * 2);
    context.fill();
  }
}

function paintLabel(context: CanvasRenderingContext2D, label: PaintedLabel, view: MapView) {
  const opacity = Number(label.element.getAttribute('opacity'));
  if (!opacity) return;
  const x = view.width * .79 + (label.point[0] - view.x) * view.scale;
  const y = view.height * .53 + (label.point[1] - view.y) * view.scale;
  const active = label.element.dataset.active === 'true';
  const size = active ? 18 : label.size;
  context.globalAlpha = opacity;
  context.font = `${active ? '700' : label.weight} ${size}px ${label.family}`;
  context.letterSpacing = `${size * .07}px`;
  context.fillText(label.japanese, x + Number(label.text.getAttribute('x')), y + Number(label.text.getAttribute('y')));
  if (!active) symbol(context, label.kind, [x, y]);
}


// SVG remains the source of font measurement and the tested label layout.
// Paint those placements to a small number of canvas operations instead of
// re-rasterizing a viewport-sized SVG luminance mask during every pan.
export function createLabelCanvas(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-label-canvas]')!;
  const context = canvas.getContext('2d')!;
  const layer = root.querySelector<SVGGElement>('[data-map-labels]')!;
  const blockers = root.querySelector<SVGGElement>('[data-label-blockers]')!;
  const places = JSON.parse(layer.dataset.places!) as (MapPlace & { point: [number, number] })[];
  const elements = [...layer.querySelectorAll<SVGGElement>('[data-map-label]')];
  const labels = places.map((place, i) => {
    const element = elements[i]!;
    const text = element.querySelector<SVGTextElement>('text')!;
    const style = getComputedStyle(text);
    return { ...place, element, text, family: style.fontFamily, weight: style.fontWeight, size: parseFloat(style.fontSize) };
  });
  const color = getComputedStyle(layer).getPropertyValue('--map-ink').trim();

  return {
    draw(view: MapView) {
      const { density } = mapRasterSettings(view, window.devicePixelRatio);
      const width = Math.round(view.width * density), height = Math.round(view.height * density);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(density, 0, 0, density, 0, 0);
      context.clearRect(0, 0, view.width, view.height);
      context.fillStyle = color;
      context.strokeStyle = color;
      for (const label of labels) paintLabel(context, label, view);
      for (const rect of blockers.children) {
        context.clearRect(Number(rect.getAttribute('x')), Number(rect.getAttribute('y')),
          Number(rect.getAttribute('width')), Number(rect.getAttribute('height')));
      }
    },
    destroy() { canvas.width = 0; },
  };
}
