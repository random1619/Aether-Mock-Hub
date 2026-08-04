import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Eye, CheckCircle2, XCircle, Bookmark, BookmarkCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useExamStore } from '@/stores/examStore';
import { SafeHtml, Button } from '@/components/ui';
import { CollapsiblePassage } from './CollapsiblePassage';
import { reviewStatus } from '@/lib/scoring';
import {
  isSavedQuestion,
  toggleSaveQuestion,
  markSavedQuestionReviewed,
} from '@/services/attemptStore';

import { buildQuestionHtml, downloadQuestionHtml, questionFilename } from '@/lib/exportQuestion';

/* Some vendors (360 Mocks) ship options that are themselves just the
   letter "A"–"D" — the option chip already conveys that, so rendering
   the text too would be redundant ("A. A"). Detect + suppress it. */
const isLetterOnly = (html: string): boolean => /^[A-Da-d]$/.test(html.replace(/<[^>]*>/g, '').trim());

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function optionsAreShort(options: string[]): boolean {
  return (
    options.length > 1 &&
    options.every((o) => {
      const text = o.replace(/<[^>]*>/g, '').trim();
      return text.length <= 60 && !/<(img|table|ul|ol|p|div|math)/i.test(o);
    })
  );
}

/** TCS-style question card — flat panels, "Question No. X" header row, plain radios. */
export function QuestionCard() {
  const questions = useExamStore((s) => s.questions);
  const currentIdx = useExamStore((s) => s.currentIdx);
  // Post-submit, `answers` becomes the re-attempt working copy; what the user
  // actually submitted is frozen in submittedAnswers. In re-attempt mode the
  // radio must reflect the live working copy (s.answers); otherwise the frozen
  // submitted set is shown and re-attempting appears unresponsive. The review
  // highlights / status chip below stay gated on `isSubmitted && !reattemptMode`,
  // so they never leak the working copy into the submitted review.
  const answers = useExamStore((s) => (s.reattemptMode ? s.answers : (s.submittedAnswers ?? s.answers)));
  const flags = useExamStore((s) => s.flags);
  const phase = useExamStore((s) => s.phase);
  const lang = useExamStore((s) => s.lang);
  const meta = useExamStore((s) => s.meta);
  const reattemptMode = useExamStore((s) => s.reattemptMode);
  const revealedSolutions = useExamStore((s) => s.revealedSolutions);
  const selectOption = useExamStore((s) => s.selectOption);
  const revealSolution = useExamStore((s) => s.revealSolution);
  const optionOrder = useExamStore((s) => s.optionOrder);
  const optionsShuffled = useExamStore((s) => s.optionsShuffled);

  const [saved, setSaved] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const q = questions[currentIdx];
  const isSubmitted = phase === 'submitted';

  /* Re-evaluate bookmark state when question changes */
  useEffect(() => {
    if (meta) setSaved(isSavedQuestion(meta.path, currentIdx));
  }, [meta, currentIdx]);

  /* Mark "reviewed" when a saved question is revisited post-submit */
  useEffect(() => {
    if (isSubmitted && meta && isSavedQuestion(meta.path, currentIdx)) {
      markSavedQuestionReviewed(meta.path, currentIdx);
    }
  }, [isSubmitted, meta, currentIdx]);

  // Recompute bookmark state on save toggle
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const onToggleSave = () => {
    if (!meta || !q) return;
    const nowSaved = toggleSaveQuestion(meta.path, meta.name, meta.provider, {
      questionIdx: currentIdx,
      question: q.question,
      comp: q.comp,
      options: q.options,
      correct_option_id: q.correct_option_id,
      solution: q.solution,
      marks: q.marks,
    });
    setSaved(nowSaved);
    setSavedToast(nowSaved ? 'Saved to bookmarks' : 'Removed from bookmarks');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedToast(null), 1800);

    // Also produce a standalone HTML export for offline reference.
    const filename = questionFilename(meta, currentIdx);
    const html = buildQuestionHtml({
      meta,
      idx: currentIdx,
      q,
      chosen: answers[currentIdx],
      flagged: flags.has(currentIdx),
      lang: 'both',
    });
    // Only auto-download when *saving*, not when *unsaving*.
    if (nowSaved) downloadQuestionHtml(filename, html);
  };

  const onDownloadHtml = () => {
    if (!meta || !q) return;
    downloadQuestionHtml(
      questionFilename(meta, currentIdx),
      buildQuestionHtml({
        meta,
        idx: currentIdx,
        q,
        chosen: answers[currentIdx],
        flagged: flags.has(currentIdx),
        lang: 'both',
      }),
    );
  };

  if (!q) return null;

  // Re-attempt unticked = review mode: every solution shows automatically.
  // Ticked = re-attempt mode: solutions stay hidden behind a "View Solution"
  // click per question (revealing also locks that question's answer — the
  // selectOption guard consults the same revealedSolutions set).
  const revealed = !reattemptMode || revealedSolutions.has(currentIdx);
  const interactive = !isSubmitted || (reattemptMode && !revealed);
  const status = isSubmitted ? reviewStatus(currentIdx, questions, answers) : null;
  const userAns = answers[currentIdx];

  /* Active phase displays the shuffled permutation (anti-cheat); review
     always falls back to the canonical order. Answers are stored in
     ORIGINAL index space, so selection/highlight map through `displayOrder`. */
  const displayOrder: number[] =
    !isSubmitted && optionsShuffled && optionOrder[currentIdx]
      ? optionOrder[currentIdx]
      : q.options.map((_, i) => i);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIdx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className="border border-tcs-border rounded-lg overflow-hidden shadow-sm"
      >
        {/* TCS "Question No. X" header */}
        <div className="flex items-stretch border-b border-tcs-border bg-tcs-panel">
          <div
            data-question-heading
            tabIndex={-1}
            className="flex items-center px-4 py-2 bg-tcs-notvisited text-white font-bold text-[13px] tracking-wide"
            style={{ minWidth: 120 }}
          >
            Question No. {currentIdx + 1}
          </div>
          <div className="flex-1 flex items-center justify-end gap-3 px-4 text-[11px] text-tcs-muted">
            {q.marks !== undefined && (
              <span>
                Marks: <span className="text-tcs-text font-bold">+{q.marks}</span>
                <span className="ml-1 text-notanswered">−{(q.marks * 0.25).toFixed(2)}</span>
              </span>
            )}
            <span>
              Question {currentIdx + 1} of {questions.length}
            </span>
            {isSubmitted && status && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  status === 'correct' && 'bg-answered/20 text-answered',
                  status === 'incorrect' && 'bg-notanswered/20 text-notanswered',
                  status === 'unattempted' && 'bg-notvisited/20 text-muted',
                )}
              >
                {status === 'correct' && <CheckCircle2 size={11} />}
                {status === 'incorrect' && <XCircle size={11} />}
                {status}
              </span>
            )}

            {/* Save-question actions */}
            <button
              onClick={onToggleSave}
              aria-label={saved ? 'Remove bookmark' : 'Bookmark this question'}
              aria-pressed={saved}
              title={saved ? 'Saved to bookmarks' : 'Save to bookmarks (also downloads HTML)'}
              className={clsx(
                'inline-grid place-items-center w-6 h-6 rounded-sm border transition-colors',
                saved
                  ? 'bg-marked/25 border-marked text-marked'
                  : 'border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2',
              )}
            >
              {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            </button>
            <button
              onClick={onDownloadHtml}
              aria-label="Download question as HTML"
              title="Save question to a standalone .html file"
              className="inline-grid place-items-center w-6 h-6 rounded-sm border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors text-[10px] font-bold"
            >
              .html
            </button>
          </div>
        </div>

        {/* Question body */}
        <div className="p-5 sm:p-6 bg-surface">
          {q.comp && <CollapsiblePassage html={q.comp} lang={lang} />}

          <div className="mb-5 text-base leading-relaxed">
            <SafeHtml html={q.question} lang={lang} />
          </div>

          {/* Options. ArrowUp/Down move the selection per the radiogroup
              contract (Left/Right are question navigation at the page level). */}
          <div
            className={clsx(
              'gap-2',
              optionsAreShort(q.options)
                ? 'grid grid-cols-1 sm:grid-cols-2'
                : 'flex flex-col',
            )}
            role="radiogroup"
            aria-label="Answer options"
            onKeyDown={(e) => {
              if (!interactive || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
              e.preventDefault();
              const dir = e.key === 'ArrowDown' ? 1 : -1;
              const len = displayOrder.length;
              const cur = userAns !== undefined ? displayOrder.indexOf(userAns) : -1;
              const nextIdx = cur === -1 ? (dir === 1 ? 0 : len - 1) : (cur + dir + len) % len;
              selectOption(currentIdx, displayOrder[nextIdx]);
              e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[nextIdx]?.focus();
            }}
          >
            {displayOrder.map((origIdx, displayIdx) => {
              const opt = q.options[origIdx];
              const isSelected = userAns === origIdx;
              const isCorrect = q.correct_option_id === origIdx;
              const showReview = isSubmitted && !reattemptMode;

              return (
                <button
                  key={origIdx}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!interactive}
                  onClick={() => interactive && selectOption(currentIdx, origIdx)}
                  className={clsx(
                    'group/opt flex items-start gap-3 w-full text-left px-3.5 py-2.5 rounded-md border transition-all duration-150',
                    interactive && 'cursor-pointer hover:bg-tcs-panel hover:border-border-strong',
                    !interactive && 'cursor-default',
                    !showReview && isSelected && 'border-primary bg-primary-soft shadow-sm',
                    !showReview && !isSelected && 'border-tcs-border bg-transparent',
                    showReview && isCorrect && 'border-answered bg-answered/10',
                    showReview && !isCorrect && isSelected && 'border-notanswered bg-notanswered/10',
                    showReview && !isCorrect && !isSelected && 'border-tcs-border opacity-75',
                  )}
                >
                  {/* Radio-dot with letter chip */}
                  <span
                    aria-hidden
                    className={clsx(
                      'mt-0.5 shrink-0 w-[18px] h-[18px] rounded-full border-2 grid place-items-center transition-colors',
                      !showReview && isSelected && 'border-primary bg-primary',
                      !showReview && !isSelected && 'border-border-strong group-hover/opt:border-muted',
                      showReview && isCorrect && 'border-answered bg-answered',
                      showReview && !isCorrect && isSelected && 'border-notanswered bg-notanswered',
                      showReview && !isCorrect && !isSelected && 'border-border-strong',
                    )}
                  >
                    {((!showReview && isSelected) || (showReview && (isCorrect || isSelected))) && (
                      <motion.span
                        layout
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className="w-1.5 h-1.5 rounded-full bg-white"
                      />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-sm leading-relaxed">
                    <span className="font-bold text-tcs-muted mr-1.5">{LETTERS[displayIdx] || displayIdx + 1}.</span>
                    {!isLetterOnly(opt) && <SafeHtml html={opt} lang={lang} />}
                  </span>
                  {showReview && isCorrect && <CheckCircle2 size={16} className="text-answered shrink-0 mt-0.5" />}
                  {showReview && !isCorrect && isSelected && <XCircle size={16} className="text-notanswered shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Solution */}
          {isSubmitted && (
            <div className="mt-5 pt-4 border-t border-tcs-border">
              {!revealed ? (
                <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => revealSolution(currentIdx)}>
                  View Solution
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-tcs-panel border border-tcs-border"
                >
                  <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                    <Lightbulb size={14} />
                    Solution &amp; Explanation
                  </div>
                  <SafeHtml html={q.solution || 'No explanation available.'} lang={lang} />
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Bookmark toast */}
        <AnimatePresence>
          {savedToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="px-3 py-1.5 text-[11px] font-semibold bg-tcs-marked/20 border-b border-tcs-marked/40 text-tcs-text flex items-center gap-1.5"
            >
              <BookmarkCheck size={11} />
              {savedToast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
