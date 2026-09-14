import { visualModes, type VisualMode } from './synth-visual-types';

export function initVisualPicker(room: HTMLElement, onChange: (mode: VisualMode) => void, signal: AbortSignal) {
  const select = room.querySelector<HTMLSelectElement>('[data-visual-mode]')!;
  const description = room.querySelector<HTMLElement>('[data-visual-description]')!;
  const options = { signal };

  function selectMode() {
    const mode = visualModes.find(item => item.id === select.value);
    if (!mode) return;
    description.textContent = mode.description;
    onChange(mode.id);
  }

  select.addEventListener('change', selectMode, options);
  room.querySelectorAll<HTMLButtonElement>('[data-visual-step]').forEach(button => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.visualStep);
      select.selectedIndex = (select.selectedIndex + direction + select.options.length) % select.options.length;
      selectMode();
    }, options);
  });
}
