import type { AudioTimeline } from './synth-audio';
import type { AudioFeatures } from './synth-audio-data';

export const TERRAIN_HORIZON = .05;
export const TERRAIN_SETTLE_SECONDS = .3;
const unit = (value: number) => Math.max(0, Math.min(1, value));
const energy = (level: number, bass: number, high: number) => level * .55 + bass * .3 + high * .15;

export function terrainDepth(slider: number) { return unit(slider) ** 3; }

export function terrainBirthScale(age: number) {
  // Age starts at the overshoot crest, exactly when the sound hits.
  const progress = unit(age / TERRAIN_SETTLE_SECONDS);
  return 1 + .06 * (1 - progress * progress * (3 - 2 * progress));
}

export function terrainForegroundWeight(screenPosition: number) {
  // Keep the upper quarter still and sharp, then build toward the viewer.
  return unit((screenPosition - .25) / .75) ** 2;
}

export function terrainBassResponse(level: number) {
  // Blur and camera shake share the same gate for strong, deep bass.
  const strength = unit((level - .35) / .65);
  return strength * strength * (3 - 2 * strength);
}

export function terrainShake(time: number, deepBass: number) {
  const strength = terrainBassResponse(deepBass);
  const phase = time * Math.PI * 2;
  // Quick, uneven vibrations rather than a slow sway. These are maximum
  // CSS-pixel offsets; each visualizer controls where the vibration appears.
  return {
    x: strength * 10 * (Math.sin(phase * 11) * .7 + Math.sin(phase * 17) * .3),
    y: strength * 14 * (Math.sin(phase * 13) * .7 + Math.sin(phase * 19) * .3),
  };
}

function passageRange({ track, seconds }: AudioTimeline) {
  const first = Math.max(0, Math.floor((seconds - 2) * track.fps));
  const last = Math.min(track.frames.length / 4 - 1, Math.ceil((seconds + 2) * track.fps));
  let low = 1;
  let high = 0;
  for (let frame = first; frame <= last; frame++) {
    const offset = frame * 4;
    const value = energy(track.frames[offset], track.frames[offset + 1], track.frames[offset + 3]) / 255;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return { low, high };
}

export function terrainResponse(audio: AudioFeatures, timeline?: AudioTimeline) {
  const presence = unit(audio.level) ** .7;
  if (!timeline) return presence;
  const { low, high } = passageRange(timeline);
  // Local contrast makes quiet phrases responsive without keeping every
  // line near maximum weight. A minimum range avoids amplifying tiny noise.
  const contrast = unit((energy(audio.level, audio.bass, audio.high) - low) / Math.max(.12, high - low));
  return presence * .15 + contrast * .85;
}
