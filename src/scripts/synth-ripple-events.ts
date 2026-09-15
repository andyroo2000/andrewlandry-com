import type { AudioTrack } from './synth-audio-data';
import { seed, type VisualSettings } from './synth-visual-types';

export type RainObject = 'plane' | 'satellite' | 'ufo' | 'astronaut' | 'saturn' | 'pizza' | 'hotdog' | 'hamburger' | 'godzilla' | 'banana';
export const RAIN_ENTRY_SECONDS = .32;
// Event timestamps mark the sound; the rain launches one entrance earlier.
export type RippleEvent = { id: number; born: number; band: number; energy: number; object?: RainObject };
const SKY_OBJECTS: RainObject[] = ['godzilla', 'banana', 'astronaut', 'saturn', 'pizza', 'hotdog', 'hamburger', 'plane', 'satellite', 'ufo'];
// Retain a full accumulation cycle plus the slowest incoming flight.
export const RIPPLE_HISTORY = 52;
const MAX_VISIBLE_EVENTS = 1024;
type BandSource = { track: AudioTrack; band: number; salt: number };

function songSeed(id: string) {
  let value = 0;
  for (const character of id) value = (value * 31 + character.charCodeAt(0)) | 0;
  return value;
}

function bandRise({ track, band }: BandSource, frame: number) {
  const offset = frame * 4 + band + 1;
  return Math.max(0, (track.frames[offset] ?? 0) - (track.frames[offset - 4] ?? 0)) / 255;
}

function hitEnergy({ track, band }: BandSource, frame: number) {
  let energy = 0;
  for (let next = frame; next <= frame + 2; next++) {
    const offset = next * 4;
    energy = Math.max(energy, Math.sqrt((track.frames[offset] ?? 0) * (track.frames[offset + band + 1] ?? 0)) / 255);
  }
  return energy;
}

function isBandPeak(source: BandSource, frame: number) {
  const attack = bandRise(source, frame);
  if (attack < .035) return false;
  return attack >= bandRise(source, frame - 1) && attack > bandRise(source, frame + 1);
}

function bandEvents(source: BandSource) {
  const { track, band, salt } = source;
  const hits: (RippleEvent & { attack: number })[] = [];
  for (let frame = 0; frame < track.frames.length / 4; frame++) {
    if (!isBandPeak(source, frame)) continue;
    const attack = bandRise(source, frame);
    const energy = hitEnergy(source, frame);
    if (energy < .06) continue;
    const hit = { id: salt + frame * 3 + band, born: Math.max(0, frame / track.fps - .025), band, energy, attack };
    const previous = hits.at(-1);
    // Merge the rising samples of one note; sustained tones don't keep firing.
    if (!previous || hit.born - previous.born > .18) hits.push(hit);
    else if (attack > previous.attack) hits[hits.length - 1] = hit;
  }
  return hits;
}

function addSkyObjects(events: RippleEvent[]): RippleEvent[] {
  let nextAt = 8;
  let count = 0;
  return events.map(event => {
    if (event.born < nextAt || event.energy < .5) return event;
    nextAt = event.born + 32 + seed(event.id + 431) * 18;
    return { ...event, object: SKY_OBJECTS[count++ % SKY_OBJECTS.length] };
  });
}

export function buildRippleEvents(track: AudioTrack): RippleEvent[] {
  const salt = songSeed(track.videoId);
  const events = [0, 1, 2].flatMap(band => bandEvents({ track, band, salt })).sort((a, b) => a.born - b.born);
  return addSkyObjects(events);
}

function afterTime(events: RippleEvent[], seconds: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (events[middle].born <= seconds) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function activeRippleEvents(events: RippleEvent[], seconds: number) {
  // Include upcoming sounds so their entrances can play before the beat.
  const end = afterTime(events, seconds + RAIN_ENTRY_SECONDS);
  const start = Math.max(afterTime(events, seconds - RIPPLE_HISTORY), end - MAX_VISIBLE_EVENTS);
  return events.slice(start, end);
}

function previewEvents(seconds: number): RippleEvent[] {
  const first = Math.max(0, Math.floor((seconds - RIPPLE_HISTORY) / .65));
  const last = Math.floor((seconds + RAIN_ENTRY_SECONDS) / .65);
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const id = index + first;
    const object = id % 70 === 16 ? SKY_OBJECTS[Math.floor(id / 70) % SKY_OBJECTS.length] : undefined;
    return { id, born: id * .65, band: id % 3, energy: .15 + seed(id + 83) * .8, object };
  });
}

export function createRippleEventReader() {
  let previous: AudioTrack | undefined;
  let events: RippleEvent[] = [];
  return (settings: VisualSettings) => {
    const track = settings.timeline?.track;
    if (track !== previous) { previous = track; events = track ? buildRippleEvents(track) : []; }
    const time = settings.timeline?.seconds ?? 0;
    if (time > 0 && track) return { time, events: activeRippleEvents(events, time) };
    // An inviting silent preview before playback, including reduced motion.
    return { time: settings.time, events: previewEvents(settings.time) };
  };
}
