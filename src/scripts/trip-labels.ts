import type { MapPlace } from '../data/hokkaido-places';
import type { TripYear } from '../data/japan-trips';
import { layoutTripLabels, type LabelPlacement } from './trip-label-layout';
import { createLabelLandTest } from './trip-label-land';

type View = { width: number; height: number; x: number; y: number; scale: number; zoom: number };
const svgNamespace = 'http://www.w3.org/2000/svg';

export function createTripLabels(root: HTMLElement) {
  const layer = root.querySelector<SVGGElement>('[data-map-labels]')!;
  const mask = root.querySelector<SVGMaskElement>('[data-label-mask]')!;
  const maskBackground = mask.querySelector<SVGRectElement>('[data-label-mask-background]')!;
  const maskedUi = mask.querySelector<SVGGElement>('[data-label-blockers]')!;
  const data = JSON.parse(layer.dataset.places!) as (MapPlace & { point: [number, number] })[];
  const isLand = createLabelLandTest(root.querySelector('#hokkaido-land')!.getAttribute('d')!,
    root.querySelector('[data-lakes]')!.getAttribute('d')!);
  const elements = [...layer.querySelectorAll<SVGGElement>('[data-map-label]')];
  const labels = data.map((place, i) => ({
    ...place, element: elements[i]!, text: elements[i]!.querySelector<SVGTextElement>('text')!,
    textWidth: place.japanese.length * 17.5, fontSize: place.kind === 'mountain' ? 14 : 16,
  }));
  let year: TripYear = '2026';
  let current = '';
  let layoutKey = '';
  let placements: (LabelPlacement | undefined)[] = [];

  function measure(reflow = false) {
    // Foreground UI simply covers map labels, just like it covers the map.
    // It does not cause other towns to disappear or jump to another position.
    const origin = root.getBoundingClientRect();
    for (const element of [mask, maskBackground]) {
      element.setAttribute('width', String(origin.width));
      element.setAttribute('height', String(origin.height));
    }
    const blockers = [...root.querySelectorAll<HTMLElement>('.film, h1, .home, .trip-switcher, [data-place], .map-credit')]
      .filter(element => !element.hidden).map(element => {
        const bounds = element.getBoundingClientRect();
        const rect = document.createElementNS(svgNamespace, 'rect');
        rect.setAttribute('x', String(bounds.left - origin.left - 18));
        rect.setAttribute('y', String(bounds.top - origin.top - 18));
        rect.setAttribute('width', String(bounds.width + 36));
        rect.setAttribute('height', String(bounds.height + 36));
        return rect;
      });
    maskedUi.replaceChildren(...blockers);
    if (reflow) {
      labels.forEach(label => {
        label.element.removeAttribute('data-active');
        label.textWidth = label.text.getComputedTextLength() || label.japanese.length * (label.fontSize + 1.5);
      });
      layoutKey = '';
    }
  }

  return {
    measure,
    select(nextYear: TripYear, place: string) { year = nextYear; current = place.replace(/^Near /, ''); },
    draw(view: View) {
      const nextKey = `${year}:${view.scale}:${view.zoom}`;
      if (layoutKey !== nextKey) {
        placements = layoutTripLabels(labels, { year, scale: view.scale, zoom: view.zoom, isLand });
        layoutKey = nextKey;
        labels.forEach((label, i) => {
          const placement = placements[i];
          label.element.setAttribute('opacity', String(placement?.opacity ?? 0));
          if (placement) {
            label.text.setAttribute('x', String(placement.dx));
            label.text.setAttribute('y', String(placement.dy));
          }
        });
      }
      labels.forEach(label => {
        const x = view.width * .79 + (label.point[0] - view.x) * view.scale;
        const y = view.height * .53 + (label.point[1] - view.y) * view.scale;
        label.element.dataset.active = String(label.name === current);
        label.element.setAttribute('transform', `translate(${x},${y})`);
      });
    },
  };
}
