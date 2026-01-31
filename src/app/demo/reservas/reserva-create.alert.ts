import Swal from 'sweetalert2';

export type AlertIcon = 'success' | 'error' | 'warning' | 'info';

export function showAlertWithFocusRestore(options: {
  title: string;
  text: string;
  icon: AlertIcon;
  shouldRestoreFocus?: () => boolean;
}): void {
  const active = (document?.activeElement as HTMLElement | null) ?? null;
  const shouldRestoreFocus = !!active && typeof active.focus === 'function';
  try {
    active?.blur?.();
  } catch {
    // ignore
  }

  Swal.fire({ title: options.title, text: options.text, icon: options.icon }).then(() => {
    if (!shouldRestoreFocus) return;
    if (!active?.isConnected) return;
    if (options.shouldRestoreFocus && !options.shouldRestoreFocus()) return;
    try {
      active.focus();
    } catch {
      // ignore
    }
  });
}

