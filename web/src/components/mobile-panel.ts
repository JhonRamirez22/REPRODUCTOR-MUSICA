import type { KeyboardEvent } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusMobilePanel(panel: HTMLElement): void {
  const initialControl = panel.querySelector<HTMLElement>('[data-panel-initial-focus]');
  (initialControl ?? panel).focus();
}

export function trapMobilePanelFocus(
  event: KeyboardEvent<HTMLElement>,
  panel: HTMLElement,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const controls = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  if (controls.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const focusedIndex = controls.indexOf(document.activeElement as HTMLElement);
  if (event.shiftKey && focusedIndex <= 0) {
    event.preventDefault();
    controls[controls.length - 1]?.focus();
  } else if (!event.shiftKey && (focusedIndex === controls.length - 1 || focusedIndex < 0)) {
    event.preventDefault();
    controls[0]?.focus();
  }
}
