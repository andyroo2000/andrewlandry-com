import type { TripYear } from './japan-trips';
import { capturedDateAtTime, itemAtTime, tripItems } from './japan-trip-items';

export type TripDay = { at: number; date: string; day?: number; dateBasis?: 'capture' | 'recap' | 'story' | 'estimated' };

// Fallback dates/day numbers follow bike.andrewlandry.com's itineraries and the films'
// day cards. Boundaries follow the four-second-photo edits. In particular,
// 2026 Day 1 was June 30, although those stories were posted on July 1.
// The 2025 itinerary does not number the July 4–6 island stay as riding days.
export const tripDays: Record<TripYear, TripDay[]> = {
  '2025': [
    { at: 0, date: '2025-06-29' },
    { at: 4, date: '2025-06-30', day: 1 },
    { at: 71.8, date: '2025-07-01', day: 2 },
    { at: 141.167, date: '2025-07-02', day: 3 },
    { at: 217.2, date: '2025-07-03', day: 4 },
    { at: 309.233, date: '2025-07-04' },
    { at: 473.3, date: '2025-07-05' },
    { at: 564.333, date: '2025-07-06' },
    { at: 648.367, date: '2025-07-07', day: 5 },
    { at: 729.967, date: '2025-07-08', day: 6 },
    { at: 939.567, date: '2025-07-09', day: 7 },
    { at: 1072.867, date: '2025-07-10', day: 8 },
    { at: 1262.967, date: '2025-07-11', day: 9 },
    { at: 1424.9, date: '2025-07-12', day: 10 },
    { at: 1468.4, date: '2025-07-13', day: 11 },
    { at: 1590.7, date: '2025-07-14', day: 12 },
  ],
  '2026': [
    { at: 0, date: '2026-06-29' },
    { at: 22.3, date: '2026-06-30', day: 1 },
    { at: 164.5, date: '2026-07-01', day: 2 },
    { at: 279.533, date: '2026-07-02', day: 3 },
    { at: 356.867, date: '2026-07-03', day: 4 },
    { at: 610.067, date: '2026-07-04', day: 5 },
    { at: 813.567, date: '2026-07-05', day: 6 },
    { at: 920.3, date: '2026-07-06', day: 7 },
    { at: 952.3, date: '2026-07-07', day: 8 },
    { at: 1024.333, date: '2026-07-08', day: 9 },
    { at: 1059.333, date: '2026-07-09', day: 10 },
    { at: 1079.333, date: '2026-07-10', day: 11 },
    { at: 1148.967, date: '2026-07-11', day: 12 },
  ],
};

function datedDay(year: TripYear, seconds: number, date: string, dateBasis: TripDay['dateBasis']): TripDay {
  return { at: seconds, date, day: tripDays[year].find(day => day.date === date)?.day, dateBasis };
}

function estimatedDay(days: TripDay[], seconds: number): TripDay {
  let index = 0;
  while (index + 1 < days.length && days[index + 1]!.at <= seconds) index++;
  return { ...days[index]!, dateBasis: 'estimated' };
}

export function tripDayAtTime(year: TripYear, seconds: number): TripDay {
  // A generated Strava card describes its stated ride day. Its screenshot or
  // posting time is not the capture time of the ride's photos and videos.
  const item = tripItems[year][itemAtTime(year, seconds)];
  if (item?.recapDate) return datedDay(year, seconds, item.recapDate, 'recap');
  const capturedDate = capturedDateAtTime(year, seconds);
  if (capturedDate) return datedDay(year, seconds, capturedDate, 'capture');
  // A repost of somebody else's story has no original capture of this trip.
  if (item?.storyDate) return datedDay(year, seconds, item.storyDate, 'story');
  return estimatedDay(tripDays[year], seconds);
}
