import type { AudioFeatures } from './synth-audio-data';

export type OriginalMode = 'signal' | 'orbit' | 'drift';
export type VisualMode = OriginalMode | 'aurora' | 'constellation' | 'kaleidoscope' | 'terrain' | 'ripple' | 'mosaic';
export type Viewport = { width: number; height: number };
export type VisualSettings = { time: number; depth: number; dark: boolean; audio: AudioFeatures };
export type Renderer = (context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings) => void;
export const TAU = Math.PI * 2;

export const visualModes: { id: VisualMode; label: string; description: string; original?: boolean }[] = [
  { id: 'aurora', label: 'Aurora', description: 'Soft curtains of light. Bass swells; treble shimmers.' },
  { id: 'constellation', label: 'Constellation', description: 'A drifting star field. The music draws the connections.' },
  { id: 'kaleidoscope', label: 'Kaleidoscope', description: 'Turning stained glass. Each register shapes a different layer.' },
  { id: 'terrain', label: 'Terrain', description: 'An endless wireframe landscape. Bass raises the mountains.' },
  { id: 'ripple', label: 'Ripple', description: 'Three pools of sound. Low, middle, and high notes make waves.' },
  { id: 'mosaic', label: 'Mosaic', description: 'A living wall of tiles. Low, middle, and high notes unfold it.' },
  { id: 'signal', label: 'Signal', description: 'Rolling waves, pulled into shape by the music.', original: true },
  { id: 'orbit', label: 'Orbit', description: 'Loops within loops, expanding with the sound.', original: true },
  { id: 'drift', label: 'Drift', description: 'Slow ribbons with a little musical turbulence.', original: true },
];

export function ink(alpha: number, white = false) {
  return `rgba(${white ? '255,254,246' : '242,247,108'},${alpha})`;
}

export function fraction(value: number) { return value - Math.floor(value); }

// Stable seeds keep the field continuous between frames and on resize.
export function seed(index: number) { return fraction(Math.sin(index * 127.1 + 311.7) * 43758.5453); }
