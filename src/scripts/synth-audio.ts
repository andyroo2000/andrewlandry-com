import { createAudioTrackStore, quietFeatures, sampleAudioTrack, type AudioFeatures } from './synth-audio-data';

export type PlaybackSnapshot = { videoId: string; seconds: number; playing: boolean; rate: number };
export type PlaybackReader = () => PlaybackSnapshot | undefined;

// Re-anchor on every new YouTube timestamp. Extrapolate only between updates,
// and cap the estimate so a stalled player cannot leave the real music behind.
export function createPlaybackClock() {
  let previous: PlaybackSnapshot | undefined;
  let anchoredAt = 0;
  return (snapshot: PlaybackSnapshot, now: number) => {
    const changed = !previous || Object.keys(snapshot).some(key => snapshot[key as keyof PlaybackSnapshot] !== previous![key as keyof PlaybackSnapshot]);
    if (changed) { previous = { ...snapshot }; anchoredAt = now; }
    if (!snapshot.playing) return snapshot.seconds;
    return snapshot.seconds + Math.min(Math.max(now - anchoredAt, 0) / 1000, .25) * snapshot.rate;
  };
}

export function easeAudioFeatures(current: AudioFeatures, target: AudioFeatures, elapsed: number): AudioFeatures {
  const eased = (key: keyof AudioFeatures) => {
    const response = target[key] > current[key] ? .035 : .12;
    const fraction = 1 - Math.exp(-Math.max(elapsed, 0) / response);
    return current[key] + (target[key] - current[key]) * fraction;
  };
  return { level: eased('level'), bass: eased('bass'), mid: eased('mid'), high: eased('high') };
}

export function createAudioFollower(readPlayback: PlaybackReader, tracks = createAudioTrackStore()) {
  const clock = createPlaybackClock();
  let current = quietFeatures();
  let previousId = '';
  let lastFrame = 0;
  return (now: number): AudioFeatures => {
    const elapsed = Math.min(Math.max((now - lastFrame) / 1000, 0), .1);
    lastFrame = now;
    const snapshot = readPlayback();
    if (!snapshot) return current = easeAudioFeatures(current, quietFeatures(), elapsed);
    if (snapshot.videoId !== previousId) { current = quietFeatures(); previousId = snapshot.videoId; }
    tracks.request(snapshot.videoId);
    const track = tracks.get(snapshot.videoId);
    const seconds = clock(snapshot, now);
    const target = track && snapshot.playing ? sampleAudioTrack(track, seconds) : quietFeatures();
    current = easeAudioFeatures(current, target, elapsed);
    return current;
  };
}
