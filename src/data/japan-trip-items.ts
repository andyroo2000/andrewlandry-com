import data from './japan-trip-items.json';
import type { TripYear } from './japan-trips';

export type TripItem = {
  id: string;
  at: number;
  kind: 'photo' | 'video';
  capturedAt?: string;
  coordinates?: [number, number];
  place?: string;
  recap?: boolean;
  recapDate?: string;
  storyDate?: string;
  routePosition?: { activity: string; segment: number; fraction: number };
};
export const tripItems = data as Record<TripYear, TripItem[]>;

// These cuts come from the original edit plus the encoded video's start PTS.
// They are independent of YouTube chapters and work for four-second photos.
export function itemAtTime(year: TripYear, seconds: number): number {
  const items = tripItems[year];
  let low = 0;
  let high = items.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle]!.at <= seconds) low = middle;
    else high = middle;
  }
  return low;
}

export function adjacentItem(year: TripYear, index: number, direction: -1 | 1): number {
  return Math.max(0, Math.min(tripItems[year].length - 1, index + direction));
}

const japanDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function capturedDateAtTime(year: TripYear, seconds: number): string | undefined {
  const capturedAt = tripItems[year][itemAtTime(year, seconds)]?.capturedAt;
  if (!capturedAt) return undefined;
  const parts = japanDate.formatToParts(new Date(capturedAt));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
