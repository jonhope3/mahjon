// ============================================================
// Modal — shared overlay shell (help, settings, hand card, …)
// ============================================================

import { useEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';

interface ModalProps {
  title: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  overlayClassName?: string;
  /** Default true. Help sets false so a mis-tap doesn’t dismiss. */
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  titleId = 'modal-title',
  onClose,
  children,
  footer,
  className = '',
  overlayClassName = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );

    const first = focusables()[0];
    (first ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose, closeOnEscape]);

  const onOverlayClick = () => {
    if (closeOnOverlayClick) onClose();
  };

  const stop = (e: MouseEvent) => e.stopPropagation();

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    // Prevent bubbling to overlays that might treat keys specially
    if (e.key === 'Escape' && closeOnEscape) e.stopPropagation();
  };

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={onOverlayClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`modal-content ${className}`.trim()}
        onClick={stop}
        onKeyDown={onPanelKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        {footer}
      </div>
    </div>
  );
}
