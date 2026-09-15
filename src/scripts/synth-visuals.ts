import { drawVisualizer } from './synth-renderers';
import { VISUAL_DEPTHS, DEFAULT_VISUAL_MODE, type VisualMode, type VisualSettings } from './synth-visual-types';
import { initVisualToggle } from './synth-visual-toggle';
import { createAudioFollower, type PlaybackReader } from './synth-audio';
import { quietFeatures } from './synth-audio-data';
import { createTerrainSoftness } from './synth-terrain-softness';
import { createRippleFloor } from './synth-ripple-floor';

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
  const settings: VisualSettings & { mode: VisualMode } = { mode: DEFAULT_VISUAL_MODE, time: 12, depth: VISUAL_DEPTHS[DEFAULT_VISUAL_MODE], dark: document.body.classList.contains('lights-down'), audio: quietFeatures() };
  const followAudio = createAudioFollower(readPlayback);
  const softenTerrain = createTerrainSoftness(document.querySelector<HTMLElement>('[data-terrain-softness]')!, canvas);
  const rippleFloor = createRippleFloor(canvas);
  let paused = reducedMotion.matches;
  let frame = 0;
  let lastTime = 0;

  function draw() {
    softenTerrain(settings);
    rippleFloor.prepare(size, settings);
    drawVisualizer(context!, size, settings, rippleFloor.context ?? undefined);
  }
  function resize() {
    size.width = innerWidth;
    size.height = innerHeight;
    // Keep the solid terrain's fill and backdrop blur within the frame budget.
    const scale = Math.min(devicePixelRatio || 1, settings.mode === 'terrain' ? 1.5 : 2);
    canvas!.width = Math.round(size.width * scale);
    canvas!.height = Math.round(size.height * scale);
    context!.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
  }
  function animate(now: number) {
    settings.time += Math.min((now - lastTime) / 1000, .05);
    const music = followAudio(now);
    settings.audio = music.audio;
    settings.timeline = music.timeline;
    lastTime = now;
    draw();
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

  initVisualToggle(room, mode => {
    settings.mode = mode;
    settings.depth = VISUAL_DEPTHS[mode];
    resize();
  }, abort.signal);
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
    if (!event.persisted) { rippleFloor.destroy(); abort.abort(); }
  }, options);
  window.addEventListener('pageshow', updateMotion, options);
  resize();
  updateMotion();
}
