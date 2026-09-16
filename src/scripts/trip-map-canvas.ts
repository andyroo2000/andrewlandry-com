import type { TripYear } from '../data/japan-trips';
import type { MapJourney } from '../data/japan-transfers';
import { traceTripRoute } from './trip-route';
import { scheduleMapWarmup } from './trip-map-warmup';

export type MapView = { width: number; height: number; x: number; y: number; scale: number };
// Rasterize coastlines, lakes, and route guides once per tile. Panning only
// copies cached pixels; it never repaints the detailed SVG geometry or masks.
const TILE_SIZE = 256;
// Each tile has two surfaces. Limit their combined storage to 128 MiB,
// independent of trip length. Mobile never draws or caches map tiles.
const CACHE_PIXELS = 64 * 512 * 512;

export function mapRasterSettings(view: Pick<MapView, 'width' | 'height'>, pixelRatio: number) {
  // Bound the viewport surfaces too, and leave enough cache for a full view
  // on large monitors. An integer tile pixel size avoids resampling seams.
  const requested = Math.min(pixelRatio || 1, 2, Math.sqrt(6_000_000 / (view.width * view.height)));
  const tilePixels = Math.max(1, Math.floor(TILE_SIZE * requested));
  return { density: tilePixels / TILE_SIZE, maxTiles: Math.floor(CACHE_PIXELS / (tilePixels * tilePixels)) };
}

type Surface = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
function surface(width: number, height: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext('2d')! };
}

export function createMapCanvas(map: HTMLElement, journeys: Record<TripYear, MapJourney>) {
  const canvas = map.querySelector<HTMLCanvasElement>('[data-map-canvas]')!;
  const context = canvas.getContext('2d')!;
  const ink = surface(1, 1);
  const land = new Path2D(map.querySelector('#hokkaido-land')!.getAttribute('d')!);
  const lakes = new Path2D(map.querySelector('[data-lakes]')!.getAttribute('d')!);
  const guides = Object.fromEntries(Object.keys(journeys).map(year => [year,
    new Path2D(map.querySelector(`#journey-path-${year}`)!.getAttribute('d')!)]));
  const tiles = new Map<string, { art: Surface; mask: Surface }>();
  const style = getComputedStyle(map);
  const color = (name: string) => style.getPropertyValue(name).trim();
  const colors = { land: color('--map-land'), water: color('--blue'), ink: color('--map-ink'), route: color('--map-water-route') };
  let cacheKey = '';
  let density = 1;
  let maxTiles = 64;
  let cancelWarmup = () => {};

  function paintLand(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = colors.land;
    ctx.strokeStyle = colors.land;
    ctx.lineJoin = 'round';
    for (const [width, alpha] of [[100, .06], [45, .11]]) {
      ctx.lineWidth = width!;
      ctx.globalAlpha = alpha!;
      ctx.stroke(land);
    }
    ctx.globalAlpha = 1;
    ctx.fill(land);
    ctx.fillStyle = colors.water;
    ctx.fill(lakes);
  }

  function tile(x: number, y: number, scale: number, year: TripYear) {
    const key = `${x}:${y}`;
    const cached = tiles.get(key);
    if (cached) { tiles.delete(key); tiles.set(key, cached); return cached; }
    const size = TILE_SIZE * density;
    const art = surface(size, size), mask = surface(size, size);
    for (const { context: ctx } of [art, mask]) ctx.setTransform(scale * density, 0, 0, scale * density, -x * size, -y * size);
    paintLand(art.context);
    mask.context.fill(land);
    mask.context.globalCompositeOperation = 'destination-out';
    mask.context.fill(lakes);
    const ctx = art.context;
    ctx.globalAlpha = .65;
    ctx.lineWidth = 3 / scale;
    ctx.lineCap = 'round';
    ctx.setLineDash([4 / scale, 10 / scale]);
    ctx.strokeStyle = colors.route;
    ctx.stroke(guides[year]!);
    ctx.clip(land);
    const outsideLakes = new Path2D();
    outsideLakes.rect(x * TILE_SIZE / scale, y * TILE_SIZE / scale, TILE_SIZE / scale, TILE_SIZE / scale);
    outsideLakes.addPath(lakes);
    ctx.clip(outsideLakes, 'evenodd');
    ctx.strokeStyle = colors.ink;
    ctx.stroke(guides[year]!);
    const result = { art, mask };
    tiles.set(key, result);
    if (tiles.size > maxTiles) tiles.delete(tiles.keys().next().value!);
    return result;
  }

  function resize(view: MapView, year: TripYear) {
    ({ density, maxTiles } = mapRasterSettings(view, Math.min(window.devicePixelRatio, 1.5)));
    const nextKey = `${view.scale}:${density}:${year}`;
    if (nextKey !== cacheKey) { cancelWarmup(); tiles.clear(); cacheKey = nextKey; }
    const width = Math.round(view.width * density), height = Math.round(view.height * density);
    if (canvas.width === width && canvas.height === height) return;
    for (const target of [canvas, ink.canvas]) { target.width = width; target.height = height; }
  }

  function tileCoordinates(view: MapView) {
    const left = view.x * view.scale - view.width * .79;
    const top = view.y * view.scale - view.height * .53;
    const result: { column: number; row: number; x: number; y: number }[] = [];
    for (let row = Math.floor(top / TILE_SIZE); row <= Math.floor((top + view.height) / TILE_SIZE); row++) {
      for (let column = Math.floor(left / TILE_SIZE); column <= Math.floor((left + view.width) / TILE_SIZE); column++) {
        result.push({ column, row, x: Math.round((column * TILE_SIZE - left) * density) / density,
          y: Math.round((row * TILE_SIZE - top) * density) / density });
      }
    }
    return result;
  }

  function paintProgress(view: MapView, path: Path2D, ctx: CanvasRenderingContext2D, paint: { stroke: string; width: number }) {
    ctx.setTransform(view.scale * density, 0, 0, view.scale * density,
      (view.width * .79 - view.x * view.scale) * density, (view.height * .53 - view.y * view.scale) * density);
    ctx.strokeStyle = paint.stroke;
    ctx.lineWidth = paint.width / view.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.setTransform(density, 0, 0, density, 0, 0);
  }

  return {
    draw(view: MapView, year: TripYear, position: number) {
      resize(view, year);
      context.setTransform(density, 0, 0, density, 0, 0);
      context.clearRect(0, 0, view.width, view.height);
      const visible = tileCoordinates(view).map(({ column, row, x, y }) => ({ ...tile(column, row, view.scale, year), x, y }));
      for (const { art, x, y } of visible) context.drawImage(art.canvas, x, y, TILE_SIZE, TILE_SIZE);
      const path = new Path2D();
      traceTripRoute(path, journeys[year], position);
      context.globalAlpha = .3;
      paintProgress(view, path, context, { stroke: '#fff', width: 6 });
      context.globalAlpha = 1;
      paintProgress(view, path, context, { stroke: colors.route, width: 4.5 });
      const ctx = ink.context;
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.clearRect(0, 0, view.width, view.height);
      for (const { mask, x, y } of visible) ctx.drawImage(mask.canvas, x, y, TILE_SIZE, TILE_SIZE);
      // One composition for the whole trail avoids a separate clipped GPU
      // operation for every map tile on every animation frame.
      ctx.globalCompositeOperation = 'source-in';
      paintProgress(view, path, ctx, { stroke: colors.ink, width: 4.5 });
      ctx.globalCompositeOperation = 'source-over';
      context.drawImage(ink.canvas, 0, 0, view.width, view.height);
    },
    warm(view: MapView, year: TripYear) {
      cancelWarmup();
      const pending = tileCoordinates(view).filter(({ column, row }) => !tiles.has(`${column}:${row}`));
      cancelWarmup = scheduleMapWarmup(pending.map(({ column, row }) => () => { tile(column, row, view.scale, year); }));
    },
    destroy() { cancelWarmup(); tiles.clear(); canvas.width = 0; ink.canvas.width = 0; },
  };
}
