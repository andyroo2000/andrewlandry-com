import type { Viewport } from './synth-visual-types';
import { TERRAIN_HORIZON } from './synth-terrain-style';

export const TERRAIN_FAR_DISTANCE = 21;
export const TERRAIN_FOREGROUND_DISTANCE = 1;
const CAMERA_HEIGHT = 1.1;
const VERTICAL_FIELD_OF_VIEW = 55 * Math.PI / 180;

export function createTerrainCamera(size: Viewport, shake = { x: 0, y: 0 }) {
  const focalLength = size.height / (2 * Math.tan(VERTICAL_FIELD_OF_VIEW / 2));
  // Translate the camera in world space so nearby ground moves more than
  // distant ground. The true horizon and all interface elements stay fixed.
  return {
    focalLength,
    centerX: size.width / 2,
    horizonY: size.height * TERRAIN_HORIZON,
    offsetX: shake.x * TERRAIN_FOREGROUND_DISTANCE / focalLength,
    height: CAMERA_HEIGHT + shake.y * TERRAIN_FOREGROUND_DISTANCE / focalLength,
  };
}

export type TerrainCamera = ReturnType<typeof createTerrainCamera>;

export function projectTerrainPoint(camera: TerrainCamera, point: { x: number; y: number; z: number }) {
  // A level pinhole camera: every dimension shares the same perspective divide.
  const scale = camera.focalLength / point.z;
  return {
    x: camera.centerX + (point.x + camera.offsetX) * scale,
    y: camera.horizonY + (camera.height - point.y) * scale,
  };
}
