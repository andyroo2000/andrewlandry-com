export async function prepareMuxPlayers() {
  if (document.querySelector('mux-player')) await import('@mux/mux-player');
}
