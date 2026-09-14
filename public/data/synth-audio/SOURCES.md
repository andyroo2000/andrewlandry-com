# Synth and chill audio measurements

Derived on 2026-09-14 from Andrew Landry's 17 videos in the
[Basement tapes playlist](https://www.youtube.com/playlist?list=PLpJqhXBWT7F96to6OoJnsTrG6y6aJtxvi).
These are measurements of YouTube's audio transcodes, not the studio masters.
No playable audio is included in this directory.

Each track JSON contains its video ID, decoded duration, 20 Hz frame rate, and
base64-encoded unsigned bytes. Every frame has four channels, in this order:
overall RMS level, bass (30–180 Hz), midrange (180–2,500 Hz), and treble
(2,500–12,000 Hz). Frames are centered on timestamps starting at zero.

The analysis decodes stereo at 24 kHz and measures a 2,048-sample Hann window.
Stereo power is averaged without summing the waveforms, preserving out-of-phase
synth sounds. Each band uses its track's 98th-percentile amplitude as a reference,
a soft amplitude curve, a silence gate, and a short symmetric smoothing kernel.
The browser interpolates these measurements at YouTube's current playback time.
Its short attack/release smoothing preserves the flowing design.

Regenerate with `dev/synth_audio_analysis.py` using `--playlist`, `--media-dir`,
and `--output-dir`. The script requires NumPy and FFmpeg. The playlist JSON and
downloaded audio belong outside the repository. `manifest.json` records coverage.
