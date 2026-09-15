import { ink, type Renderer, type Viewport, type VisualSettings } from './synth-visual-types';
import { terrainDepth, terrainResponse, terrainShake } from './synth-terrain-style';
import { createTerrainFieldCache, sampleTerrainHeight, terrainRowTime, TERRAIN_COLUMNS, TERRAIN_HISTORY_SECONDS, TERRAIN_ROWS_PER_SECOND, MOUND_RADIUS_COLUMNS, MOUND_RADIUS_SECONDS, type TerrainField } from './synth-terrain-field';
import { createTerrainCamera, projectTerrainPoint, TERRAIN_FAR_DISTANCE, TERRAIN_FOREGROUND_DISTANCE, type TerrainCamera } from './synth-terrain-camera';

type Vertex = { x: number; y: number };
type TerrainRow = { points: Vertex[]; firstColumn: number; contour: boolean };
const readField = createTerrainFieldCache();
const ROW_COUNT = TERRAIN_HISTORY_SECONDS * TERRAIN_ROWS_PER_SECOND;
const TRAVEL_SPEED = (TERRAIN_FAR_DISTANCE - TERRAIN_FOREGROUND_DISTANCE) / TERRAIN_HISTORY_SECONDS;
const GRID_SPACING = TRAVEL_SPEED * MOUND_RADIUS_SECONDS / MOUND_RADIUS_COLUMNS;
const MESH_COLUMN_STEP = 2;

function terrainRow(row: number, camera: TerrainCamera, settings: VisualSettings, field: TerrainField | undefined) {
  const seconds = settings.timeline?.seconds ?? 0;
  // The leading edge samples the playback clock directly. The rows behind
  // it stay anchored to their recorded times as they drift toward us.
  const recordedAt = row < 0 ? seconds : terrainRowTime(seconds, row);
  const z = TERRAIN_FAR_DISTANCE - (seconds - recordedAt) * TRAVEL_SPEED;
  const lift = .3 + terrainDepth(settings.depth) * .95;
  const bounds = visibleColumns(camera, z);
  const points = Array.from({ length: bounds * 2 / MESH_COLUMN_STEP + 1 }, (_, index) => {
    const column = index * MESH_COLUMN_STEP - bounds;
    const height = sampleTerrainHeight(field, wrappedColumn(column), recordedAt);
    return projectTerrainPoint(camera, { x: column * GRID_SPACING, y: height * lift, z });
  });
  // Keep the solid mesh dense, but ink only every other recorded cross-section.
  // Anchor that choice to the music's clock so lines travel with the ground.
  const contour = row < 0 || Math.round(recordedAt * TERRAIN_ROWS_PER_SECOND) % 2 === 0;
  return { points, firstColumn: -bounds, contour };
}

function visibleColumns(camera: TerrainCamera, z: number) {
  // Include the next row's screen edges, so clipped diagonal lines stay joined.
  const halfWidth = camera.centerX * (z + TRAVEL_SPEED / TERRAIN_ROWS_PER_SECOND) / camera.focalLength;
  return (Math.ceil(halfWidth / (GRID_SPACING * MESH_COLUMN_STEP)) + 1) * MESH_COLUMN_STEP;
}

function wrappedColumn(column: number) {
  // Repeat the field's flat, matching edges across an unbounded ground plane.
  const period = TERRAIN_COLUMNS - 1;
  return ((column + period / 2) % period + period) % period;
}

function strokePoints(context: CanvasRenderingContext2D, points: Vertex[]) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
}

function fillGround(context: CanvasRenderingContext2D, row: Vertex[], coveredBelow: number) {
  const rowBottom = Math.max(...row.map(point => point.y));
  // Nearer rows already cover everything below their lowest point. Stop
  // this mask there instead of repainting the entire screen beneath it.
  const bottom = Math.max(coveredBelow, rowBottom) + 2;
  context.beginPath();
  context.moveTo(row[0].x, bottom);
  row.forEach(point => context.lineTo(point.x, point.y));
  context.lineTo(row[row.length - 1].x, bottom);
  context.closePath();
  context.fill();
  return rowBottom;
}

function strokeConnections(context: CanvasRenderingContext2D, row: TerrainRow, nearer: TerrainRow, major: boolean) {
  context.beginPath();
  const first = Math.max(row.firstColumn, nearer.firstColumn);
  const last = Math.min(row.firstColumn + row.points.length * MESH_COLUMN_STEP, nearer.firstColumn + nearer.points.length * MESH_COLUMN_STEP);
  for (let column = Math.ceil(first / 4) * 4; column < last; column += 4) {
    if ((column % 16 === 0) !== major) continue;
    const from = row.points[(column - row.firstColumn) / MESH_COLUMN_STEP];
    const to = nearer.points[(column - nearer.firstColumn) / MESH_COLUMN_STEP];
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  }
  context.stroke();
}

function drawConnections(context: CanvasRenderingContext2D, row: TerrainRow, nearer: TerrainRow | undefined, response: number) {
  if (!nearer) return;
  context.lineWidth = .9;
  context.strokeStyle = ink(.12 * (1 + response * .25));
  strokeConnections(context, row, nearer, false);
  context.strokeStyle = ink(.24 * (1 + response * .25), true);
  strokeConnections(context, row, nearer, true);
}

function drawSolidGround(context: CanvasRenderingContext2D, rows: TerrainRow[], size: Viewport, response: number) {
  let coveredBelow = size.height;
  // Paint from the viewer toward the horizon. Each opaque cross-section
  // masks everything below it; destination-over places more distant ground
  // and line segments behind that mask, including the backs of mountains.
  context.globalCompositeOperation = 'destination-over';
  for (let index = rows.length - 1; index >= 0; index--) {
    const { points, contour } = rows[index];
    const distance = Math.max(0, index - 1) / ROW_COUNT;
    const horizonEmphasis = Math.exp(-distance * 14);
    context.strokeStyle = ink((.12 + distance * .3 + horizonEmphasis * .14) * (.9 + response * .25));
    context.lineWidth = (.55 + horizonEmphasis * .55 + distance * .85) * 1.3;
    if (contour) strokePoints(context, points);
    drawConnections(context, rows[index], rows[index + 1], response);
    coveredBelow = fillGround(context, points, coveredBelow);
  }
}

function drawDistantGround(context: CanvasRenderingContext2D, size: Viewport, camera: TerrainCamera) {
  // Continue the ground to the true horizon without unresolved grid lines
  // piling into a bright fan at the vanishing point.
  context.fillRect(0, camera.horizonY, size.width, size.height - camera.horizonY);
}

export const drawTerrain: Renderer = (context, size, settings) => {
  const field = readField(settings.timeline?.track);
  const response = terrainResponse(settings.audio, settings.timeline);
  const camera = createTerrainCamera(size, terrainShake(settings.time, settings.audio.deepBass ?? 0));
  const rows = Array.from({ length: ROW_COUNT + 2 }, (_, row) => terrainRow(row - 1, camera, settings, field));
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.fillStyle = settings.dark ? '#101835' : '#2446ee';
  drawSolidGround(context, rows, size, response);
  drawDistantGround(context, size, camera);
  context.strokeStyle = ink(.13 + response * .035);
  context.lineWidth = .9;
  strokePoints(context, [{ x: 0, y: camera.horizonY }, { x: size.width, y: camera.horizonY }]);
};
