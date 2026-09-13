# Recorded Japan cycling routes

Exported by the owner through Strava's **Actions → Export GPX** on September 12,
2026. Source athlete: https://www.strava.com/athletes/2187923. Each record's `id`
identifies its source at `https://www.strava.com/activities/{id}`. Access to those
activities may require following the owner; no activity visibility was changed.

- 2025: all 21 cycling recordings, June 30–July 14; **668.07 miles** total.
- 2026: all 13 cycling recordings, June 30–July 11; **501.09 miles** total.
- Multiple rides on one Japanese calendar date are summed. For example,
  July 4, 2026 includes the 25.04-mile main ride and 8.64-mile dinner ride.
- Distances are the totals displayed by Strava, retained to two decimal places;
  they are not recalculated from simplified geometry or the planned itinerary.
- Coordinates come from GPX track points, simplified with Douglas–Peucker at
  10 metres in a local equirectangular plane centred at 44° N. Coordinates
  retain six decimals. GPX segments/activities remain separate. A discontinuity
  greater than 1 km is split rather than connected (none in this export).
- Exact GPS sample timestamps and private health/sensor data are excluded.
  The original exports and their distance manifest remain in the local
  `Movies/Japan Bike Trips/strava-gpx` directory, outside the repository.
- Scene pins use GPS from matching originals exported from the owner's Photos
  library. A pin is never snapped to a road or moved to a town centre. Items
  without GPS inherit the preceding verified location in film order, as
  requested by the owner. Nearby place names describe the area around that pin.
- Route progress uses the original capture timestamp to interpolate between
  GPX samples. Only the resulting segment/fraction is retained in the public
  item data. A montage can revisit older photos; completed road stays filled
  during forward playback, and seeking backward restores the earlier state.
- Dates use the original media timestamp in Asia/Tokyo. Generated Strava recap
  cards use their stated ride date. A recap does not set the date of following
  photos: for example, the Sounkyo photo after the 2026 Day 12 card was captured
  on July 10 (Day 11), while the following Kamikawa photos were captured July 11.
- The 2025 repost about another runner uses its Instagram sharing date
  (July 5 in Japan). It does not supply a camera location for this trip.
- All 250 story dates are resolved. Of these, 248 match files in Photos
  (139 in 2025; 109 in 2026). The two exceptions are the generated 2026 Day 1
  recap and the 2025 repost described above. Original GPS is available for
  220 items; the other 30 inherit the preceding location.
- Original matching uses visual features, audio correlation for trimmed clips,
  and manual checks of ambiguous crops. Private source filenames, matching
  evidence, metadata, and raw GPX sample times remain outside the repository in
  `Movies/Japan Bike Trips/work/photos-matching`. Full-size export copies are
  temporary; original media remain in Photos.

The coastline is an independent OpenStreetMap dataset under ODbL, with its own
attribution and downloadable data in `public/data/`. GPX geometry is not derived
from OpenStreetMap. No route-finding service or invented road connection is used.
