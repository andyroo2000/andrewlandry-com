// Spread tile preparation across idle periods while the current story plays,
// instead of rasterizing a whole new row when the camera starts moving.
export function scheduleMapWarmup(tasks: (() => void)[]) {
  let cancelled = false;
  let cancelPending = () => {};
  let index = 0;
  function schedule() {
    if (cancelled || index >= tasks.length) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(step);
      cancelPending = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(step, 32);
      cancelPending = () => window.clearTimeout(id);
    }
  }
  function step() {
    if (cancelled) return;
    tasks[index++]!();
    schedule();
  }
  schedule();
  return () => { cancelled = true; cancelPending(); };
}
