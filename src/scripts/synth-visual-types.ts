import type { AudioFeatures } from './synth-audio-data';
import type { AudioTimeline } from './synth-audio';

export type VisualMode = 'terrain' | 'ripple';
export const DEFAULT_VISUAL_MODE: VisualMode = 'terrain';
export const VISUAL_DEPTHS: Record<VisualMode, number> = { terrain: .2, ripple: 0 };
export type Viewport = { width: number; height: number };
export type VisualSettings = { time: number; depth: number; dark: boolean; audio: AudioFeatures; timeline?: AudioTimeline };
export type Renderer = (context: CanvasRenderingContext2D, size: Viewport, settings: VisualSettings) => void;
export const TAU = Math.PI * 2;

export const visualModes: { id: VisualMode; label: string }[] = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'ripple', label: 'Rain' },
];

export function ink(alpha: number, white = false) {
  return `rgba(${white ? '255,254,246' : '242,247,108'},${alpha})`;
}

export function fraction(value: number) { return value - Math.floor(value); }

// Stable seeds keep the field continuous between frames and on resize.
export function seed(index: number) { return fraction(Math.sin(index * 127.1 + 311.7) * 43758.5453); }
