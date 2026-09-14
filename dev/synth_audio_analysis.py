"""Build compact, timestamped music features from downloaded playlist audio.

Requires NumPy and FFmpeg. Originals stay outside the website; only four
normalized measurements per frame are written to the public output directory.
"""

import argparse
import base64
import json
import subprocess
from pathlib import Path

import numpy as np

SAMPLE_RATE = 24000
FPS = 20
WINDOW_SIZE = 2048
HOP = SAMPLE_RATE // FPS
BANDS = ((30, 180), (180, 2500), (2500, 12000))


def decode_audio(path):
    result = subprocess.run([
        "ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "2",
        "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1",
    ], check=True, capture_output=True)
    return np.frombuffer(result.stdout, dtype="<f4").reshape(-1, 2)


def measure_frames(audio):
    """Center every FFT on its timestamp; keep stereo power to avoid cancellation."""
    count = int(np.ceil(len(audio) / HOP)) + 1
    padded = np.pad(audio, ((WINDOW_SIZE // 2, WINDOW_SIZE + HOP), (0, 0)))
    window = np.hanning(WINDOW_SIZE).astype(np.float32)
    window_energy = np.sum(window ** 2)
    frequencies = np.fft.rfftfreq(WINDOW_SIZE, 1 / SAMPLE_RATE)
    masks = [(frequencies >= low) & (frequencies < high) for low, high in BANDS]
    output = np.zeros((count, 4), dtype=np.float32)
    offsets = np.arange(WINDOW_SIZE)
    for start in range(0, count, 256):
        stop = min(start + 256, count)
        positions = np.arange(start, stop)[:, None] * HOP + offsets
        frames = padded[positions] * window[None, :, None]
        output[start:stop, 0] = np.sqrt(np.sum(frames ** 2, axis=(1, 2)) / (2 * window_energy))
        power = np.mean(np.abs(np.fft.rfft(frames, axis=1)) ** 2, axis=2)
        for band, mask in enumerate(masks, 1):
            output[start:stop, band] = np.sqrt(2 * np.sum(power[:, mask], axis=1) / (WINDOW_SIZE * window_energy))
    return output


def normalize_features(features):
    """Preserve dynamics with a soft amplitude curve, including true silence."""
    reference = np.maximum(np.percentile(features, 98, axis=0), 0.0001)
    normalized = np.clip(features / reference, 0, 1) ** 0.7
    normalized[features < 0.00003] = 0
    padded = np.pad(normalized, ((1, 1), (0, 0)), mode="edge")
    smooth = padded[:-2] * 0.2 + padded[1:-1] * 0.6 + padded[2:] * 0.2
    return np.round(smooth * 255).astype(np.uint8)


def analyze_track(entry, media_dir, output_dir):
    video_id = entry["id"]
    candidates = [path for path in media_dir.glob(f"{video_id}.*") if path.suffix in {".webm", ".m4a", ".opus", ".mp3", ".wav"}]
    if not candidates:
        raise FileNotFoundError(f"Missing audio for {video_id}")
    audio = decode_audio(candidates[0])
    features = normalize_features(measure_frames(audio))
    duration = len(audio) / SAMPLE_RATE
    metadata = {"videoId": video_id, "title": entry["title"], "duration": round(duration, 3)}
    data = {"version": 1, **metadata, "fps": FPS, "channels": ["level", "bass", "mid", "high"],
            "data": base64.b64encode(features.tobytes()).decode("ascii")}
    (output_dir / f"{video_id}.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"Analyzed {video_id}: {duration:.1f}s, {len(features)} frames", flush=True)
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--playlist", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    playlist = json.loads(args.playlist.read_text())
    args.output_dir.mkdir(parents=True, exist_ok=True)
    tracks = [analyze_track(entry, args.media_dir, args.output_dir) for entry in playlist["entries"]]
    manifest = {"version": 1, "playlistId": playlist["id"], "fps": FPS, "tracks": tracks}
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
