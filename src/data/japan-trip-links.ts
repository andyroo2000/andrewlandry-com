import slugs from './japan-trip-slugs.json';
import { tripItems } from './japan-trip-items';
import type { TripYear } from './japan-trips';

const ROOT = '/japan-cycling-trips/';
const publishedSlugs: Record<string, string> = slugs;
export const tripYears: TripYear[] = ['2025', '2026'];

function segmentsFor(year: TripYear) {
  return tripItems[year].map((item, index) => ({
    year, index, id: item.id, slug: publishedSlugs[item.id]!,
    // Seek one frame into a cut so rounding never shows the previous story.
    seconds: index === 0 ? 0 : item.at + 1 / 30,
  }));
}

// Slugs are stored by original item ID, so metadata corrections and inserted
// stories cannot renumber links that people have already shared.
export const tripSegments = { '2025': segmentsFor('2025'), '2026': segmentsFor('2026') };

export function tripYearPath(year: TripYear) {
  return `${ROOT}${year}/`;
}

export function tripSegmentPath(year: TripYear, index: number) {
  return `${tripYearPath(year)}${tripSegments[year][index]!.slug}/`;
}

function legacyTime(url: URL) {
  const seconds = Number(url.searchParams.get('t'));
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export function requestedTrip(href: string) {
  const url = new URL(href);
  const path = url.pathname.replace(/\/$/, '');
  if (`${path}/` === ROOT) {
    const year: TripYear = url.searchParams.get('trip') === '2025' ? '2025' : '2026';
    return { year, seconds: legacyTime(url) };
  }
  for (const year of tripYears) {
    if (`${path}/` === tripYearPath(year)) return { year, seconds: legacyTime(url) };
    const segment = tripSegments[year].find(item => `${path}/` === tripSegmentPath(year, item.index));
    if (segment) return { year, seconds: segment.seconds };
  }
}

export function tripSegmentUrl(year: TripYear, index: number, href: string) {
  const url = new URL(href);
  url.pathname = tripSegmentPath(year, index);
  url.searchParams.delete('trip');
  url.searchParams.delete('t');
  return url;
}

export function createTripUrlSync() {
  let previousPath: string | undefined;
  return (year: TripYear, index: number) => {
    const path = tripSegmentPath(year, index);
    if (path === previousPath) return;
    previousPath = path;
    const url = tripSegmentUrl(year, index, window.location.href);
    if (url.href !== window.location.href) {
      // Playback should not fill the Back button with individual stories.
      window.history.replaceState(window.history.state, '', url);
    }
  };
}
