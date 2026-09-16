import playbackIds from './mux-videos.json';

// Public playback IDs only. Upload credentials and original media stay outside the site.
const videos: Record<string, string> = playbackIds;

export function muxPlaybackId(videoId: string) {
  return videos[videoId];
}

export function hasMuxVideos(videoIds: string[]) {
  return videoIds.length > 0 && videoIds.every(videoId => Boolean(muxPlaybackId(videoId)));
}
