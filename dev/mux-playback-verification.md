# Mux playback verification — 2026-09-16

Both video collections remain on Mux, now capped at 1080p after the follow-up
tests below. The initial optimization baseline used 720p. The Kamikawa video stream
itself contains clean 30 fps footage. The recurring playback drops coincided
with map rendering; changing video providers did not remove the problem.

## Final implementation

- Cache the projected coastline, lakes, route guides, and land masks in local
  canvas tiles instead of repainting complex SVG geometry during every pan.
- Prepare the next story's visible tiles one at a time during idle periods,
  after the current map animation has finished. Cancel stale preparation on
  resize, trip changes, or disposal.
- Draw route progress with one land-mask composition. It uses the same journey
  distance and endpoint as the camera and preserves backward seeking.
- Keep the existing measured label layout, but draw labels on a canvas and
  clear the foreground UI rectangles rather than applying an animated SVG mask.
- Give the pulsing marker its own 80×80 SVG. Animate the map at 30 fps.
- Bound tile storage to 128 MiB and each viewport canvas to six million pixels.
  Geography uses up to 1.5x density; text uses up to 2x. The map stays hidden on
  mobile and still respects reduced motion.

## Initial 720p verification

Codex in-app Chromium browser, 1357×985 CSS-pixel viewport, device pixel ratio 2,
Mux adaptive playback at 720×1280. The map remained visible and animated.

| Sample | Media interval | Frames | Dropped | Measured fps |
| --- | --- | ---: | ---: | ---: |
| 2026: Kamikawa and subsequent transitions | 119.27–179.27 s | 1,799 | **0** | 29.98 |
| 2025: Wakkanai–Rishiri ferry and following stories | 380.32–410.42 s | 903 | **0** | 30.00 |

A temporary same-origin diagnostic page sampled the native video element's
`getVideoPlaybackQuality()` and `requestVideoFrameCallback()` counters. The
baseline began after the initial seek had settled. Both runs had zero missed
presentation callbacks as well as zero dropped video frames. Frame rate is
computed over the sampled media interval; the source is nominally 30 fps.
The temporary diagnostic page was removed before handoff and was excluded from
the production build. These are measured local results, not a guarantee for
every device or system load.

Earlier partial versions could produce a clean short run but still drop frames
on repeats and other transitions. The final implementation includes the label,
marker, cadence, and idle preparation changes rather than relying on those
initial short runs.

## Validation

- `npm run check`: zero errors, warnings, or hints.
- `npm test`: 97 passing tests, including route endpoint/rewind behavior,
  raster memory budgets, and cancellation of idle preparation.
- `npm run build`: passes; the existing Mux bundle-size advisory remains.
- Browser: paused story seeking, switching trips while paused, and resizing
  between desktop and a 390px phone layout work.
- CodeScene MCP: all scored files changed by this rendering work are 10/10,
  with no findings. `dev/japan-map-canvas.test.mjs` returned no score and no
  findings; MCP installation diagnostics passed all five checks. Astro files
  are unsupported by CodeScene and were covered by Astro check and build.

## 1080p follow-up

At Andrew's request, both player pages now allow up to 1080p. Automatic quality
selection remains enabled in the site; only the temporary test harness forced
the 1080p rendition. The harness checked the actual decoded dimensions on
every sample, so an adaptive fallback could not be mistaken for a 1080p pass.
Viewport and browser matched the 720p tests above.

| Sample | Media interval | Decoded size | Frames | Dropped | Measured fps |
| --- | --- | --- | ---: | ---: | ---: |
| 2026, first pass after five seconds of prior playback | 119.29–179.40 s | 1080×1920 | 1,801 | 10 | 29.80 |
| 2026, repeat from the original baseline starting point | 119.26–179.26 s | 1080×1920 | 1,798 | **0** | 29.97 |
| 2025 ferry | 380.27–410.37 s | 1080×1920 | 903 | **0** | 30.00 |
| Basement track, Terrain visualizer active | 0.27–30.37 s | 1920×1080 | 903 | **0** | 30.00 |

All samples stayed at their listed 1080p dimensions. The initial pass shows that
zero drops are not guaranteed on every run, but the subsequent cycling and
synth samples demonstrate nominal 30 fps playback at full HD. Keep 1080p as the
available maximum and retain adaptive playback for connections/devices that
need a lower rendition.

Astro check and build passed after the cap change. CodeScene MCP again confirmed
that the two modified `.astro` player pages are unsupported, so these changes
were verified by the framework checks and actual browser playback. No further
map or player implementation changes were needed for the 1080p follow-up.

## PR verification

The final change also includes static year and story URLs for all 250 cycling
segments, the simplified player controls, and the blue/yellow center play button.
All 106 tests pass, and Astro check/build pass. CodeScene MCP reports 10/10 with
no findings for all 18 changed JavaScript/TypeScript files, including the raster
budget test after its assertions were extracted into a named helper. Astro files
remain covered by framework checks and code review rather than CodeScene.
