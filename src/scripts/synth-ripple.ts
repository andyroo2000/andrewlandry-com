import { fraction, ink, TAU, type Renderer, type Viewport, type VisualSettings } from './synth-visual-types';

function drawPool(context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings, pool: number) {
  const { time, depth, audio } = settings;
  const energy = [audio.bass, audio.mid, audio.high][pool];
  const centers = [[.15, .64], [.74, .27], [.86, .88]];
  const [x, y] = centers[pool];
  const extent = Math.max(size.width, size.height) * .7;
  context.save();
  context.translate(x * size.width, y * size.height);
  context.rotate(-.25 + pool * .35);
  context.scale(1, .7);
  for (let ring = 0; ring < 16; ring++) {
    const age = fraction(ring / 16 + time * .023 + pool * .19);
    const radius = (age + energy * .018 * depth) * extent;
    const envelope = Math.sin(age * Math.PI) * (1 - age);
    context.strokeStyle = ink(envelope * (.2 + energy * .65), pool === 2);
    context.lineWidth = 1 + energy * 3 * depth * (1 - age);
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.stroke();
  }
  context.restore();
}

export const drawRipple: Renderer = (context, size, settings) => {
  for (let pool = 0; pool < 3; pool++) drawPool(context, size, settings, pool);
};
