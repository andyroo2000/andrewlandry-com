import tracks from '../data/synth-tracks.json';

const ROOT = '/synth-and-chill/';
const validVideoId = (value: string | null): value is string => value !== null && /^[\w-]{11}$/.test(value);

export function synthTrackPageTitle(title?: string) {
  return title ? `${title} — Synth & Chill — Andrew Landry` : 'Synth & Chill — Andrew Landry';
}

export function requestedSynthTrack(href: string) {
  const url = new URL(href);
  const track = tracks.find(item => url.pathname.replace(/\/$/, '') === `${ROOT}${item.slug}`);
  if (track) return track.videoId;
  const videoId = url.searchParams.get('track');
  return validVideoId(videoId) ? videoId : undefined;
}

export function synthTrackUrl(videoId: string, href: string) {
  if (!validVideoId(videoId)) return;
  const url = new URL(href);
  const track = tracks.find(item => item.videoId === videoId);
  url.pathname = track ? `${ROOT}${track.slug}/` : ROOT;
  url.searchParams.delete('track');
  // New playlist additions remain shareable before their pretty route is published.
  if (!track) url.searchParams.set('track', videoId);
  return url;
}

export function syncSynthTrackUrl(videoId: string) {
  const url = synthTrackUrl(videoId, window.location.href);
  if (url && url.href !== window.location.href) {
    // Keep Back useful: advancing through a playlist does not create new visits.
    window.history.replaceState(window.history.state, '', url);
  }
}
