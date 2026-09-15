import { drawTerrain } from './synth-terrain';
import { drawRipple } from './synth-ripple';
import type { Viewport, VisualMode, VisualSettings } from './synth-visual-types';

export function drawVisualizer(context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings & { mode: VisualMode }, floorContext?: CanvasRenderingContext2D) {
  context.clearRect(0, 0, size.width, size.height);
  context.save();
  if (settings.mode === 'ripple') drawRipple(context, size, settings, floorContext);
  else drawTerrain(context, size, settings);
  context.restore();
}
