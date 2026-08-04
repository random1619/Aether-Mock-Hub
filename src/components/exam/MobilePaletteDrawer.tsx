import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, Send, X } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { Button } from '@/components/ui';
import { QuestionPalette, PaletteLegend } from './QuestionPalette';

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

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Open question palette, on question ${currentIdx + 1} of ${total}`}
        className="md:hidden fixed bottom-20 right-5 z-overlay inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-[var(--shadow-glow)] hover:bg-primary-hover active:scale-95 transition-all"
      >
        <LayoutGrid size={18} />
        {currentIdx + 1}/{total}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="md:hidden fixed inset-0 z-modal"
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
              className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-2xl shadow-xl max-h-[72vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-surface border-b border-border">
                <h3 className="text-sm font-bold text-text">
                  {phase === 'submitted' ? 'Review' : 'Question Palette'}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close palette"
                  className="w-8 h-8 grid place-items-center rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors"
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
