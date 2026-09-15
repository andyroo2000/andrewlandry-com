import type { Viewport } from './synth-visual-types';
import { terrainForegroundWeight, TERRAIN_HORIZON } from './synth-terrain-style';

export const TERRAIN_FAR_DISTANCE = 21;
export const TERRAIN_FOREGROUND_DISTANCE = 1;
// Look across the tops of nearby ridges so newly arriving peaks stay visible.
const CAMERA_HEIGHT = 1.7;
const VERTICAL_FIELD_OF_VIEW = 40 * Math.PI / 180;

export function createTerrainCamera(size: Viewport, shake = { x: 0, y: 0 }) {
  const focalLength = size.height / (2 * Math.tan(VERTICAL_FIELD_OF_VIEW / 2));
  return {
    focalLength,
    centerX: size.width / 2,
    horizonY: size.height * TERRAIN_HORIZON,
    height: CAMERA_HEIGHT,
    viewportHeight: size.height,
    shake,
  };
}

export type TerrainCamera = ReturnType<typeof createTerrainCamera>;

export function projectTerrainPoint(camera: TerrainCamera, point: { x: number; y: number; z: number }) {
  // A level pinhole camera: every dimension shares the same perspective divide.
  const scale = camera.focalLength / point.z;
  const y = camera.horizonY + (camera.height - point.y) * scale;
  // Match the blur's screen-space falloff even when the camera height changes.
  const vibration = terrainForegroundWeight(y / camera.viewportHeight);
  return {
    x: camera.centerX + point.x * scale + camera.shake.x * vibration,
    y: y + camera.shake.y * vibration,
  };
}
