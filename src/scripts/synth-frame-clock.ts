const FRAME_INTERVAL = 1000 / 60;
const TIMING_TOLERANCE = 2;

export function createFrameClock() {
  let nextFrameAt: number | undefined;
  return (now: number) => {
    // Anchor to the display's first callback, not the page clock's zero point.
    // A little scheduling jitter must not discard an otherwise usable frame.
    if (nextFrameAt === undefined) { nextFrameAt = now + FRAME_INTERVAL; return true; }
    if (now + TIMING_TOLERANCE < nextFrameAt) return false;
    const elapsed = Math.max(0, now - nextFrameAt);
    nextFrameAt += (Math.floor(elapsed / FRAME_INTERVAL) + 1) * FRAME_INTERVAL;
    return true;
  };
}
