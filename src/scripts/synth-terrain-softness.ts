import type { VisualMode, VisualSettings } from './synth-visual-types';
import { terrainBassResponse, terrainForegroundWeight } from './synth-terrain-style';

const BOTTOM_BLUR = 8;

export function createTerrainSoftness(layer: HTMLElement, canvas: HTMLCanvasElement) {
  // Keep the original terrain crisp; only the masked foreground is softened.
  canvas.style.filter = 'none';
  const stops = [25, 40, 55, 70, 85, 100].map(position =>
    `rgb(0 0 0 / ${terrainForegroundWeight(position / 100)}) ${position}%`);
  layer.style.setProperty('--terrain-softness-mask', `linear-gradient(to bottom, ${stops.join(', ')})`);
  let previous = -1;
  return (settings: VisualSettings & { mode: VisualMode }) => {
    const amount = settings.mode === 'terrain'
      ? Math.round(BOTTOM_BLUR * terrainBassResponse(settings.audio.deepBass ?? 0) * 10) / 10
      : 0;
    if (amount === previous) return;
    previous = amount;
    layer.style.setProperty('--terrain-blur', `${amount}px`);
    layer.hidden = amount === 0;
  };
}
