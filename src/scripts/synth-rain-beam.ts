import type { Viewport } from './synth-visual-types';
import { rainEntryLine, type RainPlan } from './synth-ripple-rain';
import { RAIN_ENTRY_SECONDS } from './synth-ripple-events';

function drawSeam(context: CanvasRenderingContext2D, size: Viewport, edge: number) {
  const glow = context.createLinearGradient(0, edge - 20, 0, edge + 20);
  glow.addColorStop(0, 'rgba(137,228,200,0)');
  glow.addColorStop(.5, 'rgba(137,228,200,.12)');
  glow.addColorStop(1, 'rgba(137,228,200,0)');
  context.fillStyle = glow;
  context.fillRect(0, edge - 20, size.width, 40);
  context.fillStyle = 'rgba(137,228,200,.32)';
  context.fillRect(0, edge, size.width, 1);
}

function drawArrivals(context: CanvasRenderingContext2D, drops: RainPlan[], time: number, edge: number) {
  for (const drop of drops) {
    const age = time - drop.born - RAIN_ENTRY_SECONDS;
    if (age < 0 || age > .38) continue;
    const strength = (1 - age / .38) ** 2 * (.25 + drop.energy * .55);
    const width = 10 + drop.energy * 22 + age * 28;
    context.fillStyle = `rgba(242,247,108,${strength * .14})`;
    context.fillRect(drop.startX - width, edge - 5, width * 2, 11);
    context.fillStyle = `rgba(255,254,246,${strength})`;
    context.fillRect(drop.startX - width * .5, edge, width, 1.5);
  }
}

export function drawRainBeam(context: CanvasRenderingContext2D, size: Viewport, drops: RainPlan[], time: number) {
  const edge = rainEntryLine(size);
  context.save();
  drawSeam(context, size, edge);
  drawArrivals(context, drops, time, edge);
  context.restore();
}
