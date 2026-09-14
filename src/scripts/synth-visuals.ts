import { drawVisualizer } from './synth-renderers';
import type { VisualMode } from './synth-visual-types';
import { initVisualPicker } from './synth-visual-picker';
import { createAudioFollower, type PlaybackReader } from './synth-audio';
import { quietFeatures } from './synth-audio-data';

export function initSynthVisuals(readPlayback: PlaybackReader) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-synth-canvas]');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  const room = document.querySelector<HTMLElement>('[data-synth-room]')!;
  const motion = room.querySelector<HTMLButtonElement>('[data-motion]')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const size = { width: innerWidth, height: innerHeight };
  const settings = { mode: 'signal' as VisualMode, time: 12, depth: .55, dark: document.body.classList.contains('lights-down'), audio: quietFeatures() };
  const followAudio = createAudioFollower(readPlayback);
  let paused = reducedMotion.matches;
  let frame = 0;
  let lastTime = 0;
  let drawnAt = 0;

  function draw() { drawVisualizer(context!, size, settings); }
  function resize() {
    size.width = innerWidth;
    size.height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas!.width = Math.round(size.width * scale);
    canvas!.height = Math.round(size.height * scale);
    context!.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
  }
  function animate(now: number) {
    settings.time += Math.min((now - lastTime) / 1000, .05);
    settings.audio = followAudio(now);
    lastTime = now;
    // A quiet 30 fps field is ample for this slow movement.
    if (now - drawnAt > 32) { draw(); drawnAt = now; }
    frame = requestAnimationFrame(animate);
  }
  function updateMotion() {
    cancelAnimationFrame(frame);
    motion.setAttribute('aria-label', paused ? 'Resume background animation' : 'Pause background animation');
    room.querySelector('[data-pause-icon]')!.toggleAttribute('hidden', paused);
    room.querySelector('[data-play-icon]')!.toggleAttribute('hidden', !paused);
    if (paused || document.hidden) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(animate);
  }

  initVisualPicker(room, mode => { settings.mode = mode; draw(); }, abort.signal);
  room.querySelector<HTMLInputElement>('[data-depth]')!.addEventListener('input', event => {
    settings.depth = Number((event.target as HTMLInputElement).value) / 100;
    draw();
  }, options);
  room.querySelector<HTMLButtonElement>('[data-lights]')!.addEventListener('click', event => {
    settings.dark = !settings.dark;
    document.body.classList.toggle('lights-down', settings.dark);
    (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(settings.dark));
    draw();
  }, options);
  motion.addEventListener('click', () => { paused = !paused; updateMotion(); }, options);
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; updateMotion(); }, options);
  document.addEventListener('visibilitychange', updateMotion, options);
  window.addEventListener('resize', resize, options);
  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(frame);
    if (!event.persisted) abort.abort();
  }, options);
  window.addEventListener('pageshow', updateMotion, options);
  resize();
  updateMotion();
}
