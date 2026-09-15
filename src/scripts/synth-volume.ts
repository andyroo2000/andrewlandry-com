import type { SynthPlayer } from './synth-youtube';

export function initSynthVolume(slider: HTMLInputElement, readPlayer: () => SynthPlayer | undefined, signal: AbortSignal) {
  function describeVolume() {
    slider.setAttribute('aria-valuetext', Number(slider.value) === 0 ? 'Muted' : `${slider.value}%`);
  }
  slider.addEventListener('input', () => {
    const player = readPlayer();
    if (!player) return;
    const volume = Number(slider.value);
    player.setVolume(volume);
    if (volume > 0) player.unMute();
    describeVolume();
  }, { signal });

  return () => {
    const player = readPlayer();
    if (!player) return;
    slider.disabled = false;
    // Don't fight an in-progress drag with a delayed response from the iframe.
    if (document.activeElement === slider) return;
    slider.value = String(player.isMuted() ? 0 : player.getVolume());
    describeVolume();
  };
}
