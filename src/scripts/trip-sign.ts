import type { TripDay } from '../data/japan-trip-days';
import type { JourneyStop } from '../data/japan-transfers';

const dateTitles = {
  capture: 'Original capture date in Japan',
  recap: 'Ride date stated on the summary card',
  story: 'Date this story was shared in Japan',
  estimated: 'Estimated date · original capture timestamp not yet matched',
};
const locationTitles: Record<JourneyStop['locationBasis'], string> = {
  throwback: 'Earlier photo · keeping the journey at its furthest reached point',
  'station-arrival': 'Asahikawa Station · confirmed train arrival',
  route: 'Position on the journey matched to the original media',
  previous: 'Location carried forward from the preceding story',
};

export function createTripSign(root: HTMLElement) {
  const label = root.querySelector<HTMLElement>('[data-place]')!;
  const placeName = label.querySelector<HTMLElement>('[data-place-name]')!;
  const dayName = label.querySelector<HTMLElement>('[data-trip-day]')!;
  const distance = label.querySelector<HTMLElement>('[data-trip-distance]')!;
  const distances = JSON.parse(root.querySelector<HTMLElement>('[data-map]')!.dataset.distances!) as Record<string, number>;
  const date = label.querySelector<HTMLTimeElement>('[data-trip-date]')!;
  const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function showDistance(miles: number | undefined) {
    distance.textContent = miles === undefined ? '' : `${miles.toFixed(1)} mi`;
    distance.hidden = miles === undefined;
    distance.title = miles === undefined ? '' : `Recorded daily total · ${(miles * 1.609344).toFixed(1)} km`;
  }

  return {
    hide() { label.hidden = true; },
    showPlace(stop: JourneyStop) {
      placeName.textContent = stop.place;
      placeName.title = locationTitles[stop.locationBasis];
      label.hidden = false;
    },
    showDay(tripDay: TripDay) {
      // Days can change while a film is still at the same location.
      date.title = dateTitles[tripDay.dateBasis ?? 'estimated'];
      if (date.dateTime === tripDay.date) return false;
      date.dateTime = tripDay.date;
      date.textContent = dateFormat.format(new Date(`${tripDay.date}T00:00:00Z`));
      dayName.textContent = tripDay.day ? `Day ${tripDay.day}` : '';
      dayName.hidden = !tripDay.day;
      showDistance(distances[tripDay.date]);
      return true;
    },
  };
}
