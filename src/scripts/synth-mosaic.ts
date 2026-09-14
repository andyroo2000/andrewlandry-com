import { ink, seed, type Renderer, type VisualSettings } from './synth-visual-types';

type Tile = { column: number; row: number; cell: number };

function drawTile(context: CanvasRenderingContext2D, { column, row, cell }: Tile, settings: VisualSettings) {
  const { time, audio, depth } = settings;
  const identity = column + row * 73;
  const energy = [audio.bass, audio.mid, audio.high][identity % 3];
  const wave = Math.sin(column * .44 + row * .5 - time * .26);
  const scale = .22 + (wave + 1) * .1 + energy * .38 * depth;
  const width = cell * scale;
  context.save();
  context.translate((column + .5) * cell, (row + .5) * cell);
  context.rotate(Math.sin(time * .07 + seed(identity) * 6) * .25 + energy * depth * .4);
  context.fillStyle = ink(.03 + energy * .23 + (wave + 1) * .025, identity % 7 === 0);
  context.strokeStyle = ink(.11 + energy * .3);
  context.lineWidth = .8;
  context.fillRect(-width / 2, -width / 2, width, width);
  context.strokeRect(-width / 2, -width / 2, width, width);
  context.restore();
}

export const drawMosaic: Renderer = (context, size, settings) => {
  const cell = size.width < 760 ? 48 : 68;
  const columns = Math.ceil(size.width / cell);
  const rows = Math.ceil(size.height / cell);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) drawTile(context, { column, row, cell }, settings);
  }
};
