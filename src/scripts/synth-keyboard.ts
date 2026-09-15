type PlaybackButtons = { listen: HTMLButtonElement; previous: HTMLButtonElement; next: HTMLButtonElement };

function ownsKey(target: EventTarget | null, key: string) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="slider"]')) return true;
  // Preserve native Space activation for the visualization button and links.
  const control = target.closest('button, a, [role="button"]');
  return key === ' ' && control && !control.matches('[data-listen], [data-previous-track], [data-next-track]');
}

export function initSynthKeyboard({ listen, previous, next }: PlaybackButtons, signal: AbortSignal) {
  const buttons: Record<string, HTMLButtonElement> = { ' ': listen, ArrowLeft: previous, ArrowRight: next };
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing) return;
    if ([event.altKey, event.ctrlKey, event.metaKey, event.shiftKey].some(Boolean)) return;
    const button = buttons[event.key];
    if (!button || ownsKey(event.target, event.key)) return;
    event.preventDefault();
    if (!event.repeat) button.click();
  }, { signal });
}
