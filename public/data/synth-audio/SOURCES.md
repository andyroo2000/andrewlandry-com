# Synth and chill audio measurements

Derived on 2026-09-14 from Andrew Landry's 17 videos in the
[Basement tapes playlist](https://www.youtube.com/playlist?list=PLpJqhXBWT7F96to6OoJnsTrG6y6aJtxvi).
These are measurements of YouTube's audio transcodes, not the studio masters.
No playable audio is included in this directory.

Each track JSON contains its video ID, decoded duration, 20 Hz frame rate, and
base64-encoded unsigned bytes. Every frame has four channels, in this order:
overall RMS level, bass (30–180 Hz), midrange (180–2,500 Hz), and treble
(2,500–12,000 Hz). Frames are centered on timestamps starting at zero.
The separate `deepBass` byte array measures 30–90 Hz on the same timestamps
and drives terrain blur. Its reference is the larger of the bass amplitude
reference and one quarter of the overall amplitude reference, so faint leakage
from higher notes is not amplified into a deep-bass hit. The browser ignores
values below 35% and eases the remaining response from zero to peak blur of
2 pixels at the top and 8 pixels at the bottom. A base blur on the terrain and
a masked foreground blur combine to produce those endpoints. Both disappear
between bass hits. The same response drives a short, irregular camera shake,
up to 10 pixels horizontally and 14 pixels vertically at the nearest ground.
Perspective reduces the movement toward the horizon; the video and controls
stay stationary. It uses the existing animation clock and stops with the
background animation, including the reduced-motion default. Rain uses the
same deep-bass response only for its floor and collected shapes, on a separate
128-pixel-high canvas with up to 3 pixels of blur and 35% of Terrain's rumble.
Falling rain stays sharp
and steady, even immediately above the floor.
Rain detects new attacks in the bass, midrange, and treble measurements.
Soft hits scatter four to six tiny colored shapes. Medium hits (energy at
least 0.5) produce two shapes at twice that size; big hits (at least 0.8)
produce one shape at four times that size. Size ratios describe width and
height, and counts stay deterministic when seeking or replaying.
Bass shapes are larger and treble shapes rotate faster. Every size and band
gets a 0.32-second entrance that starts before its sound, finishing on the
beat as it eases into the same gentle falling speed. Upcoming audio events
are read ahead, and all shapes in a burst share the same arrival time.
All enter above the viewport at random horizontal
positions and fall straight down, overlapping on one floor level without
stacking or snapping into rows. Every 30 seconds the floor opens in the middle;
the shapes slide inward and fall out before the floor closes. Rain spans the
full viewport and passes behind the video and text as a background layer.
Arrivals are never delayed for clearing: rain over the hole falls through,
and rain landing on the remaining floor collects for the next cycle.
Events and rain plans are cached and reconstructed from the playback clock,
so pause and seeking preserve the cycle. Up to 52 seconds of events are kept
to include both the settled shapes and slow incoming rain (at most 1,024
events). A quiet shape preview runs before playback. The palette is lemon,
coral, lilac, mint, and warm white.
An occasional musical hit becomes a neon-outline astronaut, Saturn, pizza
slice, hot dog, hamburger, plane, satellite, or UFO.
The first cameo can appear after eight seconds; later cameos are at least
32–50 seconds apart, waiting for the next eligible hit. Their vector paths
are cached and rendered with three narrow strokes, without extra blur filters.

The analysis decodes stereo at 24 kHz and measures a 2,048-sample Hann window.
Stereo power is averaged without summing the waveforms, preserving out-of-phase
synth sounds. Each band uses its track's 98th-percentile amplitude as a reference,
a soft amplitude curve, a silence gate, and a short symmetric smoothing kernel.
The browser interpolates these measurements at YouTube's current playback time.
Its short attack/release smoothing preserves the flowing design.

Terrain uses rises in each frequency band to locate notes, then uses their
overall volume and band energy to size the landforms. Bass makes broad, low
hills; midrange makes rounded valleys; treble makes taller, narrower peaks.
Louder notes grow taller and wider, while softer notes leave smaller marks.
All retain the fast anticipatory rise and rounded decay. The geometry is
calculated once per track and stays fixed as it travels toward the viewer.

Regenerate with `dev/synth_audio_analysis.py` using `--playlist`, `--media-dir`,
and `--output-dir`. The script requires NumPy and FFmpeg. The playlist JSON and
downloaded audio belong outside the repository. `manifest.json` records coverage.
