import { ink, TAU, type Renderer, type VisualSettings } from './synth-visual-types';

function drawFacet(context: CanvasRenderingContext2D, radius: number, layer: number, settings: VisualSettings) {
  const { time, audio, depth } = settings;
  const bands = [audio.bass, audio.mid, audio.high];
  const energy = bands[layer % 3];
  const inner = radius * (.35 + energy * .19 * depth);
  const tip = Math.sin(time * .13 + layer) * .13;
  context.beginPath();
  context.moveTo(inner, 0);
  context.lineTo(radius * .72, radius * (.22 + tip));
  context.lineTo(radius, 0);
  context.lineTo(radius * .72, -radius * (.22 + tip));
  context.closePath();
  context.fillStyle = layer % 2 === 0 ? ink(.045 + energy * .14) : `rgba(105,135,255,${.08 + energy * .23})`;
  context.fill();
  context.strokeStyle = ink(.13 + energy * .23, layer % 3 === 2);
  context.lineWidth = .8 + energy;
  context.stroke();
}

export const drawKaleidoscope: Renderer = (context, size, settings) => {
  const extent = Math.max(size.width, size.height) * .7;
  context.translate(size.width * .49, size.height * .51);
  for (let layer = 0; layer < 7; layer++) {
    context.save();
    const direction = layer % 2 === 0 ? 1 : -1;
    context.rotate(settings.time * .025 * direction + layer * .2);
    for (let segment = 0; segment < 12; segment++) {
      drawFacet(context, extent * (1 - layer * .115), layer, settings);
      context.rotate(TAU / 12);
    }
    context.restore();
  }
};
