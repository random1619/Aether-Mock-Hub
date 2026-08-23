import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

interface ViolationOverlayProps {
  /** Accessible dialog name (aria-label). */
  label: string;
  title: string;
  body: ReactNode;
  actionLabel: string;
  actionIcon: ReactNode;
  onAction: () => void;
}

/**
 * Blocking integrity-violation dialog. Focus moves to the action button on
 * mount, Tab is trapped inside, and focus is restored on dismiss — matching
 * the shared Modal's behavior so keyboard/AT users must acknowledge it.
 */
export function ViolationOverlay({ label, title, body, actionLabel, actionIcon, onAction }: ViolationOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    lastFocused.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
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
    return () => {
      document.removeEventListener('keydown', onKey, true);
      lastFocused.current?.focus?.();
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-toast flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      } as any}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md mx-4 border border-warning/40 bg-tcs-panel p-6 rounded-sm shadow-xl text-center"
      >
        <div className="w-12 h-12 mx-auto mb-4 grid place-items-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-lg font-extrabold text-tcs-text mb-1.5 tracking-tight">{title}</h2>
        <p className="text-xs text-tcs-muted mb-5 leading-relaxed">{body}</p>
        <Button
          variant="primary"
          size="md"
          fullWidth
          leftIcon={actionIcon}
          onClick={onAction}
          className="font-bold uppercase tracking-wide"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
