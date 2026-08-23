import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { SPRING_MODAL } from '@/lib/motion';
import { registerBackHandler } from '@/services/nativeMobile';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  showClose?: boolean;
  /** Extra classes for the dialog panel (e.g. theme-specific card chrome). */
  panelClassName?: string;
}

/** Apple-fluid modal: interruptible spring, materialize blur+scale, Escape trap, anchored origin. */
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', showClose = true, panelClassName }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && focusables && focusables.length) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    const unregBack = registerBackHandler(() => {
      onClose();
      return true;
    });

    return () => {
      unregBack();
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-lenis-prevent
          className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            zIndex: 1000,
            background: 'var(--overlay)',
            backdropFilter: 'blur(16px) saturate(160%)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          } as any}
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(16px) saturate(160%)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={reduce ? { duration: 0.15 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            data-lenis-prevent
            className={clsx(
              'w-full bg-bg-raised shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto will-change-transform overscroll-contain',
              'rounded-t-[20px] sm:rounded-2xl rounded-b-none sm:rounded-b-2xl',
              maxWidth,
              panelClassName,
            )}
            style={{ transformOrigin: '50% 38%', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } as any}
            initial={reduce ? { opacity: 0 } : { scale: 0.98, y: 24, opacity: 0, filter: 'blur(10px)' }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { scale: 0.98, y: 16, opacity: 0, filter: 'blur(6px)' }}
            transition={reduce ? { duration: 0.15 } as any : (SPRING_MODAL as any)}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <span className="w-9 h-1 rounded-full bg-border" aria-hidden />
            </div>
            {(title || showClose) && (
              <div className="flex items-center justify-between px-4 sm:px-6 pt-2 sm:pt-5 pb-2 sticky top-0 bg-bg-raised sm:bg-surface z-10 border-b sm:border-0 border-[var(--glass-border)]">
                <div className="text-lg font-bold text-text">{title}</div>
                {showClose && (
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="w-9 h-9 grid place-items-center rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
