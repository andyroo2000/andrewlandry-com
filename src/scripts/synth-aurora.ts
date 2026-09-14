import { ink, type Renderer, type Viewport, type VisualSettings } from './synth-visual-types';

function curtainHeight(x: number, layer: number, { time, depth, audio }: VisualSettings) {
  return .48 + Math.sin(x * 5 + time * .09 + layer * .55) * .24
    + Math.cos(x * 9 - time * .13 + layer) * (.035 + audio.mid * .1 * depth)
    + Math.sin(x * 23 + layer * .4 - time * .2) * audio.high * .025 * depth;
}

function drawCurtain(context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings, layer: number) {
  const { width, height } = size;
  const { audio, depth } = settings;
  const reach = height * (.19 + audio.bass * .26 * depth);
  const hue = layer % 2 === 0 ? '242,247,108' : '114,207,221';
  const glow = context.createLinearGradient(0, height * .1, 0, height * .9);
  glow.addColorStop(0, `rgba(${hue},0)`);
  glow.addColorStop(.42, `rgba(${hue},${.035 + audio.level * .055})`);
  glow.addColorStop(1, `rgba(${hue},0)`);
  context.fillStyle = glow;
  context.beginPath();
  for (let step = 0; step <= 100; step++) {
    const x = step / 100;
    context.lineTo(x * width, curtainHeight(x, layer, settings) * height - reach);
  }
  for (let step = 100; step >= 0; step--) {
    const x = step / 100;
    context.lineTo(x * width, curtainHeight(x, layer, settings) * height + reach * .12);
  }
  context.closePath();
  context.fill();
}

export const drawAurora: Renderer = (context, size, settings) => {
  context.globalCompositeOperation = 'screen';
  for (let layer = 0; layer < 20; layer++) drawCurtain(context, size, settings, layer / 4);
  // Fine vertical filaments soften the edges without expensive full-screen blur.
  for (let ray = 0; ray < 150; ray++) {
    const x = ray / 149;
    const y = curtainHeight(x, 2, settings) * size.height;
    const reach = size.height * (.14 + settings.audio.bass * .15 * settings.depth);
    const glow = context.createLinearGradient(0, y - reach, 0, y + reach * .25);
    glow.addColorStop(0, ink(0));
    glow.addColorStop(.75, ink(.06 + settings.audio.high * .13));
    glow.addColorStop(1, ink(0));
    context.fillStyle = glow;
    context.fillRect(x * size.width, y - reach, size.width / 150, reach * 1.25);
  }
};
