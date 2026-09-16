import playbackIds from './mux-videos.json';

// Public playback IDs only. Upload credentials and original media stay outside the site.
const videos: Record<string, string> = playbackIds;

export function muxPlaybackId(videoId: string) {
  const playbackId = videos[videoId];
  if (!playbackId) throw new Error(`Missing Mux playback ID for ${videoId}`);
  return playbackId;
}
