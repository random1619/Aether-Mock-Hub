import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, Send, X } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { Button } from '@/components/ui';
import { QuestionPalette, PaletteLegend } from './QuestionPalette';
import { registerBackHandler } from '@/services/nativeMobile';

/**
 * Mobile question palette: a floating action button opens a slide-up drawer.
 * Desktop uses the persistent sidebar; this is the <lg equivalent. Post-submit
 * it also provides the only mobile path back to the result summary.
 */
export function MobilePaletteDrawer({ onShowSummary }: { onShowSummary?: () => void }) {
  const [open, setOpen] = useState(false);
  const phase = useExamStore((s) => s.phase);
  const currentIdx = useExamStore((s) => s.currentIdx);
  const total = useExamStore((s) => s.questions.length);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const focusPanel = () => panelRef.current?.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')?.focus();
    const focusTimer = window.setTimeout(focusPanel, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const unregister = registerBackHandler(() => {
      setOpen(false);
      return true;
    });
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey, true);
      unregister();
      lastFocused.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      {/* Floating trigger — sits comfortably above the 2-tier bottom action controls */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Open question palette, on question ${currentIdx + 1} of ${total}`}
        className="md:hidden fixed right-3.5 z-overlay inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white font-extrabold text-xs shadow-lg hover:bg-primary-hover active:scale-90 transition-all select-none border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        style={{ bottom: 'calc(9.25rem + env(safe-area-inset-bottom, 0px))' } as any}
      >
        <LayoutGrid size={15} />
        <span>{currentIdx + 1}/{total}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="md:hidden fixed inset-0 z-modal"
            style={{ zIndex: 1000 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'var(--overlay)', backdropFilter: 'blur(4px)' }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Question palette"
              ref={panelRef}
              className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-[24px] shadow-xl max-h-[min(82dvh,720px)] overflow-y-auto will-change-transform overscroll-contain"
              style={{
                touchAction: 'pan-y',
                paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
              } as any}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.22}
              onDragEnd={(_, info) => {
                if (info.velocity.y > 480 || info.offset.y > 120) setOpen(false);
              }}
            >
              <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-surface border-b border-border">
                <h3 className="text-sm font-bold text-text">
                  {phase === 'submitted' ? 'Review' : 'Question Palette'}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close palette"
                  className="w-11 h-11 grid place-items-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5" onClick={(e) => {
                // Close after navigating via a palette button
                if ((e.target as HTMLElement).closest('button')) setOpen(false);
              }}>
                <QuestionPalette />
                {phase === 'active' && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <PaletteLegend />
                  </div>
                )}
                {phase === 'submitted' && onShowSummary && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      leftIcon={<Send size={13} />}
                      onClick={() => {
                        setOpen(false);
                        onShowSummary();
                      }}
                    >
                      View Summary
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
