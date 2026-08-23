import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Eye, CheckCircle2, XCircle, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
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
  getBookmarkFolders,
  createBookmarkFolder,
} from '@/services/attemptStore';
import { BookmarkCategoryPicker } from './BookmarkCategoryPicker';
import type { BookmarkFolder } from '@/types';
import { haptic } from '@/services/nativeMobile';

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
  const questionTimes = useExamStore((s) => s.questionTimes);
  const activeAttempt = useExamStore((s) => s.activeAttempt);
  const allAttempts = useExamStore((s) => s.allAttempts);
  const switchReviewAttempt = useExamStore((s) => s.switchReviewAttempt);

  const [saved, setSaved] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);

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
  const persistBookmark = (folderId?: string) => {
    if (!meta || !q) return;
    const nowSaved = toggleSaveQuestion(meta.path, meta.name, meta.provider, {
      questionIdx: currentIdx,
      question: q.question,
      comp: q.comp,
      options: q.options,
      correct_option_id: q.correct_option_id,
      solution: q.solution,
      marks: q.marks,
    }, folderId);
    setSaved(nowSaved);
    haptic.tap();
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

  const onToggleSave = () => {
    if (!meta || !q) return;
    if (saved) {
      persistBookmark();
      return;
    }
    setFolders(getBookmarkFolders());
    setCategoryPickerOpen(true);
  };

  const onConfirmCategory = (folderId: string) => {
    setCategoryPickerOpen(false);
    persistBookmark(folderId);
  };

  const onCreateCategory = (name: string): BookmarkFolder | undefined => {
    const folder = createBookmarkFolder(name);
    setFolders(getBookmarkFolders());
    return folder;
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
  // Use submittedAnswers if available (post-submit review) otherwise fall back to answers
  const userAns = isSubmitted
    ? (useExamStore.getState().submittedAnswers?.[currentIdx] ?? answers[currentIdx])
    : answers[currentIdx];



  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIdx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="border border-tcs-border/60 rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] bg-surface"
      >
        {/* Impeccable question header — subtle inner highlight */}
        <div className="flex items-center justify-between border-b border-tcs-border/60 bg-gradient-to-b from-tcs-panel to-tcs-panel-2/50 px-3 sm:px-5 py-2.5 sm:py-3 gap-2 select-none">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div
              data-question-heading
              tabIndex={-1}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-tcs-text text-tcs-panel font-extrabold text-xs tracking-wide shrink-0 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
              Question {currentIdx + 1}
            </div>
            {q.marks !== undefined && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tcs-muted whitespace-nowrap bg-surface-2 px-2 py-1 rounded-full">
                <span className="text-answered font-bold">+{q.marks}</span>
                <span className="w-px h-3 bg-tcs-border" aria-hidden />
                <span className="text-notanswered font-bold">−{(q.marks * 0.25).toFixed(2)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSubmitted && status && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full',
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
            {isSubmitted && (questionTimes[currentIdx] || 0) > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-tcs-muted bg-surface-2 px-2 py-0.5 rounded-full border border-tcs-border/60">
                <Clock size={10} /> {questionTimes[currentIdx]}s
              </span>
            )}
            <button
              onClick={onToggleSave}
              aria-label={saved ? 'Remove bookmark' : 'Bookmark this question'}
              aria-pressed={saved}
              title={saved ? 'Saved to bookmarks' : 'Save to bookmarks (also downloads HTML)'}
              className={clsx(
                'inline-grid place-items-center w-11 h-11 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg border transition-colors active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                saved
                  ? 'bg-marked/25 border-marked text-marked'
                  : 'border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2',
              )}
            >
              {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>
            <button
              onClick={onDownloadHtml}
              aria-label="Download question as HTML"
              title="Save question to a standalone .html file"
              className="hidden sm:inline-grid place-items-center w-6 h-6 rounded-sm border border-tcs-border text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2 transition-colors text-[10px] font-bold"
            >
              .html
            </button>
          </div>
        </div>

        {/* Question body */}
        <div className="p-3.5 sm:p-6 bg-surface">
          {q.comp && <CollapsiblePassage html={q.comp} lang={lang} />}

          <div className="mb-4 sm:mb-5 text-sm sm:text-base leading-relaxed">
            <SafeHtml html={q.question} lang={lang} />
          </div>

          {/* Options. ArrowUp/Down move the selection per the radiogroup
              contract (Left/Right are question navigation at the page level). */}
          <div
            className={clsx(
              'gap-2.5 sm:gap-2',
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
              const len = q.options.length;
              const cur = userAns !== undefined ? userAns : -1;
              const nextIdx = cur === -1 ? (dir === 1 ? 0 : len - 1) : (cur + dir + len) % len;
              selectOption(currentIdx, nextIdx);
              e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[nextIdx]?.focus();
            }}
          >
            {q.options.map((opt, optIdx) => {
              const isSelected = userAns === optIdx;
              const isCorrect = q.correct_option_id === optIdx;
              const showReview = isSubmitted && !reattemptMode;
              const letter = LETTERS[optIdx] || String(optIdx + 1);

              return (
                <button
                  key={optIdx}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!interactive}
                  onClick={() => {
                    if (interactive) {
                      selectOption(currentIdx, optIdx);
                      haptic.selection();
                    }
                  }}
                  className={clsx(
                    'group/opt flex items-center gap-3 w-full text-left p-3.5 sm:py-2.5 sm:px-3 rounded-xl sm:rounded-lg border transition-all duration-150 min-h-[56px] sm:min-h-0 select-none active:scale-[0.98] touch-manipulation',
                    interactive && 'cursor-pointer hover:bg-tcs-panel hover:border-border-strong active:bg-tcs-panel',
                    !interactive && 'cursor-default',
                    !showReview && isSelected && 'border-primary bg-primary-soft shadow-[0_0_0_1.5px_var(--primary)]',
                    !showReview && !isSelected && 'border-tcs-border bg-surface-2/40 hover:bg-surface-2',
                    showReview && isCorrect && 'border-answered bg-answered/12 shadow-[0_0_0_1px_var(--answered)]',
                    showReview && !isCorrect && isSelected && 'border-notanswered bg-notanswered/12 shadow-[0_0_0_1px_var(--notanswered)]',
                    showReview && !isCorrect && !isSelected && 'border-tcs-border opacity-70 bg-transparent',
                  )}
                >
                  {/* Distinct Letter Badge */}
                  <span
                    aria-hidden
                    className={clsx(
                      'shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-full font-bold text-xs grid place-items-center transition-all duration-150',
                      !showReview && isSelected && 'bg-primary text-white scale-105 shadow-xs',
                      !showReview && !isSelected && 'bg-surface-2 text-text-2 border border-border-strong/60 group-hover/opt:border-primary group-hover/opt:text-primary',
                      showReview && isCorrect && 'bg-answered text-white scale-105 shadow-xs',
                      showReview && !isCorrect && isSelected && 'bg-notanswered text-white scale-105 shadow-xs',
                      showReview && !isCorrect && !isSelected && 'bg-surface-2 text-muted border border-tcs-border',
                    )}
                  >
                    {letter}
                  </span>

                  <span className="flex-1 min-w-0 text-sm sm:text-[14px] leading-relaxed font-medium text-text">
                    {!isLetterOnly(opt) ? <SafeHtml html={opt} lang={lang} /> : `Option ${letter}`}
                  </span>

                  {showReview && isCorrect && isSelected && (
                    <span className="hidden sm:inline-flex text-[11px] font-bold text-answered bg-answered/15 px-2 py-0.5 rounded-full items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} /> Correct (Your Answer)
                    </span>
                  )}
                  {showReview && isCorrect && !isSelected && (
                    <span className="hidden sm:inline-flex text-[11px] font-bold text-answered bg-answered/15 px-2 py-0.5 rounded-full items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} /> Correct Answer
                    </span>
                  )}
                  {showReview && !isCorrect && isSelected && (
                    <span className="hidden sm:inline-flex text-[11px] font-bold text-notanswered bg-notanswered/15 px-2 py-0.5 rounded-full items-center gap-1 shrink-0">
                      <XCircle size={12} /> Your Answer (Incorrect)
                    </span>
                  )}
                  {showReview && isCorrect && <CheckCircle2 size={18} className="text-answered sm:hidden shrink-0" />}
                  {showReview && !isCorrect && isSelected && <XCircle size={18} className="text-notanswered sm:hidden shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Question-level multi-attempt comparison */}
          {isSubmitted && allAttempts.length > 1 && (
            <div className="mt-4 p-3 rounded-xl bg-surface-2/60 border border-tcs-border/60">
              <div className="flex items-center justify-between text-[11px] font-bold text-tcs-muted mb-2">
                <span>History on Question {currentIdx + 1} across attempts:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {allAttempts.map((att) => {
                  const rec = att.perQuestion?.find((p) => p.idx === currentIdx);
                  const isCurrent = (activeAttempt?.attemptNumber ?? allAttempts[allAttempts.length - 1]?.attemptNumber) === att.attemptNumber;
                  const chosenLetter = rec && typeof rec.chosen === 'number' && rec.chosen >= 0 ? LETTERS[rec.chosen] || String(rec.chosen + 1) : null;

                  return (
                    <button
                      key={att.attemptNumber}
                      type="button"
                      onClick={() => switchReviewAttempt(att.attemptNumber)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer select-none active:scale-95',
                        isCurrent
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40 font-bold'
                          : 'border-tcs-border bg-surface text-tcs-muted hover:text-tcs-text hover:bg-surface-2'
                      )}
                      title={`Switch review to Attempt #${att.attemptNumber}`}
                    >
                      <span>Att #{att.attemptNumber}:</span>
                      {rec?.isCorrect ? (
                        <span className="text-answered font-bold flex items-center gap-0.5">
                          <CheckCircle2 size={11} /> Opt {chosenLetter} (✓)
                        </span>
                      ) : rec?.isIncorrect ? (
                        <span className="text-notanswered font-bold flex items-center gap-0.5">
                          <XCircle size={11} /> Opt {chosenLetter} (✗)
                        </span>
                      ) : (
                        <span className="text-muted italic">Skipped</span>
                      )}
                      {isCurrent && <span className="text-[9px] uppercase px-1 rounded bg-primary text-white font-extrabold ml-0.5">Viewing</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
      <BookmarkCategoryPicker
        open={categoryPickerOpen}
        questionNumber={currentIdx + 1}
        folders={folders}
        onClose={() => setCategoryPickerOpen(false)}
        onConfirm={onConfirmCategory}
        onCreateFolder={onCreateCategory}
      />
    </AnimatePresence>
  );
}
