import { drawPattern } from './synth-patterns';
import { drawAurora } from './synth-aurora';
import { drawConstellation } from './synth-constellation';
import { drawKaleidoscope } from './synth-kaleidoscope';
import { drawTerrain } from './synth-terrain';
import { drawRipple } from './synth-ripple';
import { drawMosaic } from './synth-mosaic';
import type { Renderer, Viewport, VisualMode, VisualSettings } from './synth-visual-types';

const renderers: Record<VisualMode, Renderer> = {
  aurora: drawAurora,
  constellation: drawConstellation,
  kaleidoscope: drawKaleidoscope,
  terrain: drawTerrain,
  ripple: drawRipple,
  mosaic: drawMosaic,
  signal: (context, size, settings) => drawPattern(context, size, settings, 'signal'),
  orbit: (context, size, settings) => drawPattern(context, size, settings, 'orbit'),
  drift: (context, size, settings) => drawPattern(context, size, settings, 'drift'),
};

export function drawVisualizer(context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings & { mode: VisualMode }) {
  context.clearRect(0, 0, size.width, size.height);
  context.save();
  renderers[settings.mode](context, size, settings);
  context.restore();
}
