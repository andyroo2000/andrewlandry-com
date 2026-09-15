export type AudioFeatures = { level: number; bass: number; mid: number; high: number; deepBass?: number };
export type AudioTrack = { videoId: string; duration: number; fps: number; frames: Uint8Array; deepBass?: Uint8Array };
export const quietFeatures = (): AudioFeatures => ({ level: 0, bass: 0, mid: 0, high: 0, deepBass: 0 });
type EncodedTrack = { version: number; videoId: string; duration: number; fps: number; data: string; deepBass?: string };
const validDuration = (seconds: number) => Number.isFinite(seconds) && seconds > 0;

function validateTrackHeader(data: EncodedTrack, expectedId: string) {
  if (data.version !== 1 || data.videoId !== expectedId) throw new Error('Audio analysis identity mismatch');
  if (!validDuration(data.duration)) throw new Error('Invalid audio duration');
  if (data.fps !== 20) throw new Error('Unsupported audio sample rate');
}

export function decodeAudioTrack(data: EncodedTrack, expectedId: string): AudioTrack {
  validateTrackHeader(data, expectedId);
  const frames = Uint8Array.from(atob(data.data), character => character.charCodeAt(0));
  const expectedFrames = Math.ceil(data.duration * data.fps) + 1;
  if (Math.abs(frames.length / 4 - expectedFrames) > 1 || frames.length % 4 !== 0) throw new Error('Incomplete audio analysis');
  const deepBass = data.deepBass === undefined ? undefined : Uint8Array.from(atob(data.deepBass), character => character.charCodeAt(0));
  if (deepBass && deepBass.length !== frames.length / 4) throw new Error('Incomplete deep bass analysis');
  return { videoId: data.videoId, duration: data.duration, fps: data.fps, frames, deepBass };
}

export function sampleAudioTrack(track: AudioTrack, seconds: number): AudioFeatures {
  if (!Number.isFinite(seconds)) return quietFeatures();
  if (seconds < 0 || seconds > track.duration) return quietFeatures();
  const position = seconds * track.fps;
  const first = Math.min(Math.floor(position), track.frames.length / 4 - 1);
  const next = Math.min(first + 1, track.frames.length / 4 - 1);
  const blend = position - Math.floor(position);
  const channel = (index: number) => (track.frames[first * 4 + index]! * (1 - blend) + track.frames[next * 4 + index]! * blend) / 255;
  const deepBass = track.deepBass ? (track.deepBass[first] * (1 - blend) + track.deepBass[next] * blend) / 255 : 0;
  return { level: channel(0), bass: channel(1), mid: channel(2), high: channel(3), deepBass };
}

export function createAudioTrackStore() {
  const tracks = new Map<string, AudioTrack | undefined>();
  const pending = new Map<string, Promise<void>>();
  function request(videoId: string) {
    if (!/^[\w-]{11}$/.test(videoId)) return;
    if (tracks.has(videoId) || pending.has(videoId)) return;
    const task = fetch(`/data/synth-audio/${videoId}.json`, { signal: AbortSignal.timeout(10000) })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Audio analysis unavailable')))
      .then(data => { tracks.set(videoId, decodeAudioTrack(data, videoId)); })
      .catch(() => { tracks.set(videoId, undefined); })
      .finally(() => { pending.delete(videoId); });
    pending.set(videoId, task);
  }
  return { request, get: (videoId: string) => tracks.get(videoId) };
}
