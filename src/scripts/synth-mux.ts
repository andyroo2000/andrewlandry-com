import type MuxPlayerElement from '@mux/mux-player';
import tracks from '../data/synth-tracks.json';
import { muxPlaybackId } from '../data/mux-videos';
import { requestedSynthTrack } from './synth-track-links';
import { prepareMuxPlayers } from './mux-player';
import { type PlayerEvents, type SynthPlayer } from './synth-playback';

export function createMuxPlaylist(media: MuxPlayerElement, events: PlayerEvents, signal: AbortSignal, initialIndex: number) {
  let index = initialIndex >= 0 && initialIndex < tracks.length ? initialIndex : 0;
  let state = -1;
  let generation = 0;
  let playOnLoad = false;
  const options = { signal };
  function updateState(value: number) {
    state = value;
    events.onStateChange({ data: value });
  }
  function play() {
    const current = generation;
    void media.play().catch(error => {
      if (signal.aborted || current !== generation) return;
      if (error.name === 'AbortError') return;
      updateState(2);
      if (error.name === 'NotAllowedError') events.onAutoplayBlocked();
      else events.onError();
    });
  }
  function select(next: number, autoplay: boolean) {
    if (next < 0 || next >= tracks.length) return;
    generation++;
    media.pause();
    index = next;
    playOnLoad = autoplay;
    const track = tracks[index]!;
    media.metadata = { video_id: track.videoId, video_title: track.title };
    media.setAttribute('aria-label', track.title);
    media.playbackId = muxPlaybackId(track.videoId);
    updateState(autoplay ? 3 : 2);
  }
  const player: SynthPlayer = {
    playVideo: play,
    pauseVideo: () => { playOnLoad = false; media.pause(); updateState(2); },
    unMute: () => { media.muted = false; },
    isMuted: () => media.muted,
    getVolume: () => media.volume * 100,
    setVolume: volume => { media.volume = Math.max(0, Math.min(100, volume)) / 100; },
    nextVideo: () => select(index + 1, true),
    previousVideo: () => select(index - 1, true),
    getPlayerState: () => state,
    getCurrentTime: () => media.currentTime,
    getPlaybackRate: () => media.playbackRate,
    getVideoId: () => tracks[index]!.videoId,
    getPlaylist: () => tracks.map(track => track.videoId),
    getPlaylistIndex: () => index,
    destroy: () => { generation++; media.pause(); media.playbackId = undefined; },
  };
  media.addEventListener('loadedmetadata', () => {
    if (!playOnLoad) return;
    playOnLoad = false;
    play();
  }, options);
  media.addEventListener('playing', () => updateState(1), options);
  media.addEventListener('waiting', () => { if (!media.paused) updateState(3); }, options);
  media.addEventListener('pause', () => updateState(2), options);
  media.addEventListener('error', () => { updateState(2); events.onError(); }, options);
  media.addEventListener('ended', () => {
    updateState(0);
    if (index < tracks.length - 1) select(index + 1, true);
  }, options);
  select(index, false);
  events.onReady({ target: player });
  return player;
}

export async function connectMuxSynth(media: MuxPlayerElement, events: PlayerEvents, signal: AbortSignal) {
  const requested = requestedSynthTrack(location.href);
  const index = requested ? tracks.findIndex(track => track.videoId === requested) : 0;
  await prepareMuxPlayers();
  if (!signal.aborted) return createMuxPlaylist(media, events, signal, index);
}
