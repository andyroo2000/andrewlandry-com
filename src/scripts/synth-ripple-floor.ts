import type { Viewport, VisualMode, VisualSettings } from './synth-visual-types';
import { terrainBassResponse } from './synth-terrain-style';

// A short, separate canvas lets only collected shapes blur. Falling shapes
// stay crisp even as they cross this strip, and no full-screen filter is needed.
const FLOOR_HEIGHT = 128;

export function createRippleFloor(canvas: HTMLCanvasElement) {
  const layer = canvas.ownerDocument.createElement('canvas');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-ripple-floor', '');
  layer.style.cssText = `position:fixed;left:0;bottom:0;width:100%;height:${FLOOR_HEIGHT}px;pointer-events:none;`;
  layer.hidden = true;
  canvas.after(layer);
  const context = layer.getContext('2d');
  let previousBlur = '';

  function prepare(size: Viewport, settings: VisualSettings & { mode: VisualMode }) {
    layer.hidden = settings.mode !== 'ripple';
    if (layer.hidden || !context) return;
    const scale = canvas.width / size.width;
    const height = Math.round(FLOOR_HEIGHT * scale);
    if (layer.width !== canvas.width || layer.height !== height) {
      layer.width = canvas.width;
      layer.height = height;
    }
    const top = size.height - FLOOR_HEIGHT;
    context.setTransform(scale, 0, 0, scale, 0, -top * scale);
    context.clearRect(0, top, size.width, FLOOR_HEIGHT);
    const blur = Math.round(30 * terrainBassResponse(settings.audio.deepBass ?? 0)) / 10;
    const filter = blur > 0 ? `blur(${blur}px)` : 'none';
    if (filter !== previousBlur) { layer.style.filter = filter; previousBlur = filter; }
  }

  return { context, prepare, destroy: () => layer.remove() };
}
