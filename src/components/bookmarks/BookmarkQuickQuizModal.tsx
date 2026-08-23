import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Zap,
  FileText,
} from 'lucide-react';
import { Modal, Button, SafeHtml } from '@/components/ui';
import type { SavedQuestionRecord } from '@/types';
import { updateSavedQuestion } from '@/services/attemptStore';

export interface BookmarkQuickQuizModalProps {
  open: boolean;
  onClose: () => void;
  question: (SavedQuestionRecord & { provider?: string; subject?: string }) | null;
}

export function BookmarkQuickQuizModal({
  open,
  onClose,
  question,
}: BookmarkQuickQuizModalProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedOption(null);
      setSubmitted(false);
    }
  }, [open, question]);

  if (!open || !question) return null;

  const isCorrect = selectedOption === question.correct_option_id;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setSubmitted(true);
    // Update question record
    updateSavedQuestion(question.id, {
      lastChosen: selectedOption,
      lastOutcome: isCorrect ? 'correct' : 'incorrect',
      timesReviewed: (question.timesReviewed || 0) + 1,
    });
  };

  const handleReset = () => {
    setSelectedOption(null);
    setSubmitted(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      panelClassName="overflow-y-auto overscroll-contain"
    >
      <div className="space-y-5" data-lenis-prevent>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary grid place-items-center">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Instant Question Drill</h2>
              <p className="text-xs text-muted">Test your recall on this saved question</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {question.provider && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text text-[11px] font-semibold">
                {question.provider}
              </span>
            )}
            {question.subject && (
              <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[11px] font-semibold">
                {question.subject}
              </span>
            )}
          </div>
        </div>

        {/* Passage if any */}
        {question.comp && (
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border text-xs text-text-2 max-h-40 overflow-y-auto">
            <div className="font-bold text-muted uppercase text-[10px] mb-1">Passage</div>
            <SafeHtml html={question.comp} />
          </div>
        )}

        {/* Question Text */}
        <div className="text-sm sm:text-base font-semibold text-text leading-relaxed">
          <SafeHtml html={question.question} />
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map((opt, idx) => {
            const isChosen = selectedOption === idx;
            const isRight = idx === question.correct_option_id;

            let borderCls = 'border-border bg-surface hover:bg-surface-2';
            if (submitted) {
              if (isRight) {
                borderCls = 'border-success bg-success-soft/70 ring-1 ring-success';
              } else if (isChosen && !isRight) {
                borderCls = 'border-danger bg-danger-soft/60 ring-1 ring-danger';
              }
            } else if (isChosen) {
              borderCls = 'border-primary bg-primary-soft/50 ring-1 ring-primary';
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={submitted}
                onClick={() => setSelectedOption(idx)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${borderCls}`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold grid place-items-center shrink-0 ${
                    submitted && isRight
                      ? 'bg-success text-white'
                      : submitted && isChosen
                        ? 'bg-danger text-white'
                        : isChosen
                          ? 'bg-primary text-white'
                          : 'bg-surface-2 text-text'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <div className="flex-1 min-w-0 text-sm text-text font-medium">
                  <SafeHtml html={opt} />
                </div>
                {submitted && isRight && <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />}
                {submitted && isChosen && !isRight && <XCircle size={16} className="text-danger-fg shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Result & Solution Section */}
        {submitted && (
          <div className="space-y-3 pt-2">
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
                isCorrect
                  ? 'bg-success-soft text-success-fg border-success/40'
                  : 'bg-danger-soft text-danger-fg border-danger/40'
              }`}
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Correct! Great job retaining this concept.</span>
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  <span>
                    Incorrect. The right option is {String.fromCharCode(65 + question.correct_option_id)}.
                  </span>
                </>
              )}
            </div>

            {question.solution && (
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border text-xs">
                <div className="font-bold text-muted uppercase text-[10px] mb-1.5 flex items-center gap-1">
                  <BookOpen size={11} /> Solution Explanation
                </div>
                <div className="text-text leading-relaxed max-h-48 overflow-y-auto">
                  <SafeHtml html={question.solution} />
                </div>
              </div>
            )}

            {question.notes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                <div className="font-bold text-amber-400 uppercase text-[10px] mb-1 flex items-center gap-1">
                  <FileText size={11} /> Your Notes
                </div>
                <p className="text-text">{question.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {submitted ? (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<RotateCcw size={14} />}
                onClick={handleReset}
              >
                Try Again
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                disabled={selectedOption === null}
                onClick={handleSubmit}
              >
                Check Answer
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
