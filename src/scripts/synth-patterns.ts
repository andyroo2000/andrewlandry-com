import type { OriginalMode, Viewport, VisualSettings } from './synth-visual-types';

type Point = { x: number; y: number };
type PatternSettings = VisualSettings;
type Pattern = (along: number, layer: number, settings: PatternSettings) => Point;
const TAU = Math.PI * 2;

function signal(along: number, layer: number, { time, depth, audio }: PatternSettings): Point {
  const wave = Math.sin(along * 8 + layer * 2.1 - time * .18);
  const swell = Math.cos(along * 4.5 - time * .12 + layer * 1.4);
  return {
    x: along * 1.2 - .1,
    y: .49 + (layer - .5) * (.53 + audio.mid * .08)
      + wave * (.12 + depth * .1 + audio.bass * .12 * depth) + swell * .12
      + Math.sin(along * 42 + layer * 3 - time * .4) * audio.high * .018 * depth,
  };
}

function orbit(along: number, layer: number, { time, depth, audio }: PatternSettings): Point {
  const angle = along * TAU;
  const twist = time * .065 + layer * 1.5;
  const radius = .22 + layer * .38 + audio.bass * .07 * depth;
  return {
    x: .54 + Math.cos(angle + twist) * radius * .85 + Math.sin(angle * 3 + twist) * depth * .065,
    y: .52 + Math.sin(angle) * radius + Math.cos(angle * 2 + twist) * (.06 + depth * .09 + audio.mid * .04)
      + Math.sin(angle * 9 + twist) * audio.high * .008,
  };
}

function drift(along: number, layer: number, { time, depth, audio }: PatternSettings): Point {
  const bend = Math.sin(along * 6 - time * .11 + layer * 3);
  const fold = Math.cos(along * 12 + time * .09 - layer * 2);
  return {
    x: layer * 1.4 - .2 + bend * (.12 + depth * .1 + audio.bass * .09 * depth)
      + fold * (.035 + audio.mid * .03) + Math.sin(along * 36 + layer) * audio.high * .01,
    y: along * 1.4 - .2,
  };
}

const patterns: Record<OriginalMode, Pattern> = { signal, orbit, drift };

export function drawPattern(context: CanvasRenderingContext2D, size: Viewport, settings: PatternSettings, mode: OriginalMode) {
  const pattern = patterns[mode];
  const lines = size.width < 760 ? 28 : 48;
  const samples = 180;
  context.lineWidth = (settings.dark ? 1.15 : 1) + settings.audio.level * .4;
  for (let line = 0; line < lines; line++) {
    const layer = line / (lines - 1);
    const emphasis = Math.sin(layer * Math.PI);
    const brightness = .8 + settings.audio.level * .6;
    context.strokeStyle = line % 7 === 0 ? `rgba(255,254,246,${(.16 + emphasis * .23) * brightness})` : `rgba(242,247,108,${(.12 + emphasis * .36) * brightness})`;
    context.beginPath();
    for (let sample = 0; sample <= samples; sample++) {
      const point = pattern(sample / samples, layer, settings);
      const x = point.x * size.width;
      const y = point.y * size.height;
      if (sample === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}
