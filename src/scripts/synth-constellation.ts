import { ink, seed, TAU, type Renderer, type Viewport, type VisualSettings } from './synth-visual-types';

type Star = { x: number; y: number; light: number; radius: number };

function starAt(index: number, size: Viewport, { time, depth, audio }: VisualSettings): Star {
  const angle = seed(index + 100) * TAU + time * .025;
  const sway = 12 + audio.bass * 34 * depth;
  return {
    x: seed(index) * size.width + Math.cos(angle) * sway,
    y: seed(index + 200) * size.height + Math.sin(angle * 1.3) * sway,
    light: .22 + seed(index + 300) * .4 + audio.high * .3,
    radius: .7 + seed(index + 400) * 1.2 + audio.high * 1.8 * depth,
  };
}

function connectStars(context: CanvasRenderingContext2D, stars: Star[], reach: number, mid: number) {
  for (let a = 0; a < stars.length; a++) {
    for (let b = a + 1; b < stars.length; b++) {
      const distance = Math.hypot(stars[a].x - stars[b].x, stars[a].y - stars[b].y);
      if (distance >= reach) continue;
      context.strokeStyle = ink((1 - distance / reach) * (.16 + mid * .35));
      context.beginPath();
      context.moveTo(stars[a].x, stars[a].y);
      context.lineTo(stars[b].x, stars[b].y);
      context.stroke();
    }
  }
}

export const drawConstellation: Renderer = (context, size, settings) => {
  const count = size.width < 760 ? 70 : 145;
  const stars = Array.from({ length: count }, (_, index) => starAt(index, size, settings));
  context.lineWidth = .8;
  connectStars(context, stars, 125 + settings.audio.mid * 85 * settings.depth, settings.audio.mid);
  for (const star of stars) {
    context.fillStyle = ink(star.light, true);
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, TAU);
    context.fill();
    context.strokeStyle = ink(star.light * .14);
    context.beginPath();
    context.arc(star.x, star.y, star.radius * 4, 0, TAU);
    context.stroke();
  }
};
