import { ink, seed, TAU, type VisualSettings, type Viewport } from './synth-visual-types';
import { terrainShake } from './synth-terrain-style';
import { createRippleEventReader } from './synth-ripple-events';
import { createRainPlanReader, rainGap, sampleRainDrop } from './synth-ripple-rain';
import { paintNeonObject } from './synth-rain-objects';
import { drawRainBeam } from './synth-rain-beam';

export const RIPPLE_PALETTE = ['#f2f76c', '#ff8b83', '#b6a0ff', '#89e4c8', '#fffef6'];
const readEvents = createRippleEventReader();
const readPlan = createRainPlanReader();
type RippleParticle = NonNullable<ReturnType<typeof sampleRainDrop>>;

function paintGlyph(context: CanvasRenderingContext2D, shape: number) {
  context.beginPath();
  if (shape === 0 || shape === 4) context.arc(0, 0, .9, 0, TAU);
  else {
    const sides = [0, 4, 3, 8][shape];
    for (let corner = 0; corner < sides; corner++) {
      const radius = shape === 3 && corner % 2 ? .4 : 1;
      const angle = corner / sides * TAU - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (corner === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }
  if (shape === 4) { context.lineWidth = .2; context.stroke(); }
  else context.fill();
}

function drawParticle(context: CanvasRenderingContext2D, particle: RippleParticle, shake: { x: number; y: number }) {
  const color = RIPPLE_PALETTE[Math.floor(seed(particle.id + 197) * RIPPLE_PALETTE.length)];
  context.save();
  context.translate(particle.x + shake.x, particle.y + shake.y);
  context.rotate(particle.angle);
  context.scale(particle.radius, particle.radius);
  context.globalAlpha = particle.alpha;
  context.fillStyle = color;
  context.strokeStyle = color;
  if (particle.object) paintNeonObject(context, particle.object);
  else paintGlyph(context, Math.floor(seed(particle.id + 211) * 5));
  context.restore();
}

function drawFloor(context: CanvasRenderingContext2D, size: Viewport, time: number, shake: { x: number; y: number }) {
  const halfGap = rainGap(size, time);
  const edge = size.width / 2 - halfGap;
  context.save();
  context.translate(shake.x, shake.y);
  context.fillStyle = ink(.32);
  context.fillRect(0, size.height - 8, edge, 2);
  context.fillRect(size.width / 2 + halfGap, size.height - 8, edge, 2);
  context.restore();
}

export function drawRipple(context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings, floorContext = context) {
  const { time, events } = readEvents(settings);
  const plan = readPlan(events, size, settings);
  drawRainBeam(context, size, plan, time);
  const vibration = terrainShake(settings.time, settings.audio.deepBass ?? 0);
  const shake = { x: vibration.x * .35, y: vibration.y * .35 };
  for (const drop of plan) {
    const particle = sampleRainDrop(drop, time);
    if (!particle || particle.y > size.height + particle.radius) continue;
    const target = particle.grounded ? floorContext : context;
    drawParticle(target, particle, particle.grounded ? shake : { x: 0, y: 0 });
  }
  drawFloor(floorContext, size, time, shake);
}
