import { fraction, ink, type Renderer, type Viewport, type VisualSettings } from './synth-visual-types';

type Vertex = { x: number; y: number };

function terrainVertex(column: number, row: number, size: Viewport, settings: VisualSettings): Vertex {
  const { time, depth, audio } = settings;
  const distance = (row + fraction(time * .42)) / 34;
  const spread = .045 + distance * distance * 1.65;
  const across = (column - 20) / 20;
  const travel = time * .32 - distance * 7;
  const mountains = Math.sin(across * 5 + travel) * Math.cos(across * 3 - travel * .6)
    + Math.sin(across * 11 + travel * 1.7) * (.15 + audio.high * .18);
  const lift = (.035 + depth * (.04 + audio.bass * .15 + audio.mid * .05)) * distance;
  return {
    x: size.width * (.5 + across * spread),
    y: size.height * (.24 + distance * distance * .92 - mountains * lift),
  };
}

function drawRow(context: CanvasRenderingContext2D, row: Vertex[], alpha: number) {
  context.strokeStyle = ink(alpha);
  context.beginPath();
  row.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
}

export const drawTerrain: Renderer = (context, size, settings) => {
  context.lineWidth = .85 + settings.audio.level * .55;
  const rows = Array.from({ length: 35 }, (_, row) =>
    Array.from({ length: 41 }, (_, column) => terrainVertex(column, row, size, settings)));
  rows.forEach((row, index) => drawRow(context, row, .05 + index / rows.length * .44));
  for (let column = 0; column < 41; column++) {
    context.beginPath();
    for (let row = 0; row < rows.length; row++) {
      const point = rows[row][column];
      if (row === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = ink(.14 + settings.audio.mid * .14, column % 5 === 0);
    context.stroke();
  }
};
