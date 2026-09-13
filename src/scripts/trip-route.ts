import type { TripYear } from '../data/japan-trips';

export function createTripRoute(map: HTMLElement) {
  const routes = new Map([...map.querySelectorAll<SVGGElement>('[data-route]')].map(group => [
    group.dataset.route as TripYear,
    [...group.querySelectorAll<SVGGElement>('[data-journey-segment]')].map(element => ({
      element, start: Number(element.dataset.start), end: Number(element.dataset.end),
    })),
  ]));
  const fraction = (position: number, start: number, end: number) => end > start ? Math.max(0, Math.min(1, (position - start) / (end - start))) : Number(position >= end);

  return {
    draw(year: TripYear, position: number) {
      routes.get(year)!.forEach(({ element, start, end }) => {
        const completed = fraction(position, start, end);
        element.setAttribute('stroke-dashoffset', String(1 - completed));
        element.style.visibility = completed > 0 ? 'visible' : 'hidden';
      });
    },
  };
}
