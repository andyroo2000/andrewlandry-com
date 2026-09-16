import type { PlaybackSnapshot } from './synth-audio';

export interface SynthPlayer {
  playVideo(): void;
  pauseVideo(): void;
  unMute(): void;
  isMuted(): boolean;
  getVolume(): number;
  setVolume(volume: number): void;
  nextVideo(): void;
  previousVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getPlaybackRate(): number;
  getVideoId(): string;
  getPlaylist(): string[];
  getPlaylistIndex(): number;
  destroy(): void;
}

export function readSynthPlayback(player: SynthPlayer | undefined): PlaybackSnapshot | undefined {
  if (!player) return;
  const videoId = player.getVideoId();
  if (!videoId) return;
  return { videoId, seconds: player.getCurrentTime(), playing: player.getPlayerState() === 1, rate: player.getPlaybackRate() };
}

export type PlayerEvents = {
  onReady(event: { target: SynthPlayer }): void;
  onStateChange(event: { data: number }): void;
  onError(): void;
  onAutoplayBlocked(): void;
};
