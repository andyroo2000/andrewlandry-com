import type { RainObject } from './synth-ripple-events';

const OBJECT_ART: Record<RainObject, { color: string; lines: string }> = {
  plane: {
    color: '#f2f76c',
    lines: 'M -.84 .1 L -.98 -.18 L -.78 -.2 L -.46 .02 L .54 -.2 Q .9 -.34 1 -.1 Q .91 .12 .63 .2 L .08 .31 L -.34 .84 L -.58 .8 L -.38 .4 L -.78 .48 L -.94 .67 L -1 .61 L -.91 .28 Z M -.46 .02 L -.72 -.62 L -.48 -.68 L .38 -.17 M .65 -.23 L .76 .17 M -.16 .09 a .055 .055 0 1 0 .11 0 a .055 .055 0 1 0 -.11 0 M .09 .04 a .055 .055 0 1 0 .11 0 a .055 .055 0 1 0 -.11 0 M .34 -.02 a .055 .055 0 1 0 .11 0 a .055 .055 0 1 0 -.11 0',
  },
  satellite: {
    color: '#b6a0ff',
    lines: 'M -.22 -.25 H .22 V .38 H -.22 Z M -.22 -.02 H -.36 M .22 -.02 H .36 M -.95 -.35 H -.36 V .34 H -.95 Z M .36 -.35 H .95 V .34 H .36 Z M -.75 -.35 V .34 M -.56 -.35 V .34 M -.95 0 H -.36 M .55 -.35 V .34 M .75 -.35 V .34 M .36 0 H .95 M 0 -.25 V -.46 M -.32 -.65 Q 0 -.12 .32 -.65 Z M 0 -.45 L .33 -.88 M .33 -.94 a .06 .06 0 1 0 0 .12 a .06 .06 0 1 0 0 -.12 M -.1 .08 a .1 .1 0 1 0 .2 0 a .1 .1 0 1 0 -.2 0 M -.12 .38 V .55 H .12 V .38',
  },
  ufo: {
    color: '#89e4c8',
    lines: 'M -1 .13 Q -.5 -.26 .5 -.18 Q .9 -.1 1 .13 Q .65 .68 -.65 .58 Z M -1 .13 Q 0 .4 1 .13 M -.49 -.13 Q -.43 -.91 .12 -.75 Q .46 -.65 .5 -.18 M -.02 -.78 V -.94 M -.02 -1 a .06 .06 0 1 0 0 .12 a .06 .06 0 1 0 0 -.12 M -.55 .37 a .065 .065 0 1 0 .13 0 a .065 .065 0 1 0 -.13 0 M -.065 .43 a .065 .065 0 1 0 .13 0 a .065 .065 0 1 0 -.13 0 M .42 .36 a .065 .065 0 1 0 .13 0 a .065 .065 0 1 0 -.13 0',
  },
  astronaut: {
    color: '#fffef6',
    lines: 'M -.33 -.5 a .33 .33 0 1 0 .66 0 a .33 .33 0 1 0 -.66 0 M -.24 -.57 Q -.24 -.66 -.14 -.66 H .14 Q .24 -.66 .24 -.57 V -.43 Q .24 -.33 .14 -.33 H -.14 Q -.24 -.33 -.24 -.43 Z M .08 -.58 L .16 -.5 M -.23 -.15 H .23 L .28 .27 L .47 .69 L .48 .83 H .15 L 0 .43 L -.15 .83 H -.48 L -.47 .69 L -.28 .27 Z M -.23 -.12 L -.5 -.31 Q -.7 -.49 -.79 -.3 Q -.84 -.2 -.68 -.06 L -.28 .23 M .23 -.12 L .51 -.3 Q .71 -.46 .8 -.28 Q .84 -.18 .69 -.06 L .28 .23 M -.13 -.04 H .13 V .18 H -.13 Z M -.25 .29 H .25 M -.44 .66 L -.22 .72 M .22 .72 L .44 .66',
  },
  saturn: {
    color: '#b6a0ff',
    lines: 'M -.51 0 a .51 .51 0 1 0 1.02 0 a .51 .51 0 1 0 -1.02 0 M -.85 .36 C -1.08 .1 .61 -.59 .88 -.34 C 1.1 -.1 -.61 .63 -.85 .36 Z M -.89 .22 C -.52 .5 .54 .04 .94 -.27 M -.29 -.27 Q -.1 -.42 .1 -.38 M -.16 .33 Q .04 .39 .22 .24',
  },
  pizza: {
    color: '#ff8b83',
    lines: 'M -.75 -.61 Q 0 -.95 .75 -.61 L .08 .87 Q 0 .99 -.08 .87 Z M -.68 -.45 Q 0 -.75 .68 -.45 M -.38 -.2 a .12 .12 0 1 0 .24 0 a .12 .12 0 1 0 -.24 0 M .14 -.1 a .12 .12 0 1 0 .24 0 a .12 .12 0 1 0 -.24 0 M -.1 .39 a .1 .1 0 1 0 .2 0 a .1 .1 0 1 0 -.2 0 M -.06 -.34 L .03 -.4 M -.18 .07 L -.12 .16 M .21 .18 L .26 .12',
  },
  hotdog: {
    color: '#ff8b83',
    lines: 'M -.88 .13 C -.97 -.15 .37 -.96 .7 -.64 Q .89 -.57 .89 -.4 M -.72 .63 Q -.67 .89 -.43 .77 L .83 .03 Q 1.02 -.12 .87 -.34 M -.77 .2 L .54 -.54 Q .71 -.62 .81 -.44 Q .92 -.26 .72 -.15 L -.59 .59 Q -.8 .72 -.91 .51 Q -1 .33 -.77 .2 Z M -.68 .35 Q -.49 .16 -.4 .26 Q -.3 .38 -.19 .12 Q -.08 -.11 .02 .02 Q .14 .16 .24 -.09 Q .35 -.31 .45 -.2 Q .56 -.08 .65 -.33',
  },
  hamburger: {
    color: '#f2f76c',
    lines: 'M -.84 -.12 C -.8 -.96 .8 -.96 .84 -.12 Z M -.47 -.38 L -.39 -.45 M -.12 -.58 L -.03 -.52 M .23 -.48 L .32 -.54 M .44 -.3 L .51 -.37 M -.87 .02 Q -.72 -.08 -.57 .05 Q -.42 .17 -.28 .04 Q -.14 -.08 .02 .06 Q .17 .17 .31 .04 Q .46 -.08 .61 .05 Q .76 .16 .87 .02 M -.79 .2 H .79 L .41 .42 L .09 .2 M -.82 .32 H -.2 M .6 .32 H .82 Q .97 .43 .82 .53 H -.82 Q -.97 .43 -.82 .32 M -.81 .62 H .81 Q .85 .94 .55 .96 H -.55 Q -.85 .94 -.81 .62 Z',
  },
};
const paths = new Map<RainObject, Path2D>();

export function paintNeonObject(context: CanvasRenderingContext2D, object: RainObject) {
  const art = OBJECT_ART[object];
  if (!paths.has(object)) paths.set(object, new Path2D(art.lines));
  const path = paths.get(object)!;
  const alpha = context.globalAlpha;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  // Three narrow strokes suggest a neon halo without a live blur filter.
  context.strokeStyle = art.color;
  context.lineWidth = .14;
  context.globalAlpha = alpha * .14;
  context.stroke(path);
  context.lineWidth = .045;
  context.globalAlpha = alpha;
  context.stroke(path);
  context.strokeStyle = '#fffef6';
  context.lineWidth = .013;
  context.globalAlpha = alpha * .85;
  context.stroke(path);
}
