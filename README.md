# andrewlandry.com

Andrew Landry's personal website, built with Astro and TypeScript.

The homepage at `/` uses the Blue Frequency design: cobalt and lemon colors,
oversized typography, featured Japan Cycling Trips and Synth & Chill links beneath
the name, and a tilted card linking to GitHub, LinkedIn, and Instagram.
`/japan-cycling-trips/` extends that design with portrait films and
a full-screen Hokkaido map that follows playback on desktop. Mobile shows the video.

## Development

Use Node.js 24 (`nvm use`) and npm. Commit `package-lock.json` with dependency changes.

```sh
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm test` | Run trip route, navigation, map-label, and synth audio regression tests |
| `npm run check` | Check Astro and TypeScript files |
| `npm run build` | Generate the static site in `dist/` |
| `npm run preview` | Preview the production build locally |

## Architecture

- Astro generates static pages; TypeScript uses strict checking.
- Page content and custom CSS live in `src/pages/`.
- Diagonal link arrows use the shared SVG `ArrowUpRight.astro` component so iOS cannot render them as emoji.
- Space Grotesk is loaded from Google Fonts with a system sans-serif fallback.
- No CMS, database, or server-side application is needed.
- Cloudflare Workers Static Assets serves the generated `dist/` directory.

## Japan cycling trips

The cycling page uses YouTube's player clock to select individual story items
from `src/data/japan-trip-items.json`. Matched originals supply capture timestamps
and GPS. The source metadata stays intact; the presentation maps each item to
its corresponding point on the ordered journey. Items without a location and
throwbacks retain the preceding position and place. Andrew requested that the
2026 bike-on-train clip and Day 1 Strava card both represent Asahikawa Station:
the train arrives during the clip and the card holds at that same endpoint.
This presentation override preserves the clip's original capture metadata.
Forward story playback
never retreats along the journey, while intentional backward navigation does.
Route geometry comes from 34 exported Strava GPX recordings (21 in 2025;
13 in 2026), including island loops and short transfer/dinner rides.
Per-item route progress is calculated privately from capture time and GPX sample
timestamps, then projected against the simplified route at build time.
Each GPX recording remains a separate cycling segment. Transport follows
mapped geography, and small visible connections join recording boundaries and
station/port entrances without contributing to cycling mileage.
`src/scripts/trip-camera.ts` pans between places at a fixed scale. The scale
only changes to fit the viewport. `src/scripts/trip-route.ts` draws each completed
leg over the dashed route, including train, ferry, bus, and flight legs. The current marker and camera share a distance cursor
along that route, including every bend during a long seek. An interrupted
animation retargets from its current cursor. Seeking backward restores the
earlier progress; switching trips clears it. Panning and pulsing
respect reduced motion. The map is hidden on mobile. Previous/next buttons flank the desktop
location card; Left/Right keys move to the previous/next story while preserving
play/pause state. The index in `src/data/japan-trip-items.json` contains all
140/110 item cuts, measured against the encoded video start timestamp. It uses
YouTube's seek API directly and does not require chapter markers or new uploads.
Native player controls retain keyboard focus and their usual arrow-key seeking.
Story shortcuts work when focus is on the page or the previous/next buttons;
YouTube iframe key events do not bubble to the page. Space toggles YouTube
playback when the page itself is focused.
Both local previews and YouTube start playing muted on load, including links
to a specific story time. Native player controls enable sound or pause playback.
If the browser blocks autoplay, those controls remain available for manual play.
Switching trips preserves the current playback and sound settings.

Every Strava ride segment uses a pulsing blue dot, including paused story
positions on the ride. Transport legs use a train, ferry, plane, or bus. The 2025
train follows OpenStreetMap railway geometry from Sapporo to Fukagawa. Four
ferry crossings use the mapped Wakkanai–Oshidomari and Oshidomari–Kafuka routes.
The return through Rishiri includes both recorded evening/morning rides even
though those rides have no story items. The 2026 flight is an illustrative
great-circle arc from Haneda to New Chitose, not a recorded flight track. The
airport bus follows an illustrative standard downtown corridor on OSM roads,
via the Do-o Expressway, Kitahiroshima exit, and Route 36 to Susukino. Its exact
service and stops are not known. The itinerary's outbound and return trains
follow the Sapporo–Asahikawa railway. The bike-on-train clip completes the train
journey to Asahikawa Station; the following Day 1 card has exactly the same
location, with no new map movement or trail progress. The next clip,
captioned “The first 35 miles of this were cycle road,” advances from the station
along the mapped street approach and then the recorded bike route to Tohma.

All journey paths remain visible as dotted guides, blue on land and yellow on
water. An SVG land mask subtracts lakes to choose the contrasting colour.
Cycling paths are gently simplified and their immediate corners rounded by
`src/data/japan-route-smoothing.ts`. The dotted guide, completed trail, and dot
share that smoothed geometry. Original GPX data and Strava mileage are unchanged.
Story positions retain their source-distance mapping through smoothing, with
matched media points protected during simplification. Each recording's endpoints
stay fixed so train/ferry connections and small separate rides remain intact.
The completed trail also uses a rounded stroke and a soft outline.
Transport icons return to the normal pulsing dot at story stops; cycling
always uses that dot. The icon follows the active route leg,
so the airport bus ends in Sapporo and Asahikawa–Tohma uses the cycling dot. Both adjacent
navigation and distant seeks travel through the intervening route, finishing
within 3.5 seconds. Initial loads and reduced motion settle immediately.
Transport and connecting paths never contribute to cycling mileage.
`src/data/japan-transfers.ts` assembles this ordered journey at build time;
`src/scripts/trip-transfer.ts` samples it for animation. Regression checks for
continuity, throwbacks, all ride geometry, transport order, and route sampling
run with `npm test` (also required in CI and before deployment).

The map draws 26 OpenStreetMap lake, lagoon, reservoir, and pond outlines,
including their island holes. Lake-symbol labels and the accumulated circles
for previous media stops are removed; the current dot still pulses. Data and
license notes are linked from the map's attribution via
`public/data/japan-map-SOURCES.txt`.

Japanese labels in `src/data/hokkaido-places.ts` add major cities, the selected
trip's stops, and a few mountain reference points. `trip-label-layout.ts` selects
and places names in projected map space once per trip and viewport scale,
reserving room for the active highlight. Panning and active-stop changes only
translate and highlight these labels; they cannot change their visibility or
offsets. `trip-label-land.ts` checks the full padded text rectangle against the
rendered coast and lake outlines, including enclosed water and shoreline
intersections. Names move inland or are omitted when there is no clear space;
sea/ocean names and coloured text outlines are removed.
The SVG viewport and foreground UI mask naturally cover labels that
move offscreen or underneath the video/title/card. The current marker renders
above the labels. Reference labels identify town centres; scene positions use
the journey locations matched to original media.
`public/data/japan-map-places.json` adds OpenStreetMap town names and coordinates
for the smaller places identified while matching original media; its adjacent
license file records the source and transformations.
Names follow [Hokkaido's tourism listings](https://www.visit-hokkaido.jp/) and
the [Environment Ministry's Hokkaido park guides](https://hokkaido.env.go.jp/park.html).

`src/data/japan-trip-days.ts` supplies the date and, when applicable, riding day
beside the current location. Day numbering follows the itineraries on
[bike.andrewlandry.com](https://bike.andrewlandry.com/) and the story day cards.
The 2025 island stay shows dates without numbered tour days. Daily distances
sum all Strava rides on that date in Japan, including short rides. Displayed
miles use Strava’s recorded totals, rounded to one decimal; hovering shows km.
They are whole-day totals, not distances accumulated so far in the film. Calendar cues are separate from locations,
so the date can advance while the film remains in the same place. The 2026 first
riding day is June 30, even though those stories were posted July 1.

Verified `capturedAt` values in the item index take priority over the fallback
calendar. Convert original capture timestamps to Asia/Tokyo dates before looking
up the tour day. Generated Strava summary cards use the ride day explicitly
stated on the card, since a screenshot's creation time is not the ride's capture
time. Each following photo or clip gets its own date independently. All 250
items have resolved dates: 248 match files in Photos (139 in 2025, 109 in 2026).
The generated 2026 Day 1 summary uses its stated ride date; the 2025 repost
about another runner uses its Instagram sharing date. The repost retains the preceding location; the Day 1 card uses the confirmed
Asahikawa Station arrival, as described above. Across both films, 220 items supply original GPS and the other 30
have no original GPS. Those inherit the previous journey location except for
the Day 1 station-arrival card. No current item uses the estimated-date fallback.
Original media remain in Photos. Full-size export copies are temporary; metadata,
matching evidence, and processing tools stay outside the repository in
`Movies/Japan Bike Trips/work/photos-matching`.


`public/data/hokkaido-coastline.json` contains an OpenStreetMap coastline crop
from [OSM Data](https://osmdata.openstreetmap.de/data/land-polygons.html).
It is separate from the Strava recordings and available under ODbL; see
`public/data/hokkaido-coastline-LICENSE.txt` for provenance and transformations.
The map includes visible attribution and a download link.
`src/components/TripMap.astro` projects the geography to SVG at build time; no map
tiles, API key, or client-side mapping library is needed.

The two `src/data/japan-rides-*.json` files contain only activity IDs, titles,
Japanese calendar dates, Strava distances and coordinates simplified to a
10-metre tolerance. Private GPX originals, timestamps, heart rate and cadence
remain outside the repository. Source/export notes are in
`src/data/japan-routes-SOURCES.md`.

For local review with the finished MP4s, start the development server with:

```sh
JAPAN_TRIP_MEDIA_DIR="/path/to/Japan Bike Trips" npm run dev -- --background
```

That directory should contain `Hokkaido Bike Trip 2025.mp4` and
`Hokkaido Bike Trip 2026.mp4`. The development middleware streams those files
with seeking support, without copying them into the repository or production
build. Without this environment variable, development also uses YouTube.
The local files have corrected audio: separately concatenated AAC segments
introduced cumulative encoder padding. Audio is now assembled at exact sample
boundaries and encoded once; video packets and item cut timestamps are unchanged.
Continuous decoding confirmed silence in all 182 still photos. Previous exports
are preserved outside the repository. Corrected replacement uploads were saved
on September 12, 2026, and are fully processed in SD and HD:
[2025](https://youtu.be/3M3GsNgvnpw) and [2026](https://youtu.be/K6CPy63peaE).
The previous uploads remain intact. `src/data/japan-trips.ts` selects the new IDs.

Production always uses YouTube. Both corrected videos are unlisted: playable
on the website and through direct links, without appearing on the channel page.

Use `?trip=2025` or `?trip=2026` to select a trip and `&t=600` to preview a point
in the film. Manage the background server with `npm run astro -- dev status`,
`npm run astro -- dev logs`, and `npm run astro -- dev stop`.

## Synth and chill

`/synth-and-chill/` embeds Andrew's synthesizer playlist with an explicit
Start listening button, current track title, and previous/next track controls.
It uses the dark palette and starts with Terrain; Change visualization switches
between Terrain and Rain. The transport includes volume, with Space to play/pause
and left/right arrow keys to change tracks when a focused control does not own them.
Reduced-motion preferences pause the background initially, and hidden tabs
stop drawing.

Each current playlist track has a stable URL such as
`/synth-and-chill/hes-a-bad-guy/`. Opening or refreshing it selects that video
without autoplay and retains YouTube's current playlist order. The address bar
updates using `replaceState` as tracks change, so Back still leaves the listening
session rather than walking through every song.

`src/data/synth-tracks.json` maps permanent slugs to video IDs and display titles.
Keep existing slugs unchanged when renaming or reordering videos. Add a record
and redeploy to give a new video its pretty URL; until then, newly added playlist
videos use a functional `/synth-and-chill/?track=VIDEO_ID` link. Slug changes do
not require regenerating audio analysis, which remains keyed by video ID.

The visualizers follow YouTube's playback clock using precomputed volume and
bass/midrange/treble measurements for all 17 playlist videos. Seeking, pausing,
changing speed, and changing tracks update the response. A missing analysis
file leaves ambient motion instead of using another track's measurements.
Only compact numerical measurements are served from `public/data/synth-audio/`;
the browser plays audio through YouTube, and downloaded media remain outside
the repository. See that directory's `SOURCES.md` for provenance and regeneration.
The optional analysis script requires Python, NumPy, and FFmpeg. Its signal
alignment tests can be run with `python -m unittest discover -s dev -p 'test_synth_audio_analysis.py'`.

## Deployment

The **Deploy** workflow checks, builds, and publishes pushes to `main` to
<https://andrewlandry.com/>. Both the main domain and
<https://www.andrewlandry.com/> serve the site. The workflow verifies that the
homepage, cycling page, and synth page at both addresses match the generated build. Manual runs are available from GitHub
Actions on `main`; deployment runs are serialized.

GitHub stores `CLOUDFLARE_API_TOKEN` as an Actions secret and
`CLOUDFLARE_ACCOUNT_ID` as an Actions variable. The deployment token needs
`Account / Workers Scripts / Edit` for the hosting account. No credentials are
stored in this repository. Wrangler is pinned in `package-lock.json`.

For a local deployment, authenticate with `npx wrangler login`, then run
`npm run check`, `npm run build`, and `npm run deploy`. Validate packaging without
publishing with `npx wrangler deploy --dry-run` after building.

Both custom domains are declared in `wrangler.jsonc`; Cloudflare manages their
DNS records and HTTPS certificates. The `workers.dev` address remains available
at <https://andrewlandry-com.andrewlandry.workers.dev/>.

## GitHub checks and reviews

- **CI** runs `npm ci`, `npm test`, `npm run check`, and `npm run build` on pushes to `main`
  and on pull requests.
- **Claude Code Review** automatically reviews non-draft pull requests from this
  repository when opened, updated, reopened, or marked ready for review. It posts
  findings as a PR comment. Manual workflow runs review the latest commit and
  report in the Actions log, which also provides a way to verify authentication.
- **Claude PR Follow-up** responds to `@claude` in PR conversation comments from
  the owner, members, and collaborators. Claude is configured for review only.
- **CodeScene** uses its native GitHub pull-request integration. It is configured
  in CodeScene's project settings and reports independently of GitHub Actions.
  The old `empear-analytics/codescene-ci-cd` Actions bridge is deprecated.

Claude uses the installed Claude GitHub App and the repository Actions secret
`CLAUDE_CODE_OAUTH_TOKEN`. The secret must be renewed if it expires. Automatic
Claude reviews intentionally exclude fork PRs because they cannot receive this
secret; a maintainer can request a review through a trusted PR comment.

CodeScene setup requires granting the CodeScene Access GitHub App access to this
repository, creating a CodeScene project for it, running an initial analysis,
and enabling automated PR reviews in that project's settings. Its analysis
coverage depends on supported file types; a successful integration is not a
promise that `.astro` markup is scored.

GitHub Actions are pinned to commit hashes. Update those pins when upgrading an
Action. Never commit credentials, `.env` files, or private media originals.

## Project layout

- `src/pages/`: Astro page routes
- `public/`: assets copied directly to the output
- `.github/workflows/`: CI and Claude review automation
- `AGENTS.md` and `CLAUDE.md`: development and review guidance
