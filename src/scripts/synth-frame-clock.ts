const FRAME_INTERVAL = 1000 / 60;

export function createFrameClock() {
  let nextFrameAt = 0;
  return (now: number) => {
    // Tolerate timestamp rounding on 60 Hz screens without drawing every
    // refresh on 120/144 Hz displays. Keep the cadence anchored to real time.
    if (now + .25 < nextFrameAt) return false;
    const elapsed = Math.max(0, now - nextFrameAt);
    nextFrameAt += (Math.floor(elapsed / FRAME_INTERVAL) + 1) * FRAME_INTERVAL;
    return true;
  };
}
