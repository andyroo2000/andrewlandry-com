import { DEFAULT_VISUAL_MODE, visualModes, type VisualMode } from './synth-visual-types';

export function initVisualToggle(room: HTMLElement, onChange: (mode: VisualMode) => void, signal: AbortSignal) {
  const button = room.querySelector<HTMLButtonElement>('[data-change-visualization]')!;
  let index = visualModes.findIndex(mode => mode.id === DEFAULT_VISUAL_MODE);

  function updateLabel() {
    const current = visualModes[index];
    const next = visualModes[(index + 1) % visualModes.length];
    button.setAttribute('aria-label', `Change visualization, current: ${current.label}`);
    button.title = `Switch to ${next.label}`;
  }

  button.addEventListener('click', () => {
    index = (index + 1) % visualModes.length;
    onChange(visualModes[index].id);
    updateLabel();
  }, { signal });
  updateLabel();
}
