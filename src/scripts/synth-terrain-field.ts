import { quietFeatures, sampleAudioTrack, type AudioFeatures, type AudioTrack } from './synth-audio-data';
import { seed } from './synth-visual-types';

export const TERRAIN_COLUMNS = 65;
export const TERRAIN_HISTORY_SECONDS = 36;
export const TERRAIN_ROWS_PER_SECOND = 4;
export const MOUND_RADIUS_COLUMNS = 8;
export const MOUND_RADIUS_SECONDS = 2.25;
export const MOUND_ATTACK_SECONDS = .45;
export const MOUND_PEAK_LEAD_SECONDS = .05;
export type TerrainField = { heights: Float32Array; fps: number; duration: number };
type TerrainHit = { frame: number; strength: number };
type TerrainBand = { channel: 'bass' | 'mid' | 'high'; width: number; height: number; salt: number };
type TerrainMound = { radius: number; height: number; salt: number };
const TERRAIN_BANDS: TerrainBand[] = [
  { channel: 'bass', width: 1.5, height: 1.3, salt: 17 },
  { channel: 'mid', width: 1, height: -.95, salt: 113 },
  { channel: 'high', width: .65, height: 2.1, salt: 211 },
];

function terrainAttacks(current: AudioFeatures, previous: AudioFeatures) {
  // Use the rise only to locate a hit. Its loudness determines the landform
  // separately, so fast attacks no longer all saturate at the same height.
  const rise = (value: number, before: number) => Math.max(0, value - before);
  return {
    bass: rise(current.bass, previous.bass),
    mid: rise(current.mid, previous.mid),
    high: rise(current.high, previous.high),
  };
}

function measureAttacks(track: AudioTrack) {
  const bass = new Float32Array(track.frames.length / 4);
  const mid = new Float32Array(bass.length);
  const high = new Float32Array(bass.length);
  let previous = quietFeatures();
  for (let frame = 0; frame < bass.length; frame++) {
    const audio = sampleAudioTrack(track, frame / track.fps);
    const attack = terrainAttacks(audio, previous);
    bass[frame] = attack.bass;
    mid[frame] = attack.mid;
    high[frame] = attack.high;
    previous = audio;
  }
  return { bass, mid, high };
}

function isAttackPeak(strengths: Float32Array, frame: number) {
  const strength = strengths[frame];
  if (strength < .025) return false;
  return strength >= (strengths[frame - 1] ?? 0) && strength > (strengths[frame + 1] ?? 0);
}

function findHits(strengths: Float32Array, fps: number) {
  const hits: TerrainHit[] = [];
  for (let frame = 0; frame < strengths.length; frame++) {
    if (!isAttackPeak(strengths, frame)) continue;
    const hit = { frame, strength: strengths[frame] };
    const previous = hits.at(-1);
    // Treat the rising frames of one drum hit as one landform.
    if (!previous || frame - previous.frame > fps * .25) hits.push(hit);
    else if (hit.strength > previous.strength) hits[hits.length - 1] = hit;
  }
  return hits;
}

function moundShape(track: AudioTrack, hit: TerrainHit, band: TerrainBand): TerrainMound {
  let loudness = 0;
  // Read through the next 100 ms: the steepest rising frame often precedes
  // the note's full volume. This does not delay the visible peak.
  for (let frame = hit.frame; frame <= hit.frame + Math.ceil(track.fps * .1); frame++) {
    const audio = sampleAudioTrack(track, frame / track.fps);
    loudness = Math.max(loudness, audio.level ** 1.15 * audio[band.channel] ** .65);
  }
  return {
    radius: MOUND_RADIUS_COLUMNS * band.width * (.7 + loudness * .3),
    height: loudness * band.height,
    salt: band.salt,
  };
}

function stampMound(field: TerrainField, hit: TerrainHit, mound: TerrainMound) {
  // Leave the repeated field's borders flat even for the widest bass hills.
  const margin = Math.ceil(mound.radius) + 1;
  const center = Math.round(margin + seed(hit.frame + mound.salt) * (TERRAIN_COLUMNS - 1 - margin * 2));
  const attack = MOUND_ATTACK_SECONDS * field.fps;
  const release = MOUND_RADIUS_SECONDS * mound.radius / MOUND_RADIUS_COLUMNS * field.fps;
  const peak = hit.frame - MOUND_PEAK_LEAD_SECONDS * field.fps;
  const finalFrame = field.heights.length / TERRAIN_COLUMNS - 1;
  const first = Math.max(0, Math.floor(peak - attack));
  const last = Math.min(finalFrame, Math.ceil(peak + release));
  for (let frame = first; frame <= last; frame++) {
    const offset = frame - peak;
    const along = offset / (offset < 0 ? attack : release);
    for (let column = Math.floor(center - mound.radius); column <= Math.ceil(center + mound.radius); column++) {
      const across = (column - center) / mound.radius;
      // Rounded sides and a smooth summit, with a quick anticipatory rise
      // and a longer decay behind the hit instead of a two-second attack.
      const profile = Math.max(0, 1 - along * along - across * across) ** 3;
      field.heights[frame * TERRAIN_COLUMNS + column] += mound.height * profile;
    }
  }
}

export function buildTerrainField(track: AudioTrack): TerrainField {
  const heights = new Float32Array(track.frames.length / 4 * TERRAIN_COLUMNS);
  const field = { heights, fps: track.fps, duration: track.duration };
  const attacks = measureAttacks(track);
  for (const band of TERRAIN_BANDS) {
    findHits(attacks[band.channel], track.fps).forEach(hit => stampMound(field, hit, moundShape(track, hit, band)));
  }
  // Keep room for different-sized peaks; soften only the larger overlapping
  // sums instead of squeezing every strong note toward a low ceiling.
  heights.forEach((height, index) => { heights[index] = 3 * Math.tanh(height / 3); });
  return field;
}

export function sampleTerrainHeight(field: TerrainField | undefined, column: number, seconds: number) {
  if (!field || !Number.isFinite(seconds)) return 0;
  if (seconds < 0 || seconds > field.duration) return 0;
  const position = seconds * field.fps;
  const finalFrame = field.heights.length / TERRAIN_COLUMNS - 1;
  const first = Math.min(Math.floor(position), finalFrame);
  const next = Math.min(first + 1, finalFrame);
  const blend = position - Math.floor(position);
  return field.heights[first * TERRAIN_COLUMNS + column] * (1 - blend) + field.heights[next * TERRAIN_COLUMNS + column] * blend;
}

// Cache only the active song. Its immutable geometry includes the rounded
// shoulders around each hit, so rewinding recreates exactly the same ground.
export function createTerrainFieldCache() {
  let previous: AudioTrack | undefined;
  let field: TerrainField | undefined;
  return (track: AudioTrack | undefined) => {
    if (track !== previous) { previous = track; field = track ? buildTerrainField(track) : undefined; }
    return field;
  };
}

export function terrainRowTime(seconds: number, row: number) {
  const tick = Math.floor(seconds * TERRAIN_ROWS_PER_SECOND) - row;
  return tick / TERRAIN_ROWS_PER_SECOND;
}
