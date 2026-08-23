import { useState, useEffect, useCallback } from 'react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Shuffle,
  BookOpen,
  FileText,
  Zap,
} from 'lucide-react';
import { Modal, Button, SafeHtml } from '@/components/ui';
import type { SavedQuestionRecord } from '@/types';

export interface BookmarkFlashcardsModalProps {
  open: boolean;
  onClose: () => void;
  questions: (SavedQuestionRecord & { provider: string; subject: string })[];
  title?: string;
}

export function BookmarkFlashcardsModal({
  open,
  onClose,
  questions,
  title = 'Bookmark Flashcards',
}: BookmarkFlashcardsModalProps) {
  const [deck, setDeck] = useState<(SavedQuestionRecord & { provider: string; subject: string })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());

  // Initialize deck on open
  useEffect(() => {
    if (open && questions.length > 0) {
      setDeck([...questions]);
      setCurrentIndex(0);
      setFlipped(false);
      setMasteredIds(new Set());
      setReviewIds(new Set());
    }
  }, [open, questions]);

  const currentQ = deck[currentIndex];
  const progressPercent = deck.length > 0 ? Math.round(((currentIndex + 1) / deck.length) * 100) : 0;

  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  const handleMarkMastered = useCallback(() => {
    if (!currentQ) return;
    setMasteredIds((prev) => new Set([...prev, currentQ.id]));
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
    handleNext();
  }, [currentQ, handleNext]);

  const handleMarkReview = useCallback(() => {
    if (!currentQ) return;
    setReviewIds((prev) => new Set([...prev, currentQ.id]));
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.delete(currentQ.id);
      return next;
    });
    handleNext();
  }, [currentQ, handleNext]);

  const handleShuffle = () => {
    setFlipped(false);
    setDeck((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === '1') {
        e.preventDefault();
        handleMarkReview();
      } else if (e.key === '2') {
        e.preventDefault();
        handleMarkMastered();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleFlip, handleNext, handlePrev, handleMarkMastered, handleMarkReview]);

  if (!open || !deck.length || !currentQ) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      panelClassName="overflow-y-auto overscroll-contain bg-surface"
    >
      <div className="space-y-4" data-lenis-prevent>
        {/* Header & Progress Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary grid place-items-center">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">{title}</h2>
              <div className="text-xs text-muted">
                Card <span className="text-primary font-bold">{currentIndex + 1}</span> of {deck.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShuffle}
              className="p-2 rounded-lg bg-surface-2 text-muted hover:text-text text-xs flex items-center gap-1.5 transition-colors"
              title="Shuffle cards"
            >
              <Shuffle size={14} />
              <span className="hidden sm:inline">Shuffle</span>
            </button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>

        {/* Top Progress bar */}
        <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Score Counters */}
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-success font-semibold">
              <CheckCircle2 size={13} /> {masteredIds.size} Mastered
            </span>
            <span className="flex items-center gap-1 text-warning-fg font-semibold">
              <XCircle size={13} /> {reviewIds.size} Needs Review
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-muted/70">
            Shortcuts: [Space] Flip · [←/→] Prev/Next · [1] Review · [2] Mastered
          </span>
        </div>

        {/* Interactive Flashcard Container */}
        <div
          onClick={handleFlip}
          className={`min-h-[320px] sm:min-h-[380px] p-5 sm:p-7 rounded-2xl border cursor-pointer transition-all duration-300 relative flex flex-col justify-between select-none ${
            flipped
              ? 'bg-surface-2/90 border-primary/40 shadow-md'
              : 'bg-surface border-border hover:border-primary/50 shadow-sm'
          }`}
        >
          {/* Top Card Meta */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-soft text-primary text-[10px] sm:text-xs font-bold">
                {currentQ.provider}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface text-text-2 text-[10px] sm:text-xs font-semibold border border-border/60">
                {currentQ.subject}
              </span>
              <span className="text-[11px] text-muted truncate max-w-[200px] hidden sm:inline">
                {currentQ.examName}
              </span>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface border border-border text-muted">
              <RotateCw size={11} className={flipped ? 'rotate-180 transition-transform' : ''} />
              <span>{flipped ? 'Showing Answer' : 'Click to Flip'}</span>
            </div>
          </div>

          {/* Card Body */}
          <div className="my-auto py-2">
            {!flipped ? (
              /* FRONT: Question & Passage */
              <div className="space-y-4">
                {currentQ.comp && (
                  <div className="p-3 rounded-xl bg-surface-2 text-xs border border-border text-text-2 max-h-36 overflow-y-auto">
                    <div className="font-bold text-muted uppercase text-[10px] mb-1">Passage</div>
                    <SafeHtml html={currentQ.comp} />
                  </div>
                )}
                <div className="text-base sm:text-lg font-semibold text-text leading-relaxed">
                  <SafeHtml html={currentQ.question} />
                </div>

                {/* Question options sneak peek */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 opacity-80">
                  {currentQ.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs flex items-center gap-2 text-text"
                    >
                      <span className="w-5 h-5 rounded-full bg-surface text-[10px] font-bold grid place-items-center shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="truncate flex-1 min-w-0">
                        <SafeHtml html={opt} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* BACK: Solution, Correct Option, Notes */
              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-success">
                    Correct Option: {String.fromCharCode(65 + currentQ.correct_option_id)}
                  </div>
                  <div className="p-3 rounded-xl bg-success-soft/70 border border-success/40 text-text font-medium text-sm">
                    <SafeHtml html={currentQ.options[currentQ.correct_option_id] || ''} />
                  </div>
                </div>

                {currentQ.solution && (
                  <div className="p-3.5 rounded-xl bg-surface border border-border text-xs max-h-48 overflow-y-auto">
                    <div className="font-bold text-muted uppercase text-[10px] mb-1.5 flex items-center gap-1">
                      <BookOpen size={11} /> Step-by-Step Solution
                    </div>
                    <div className="text-text leading-relaxed">
                      <SafeHtml html={currentQ.solution} />
                    </div>
                  </div>
                )}

                {currentQ.notes && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <div className="font-bold text-amber-400 uppercase text-[10px] mb-1 flex items-center gap-1">
                      <FileText size={11} /> Personal Note
                    </div>
                    <p className="text-text">{currentQ.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Card Footer hint */}
          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted">
            <span>Question {currentQ.questionIdx + 1}</span>
            <span className="font-medium">
              {flipped ? 'Press [Space] to flip back' : 'Press [Space] to reveal answer'}
            </span>
          </div>
        </div>

        {/* Controls and Feedback buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<ChevronLeft size={16} />}
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex-1 sm:flex-none"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="md"
              rightIcon={<ChevronRight size={16} />}
              onClick={handleNext}
              disabled={currentIndex === deck.length - 1}
              className="flex-1 sm:flex-none"
            >
              Next
            </Button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              leftIcon={<XCircle size={15} className="text-warning-fg" />}
              onClick={handleMarkReview}
              className="flex-1 sm:flex-none border-warning/40 text-warning-fg hover:bg-warning-soft"
            >
              Need Practice
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<CheckCircle2 size={15} />}
              onClick={handleMarkMastered}
              className="flex-1 sm:flex-none bg-success hover:bg-success/90"
            >
              Mastered
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
