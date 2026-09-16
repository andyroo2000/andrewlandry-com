# Rain frame timing — September 16, 2026

Measured the local page in the Codex in-app browser with Mux playing, a
1357 × 985 CSS-pixel viewport, and the unchanged 2× Rain canvas buffer.
A temporary development probe measured 10-second windows of animation callbacks,
actual draws, callback gaps, and synchronous draw submission time. The probe was
removed before commit. These are machine/load-dependent samples, not a guarantee
of the frame rate on every device; draw submission does not measure GPU completion.

| Passage / version | Browser callbacks/s | Draws/s | Mean draw ms | P95 draw ms |
| --- | ---: | ---: | ---: | ---: |
| “he’s a bad guy,” busy middle, before | 59.5 | 55.0 | 1.41 | 2.6 |
| “he’s a bad guy,” busy middle, after | 58.8 | 58.8 | 1.13 | 2.0 |
| “WAVE,” around 40%, after | 60.0 | 60.0 | 0.97 | 1.3 |

The first sample exposed unnecessary skipped renders despite available browser
callbacks. The clock had been anchored to the page clock’s zero point with only
0.25 ms of tolerance. It now anchors to the first display callback and allows
2 ms of jitter while retaining its 60 fps cap on high-refresh displays.

The second opportunity was rebuilding hundreds of existing drop layouts whenever
a new hit entered the active window. Layouts now survive arrivals and expiration;
only new events need geometry. The cache retains only active history, resets on
track/size/depth changes, and reconstructs evicted drops when seeking backward.

The optimized “he’s a bad guy” window still contained 12 browser callback gaps
longer than 25 ms (maximum 34.2 ms), but no extra skips from the frame limiter.
The “WAVE” window contained none (maximum callback gap 18.7 ms). Other optimized
busy windows fluctuated around 57–59 fps with draws matching browser callbacks.

No particle counts, entrance timing, resolution, floor blur, or artwork were
reduced. Regression tests cover jittered 60 Hz timestamps, 30–240 Hz displays,
pause/resume, geometry reuse, eviction/rewind, resize, and track changes.
