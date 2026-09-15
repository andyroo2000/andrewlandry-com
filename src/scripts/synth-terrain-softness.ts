import type { VisualMode, VisualSettings } from './synth-visual-types';
import { terrainBassResponse } from './synth-terrain-style';

const TOP_BLUR = 2;
const BOTTOM_BLUR = 8;
// Sequential Gaussian blurs add their variances, not their radii.
const FOREGROUND_BLUR = Math.sqrt(BOTTOM_BLUR ** 2 - TOP_BLUR ** 2);

export function createTerrainSoftness(layer: HTMLElement, canvas: HTMLCanvasElement) {
  let previous = -1;
  return (settings: VisualSettings & { mode: VisualMode }) => {
    const amount = settings.mode === 'terrain'
      ? Math.round(BOTTOM_BLUR * terrainBassResponse(settings.audio.deepBass ?? 0) * 10) / 10
      : 0;
    if (amount === previous) return;
    previous = amount;
    const response = amount / BOTTOM_BLUR;
    // The background canvas supplies the soft top; the masked backdrop adds the
    // stronger foreground. Both filters disappear between bass hits.
    canvas.style.filter = amount > 0 ? `blur(${response * TOP_BLUR}px)` : 'none';
    layer.style.setProperty('--terrain-blur', `${response * FOREGROUND_BLUR}px`);
    layer.hidden = amount === 0;
  };
}
