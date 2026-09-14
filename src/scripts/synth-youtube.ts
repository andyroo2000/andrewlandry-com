import type { PlaybackSnapshot } from './synth-audio';

export interface SynthPlayer {
  playVideo(): void;
  pauseVideo(): void;
  unMute(): void;
  nextVideo(): void;
  previousVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getPlaybackRate(): number;
  getVideoUrl(): string;
  getPlaylist(): string[];
  getPlaylistIndex(): number;
  destroy(): void;
}

export function youtubeVideoId(url: string) {
  return /[?&]v=([\w-]{11})(?:[&#]|$)/.exec(url)?.[1];
}

export function readSynthPlayback(player: SynthPlayer | undefined): PlaybackSnapshot | undefined {
  if (!player) return;
  const videoId = youtubeVideoId(player.getVideoUrl());
  if (!videoId) return;
  return { videoId, seconds: player.getCurrentTime(), playing: player.getPlayerState() === 1, rate: player.getPlaybackRate() };
}

type PlayerEvents = {
  onReady(event: { target: SynthPlayer }): void;
  onStateChange(event: { data: number }): void;
  onError(): void;
  onAutoplayBlocked(): void;
};
type YouTubeApi = { Player: new (element: HTMLIFrameElement, options: { events: PlayerEvents }) => SynthPlayer };
type PlayerWindow = { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

function loadApi(): Promise<YouTubeApi> {
  const host = window as unknown as PlayerWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube API timed out')), 15000);
    const previous = host.onYouTubeIframeAPIReady;
    host.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      if (host.YT) resolve(host.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube API unavailable')); };
    document.head.append(script);
  });
}

export async function connectSynthPlayer(iframe: HTMLIFrameElement, events: PlayerEvents, signal: AbortSignal) {
  const url = new URL(iframe.src);
  url.searchParams.set('origin', location.origin);
  iframe.src = url.href;
  const api = await loadApi();
  if (signal.aborted) return;
  return new api.Player(iframe, { events });
}

export function createTrackTitleLoader() {
  const cache = new Map<string, Promise<string>>();
  return (videoUrl: string) => {
    if (!cache.has(videoUrl)) {
      const endpoint = new URL('https://www.youtube.com/oembed');
      endpoint.searchParams.set('url', videoUrl);
      endpoint.searchParams.set('format', 'json');
      const title = fetch(endpoint, { signal: AbortSignal.timeout(8000) })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Title unavailable')))
        .then(data => String(data.title || '').split(/\s[-–—]\s/)[0] || 'Untitled session');
      cache.set(videoUrl, title);
      // A transient network failure should not poison later visits to a track.
      void title.catch(() => cache.delete(videoUrl));
    }
    return cache.get(videoUrl)!;
  };
}
