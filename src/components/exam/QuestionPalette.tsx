import { memo } from 'react';
import { clsx } from 'clsx';
import { useExamStore } from '@/stores/examStore';
import { activeStatus, reviewStatus } from '@/lib/scoring';

/**
 * TCS iON convention for the per-question tile:
 *  - notvisited   → grey square, no number badge highlight
 *  - notanswered  → red square
 *  - answered     → green square
 *  - marked       → violet square
 *  - marked+answered → violet square with a small green dot in bottom-right
 * The currently-focused tile shows a green caret on the left (TCS convention).
 */
type TileStatus =
  | 'notvisited'
  | 'notanswered'
  | 'answered'
  | 'marked'
  | 'marked_answered'
  | 'correct'
  | 'incorrect'
  | 'unattempted';

const tileStyles: Record<TileStatus, string> = {
  notvisited: 'bg-tcs-notvisited text-white border-transparent',
  notanswered: 'bg-tcs-notanswered text-white border-transparent',
  answered: 'bg-tcs-answered text-white border-transparent',
  marked: 'bg-tcs-marked text-white border-transparent',
  marked_answered: 'bg-tcs-marked text-white border-transparent',
  // review tile colours
  correct: 'bg-tcs-answered text-white border-transparent',
  incorrect: 'bg-tcs-notanswered text-white border-transparent',
  unattempted: 'bg-tcs-notvisited text-white border-transparent',
};

const ha = 'data-tcs-active';

const PaletteButton = memo(function PaletteButton({
  idx,
  status,
  active,
  onSelect,
}: {
  idx: number;
  status: TileStatus;
  active: boolean;
  onSelect: (idx: number) => void;
}) {
  return (
    <button
      onClick={() => onSelect(idx)}
      aria-label={`Question ${idx + 1}, ${status.replaceAll('_', ' ')}`}
      aria-current={active ? 'true' : undefined}
      {...(active ? { [ha]: true } : {})}
      className={clsx(
        'relative aspect-square w-full grid place-items-center rounded-md text-[11px] font-bold',
        'transition-all duration-150 hover:scale-110 hover:shadow-md focus-visible:outline-none',
        'focus-visible:shadow-[0_0_0_2px_white,0_0_0_4px_rgba(51,154,240,0.95)]',
        tileStyles[status],
        active && 'ring-2 ring-white ring-offset-2 ring-offset-surface shadow-md',
      )}
      style={{ fontFamily: 'ui-sans-serif, system-ui' }}
    >
      {/* TCS caret: small green triangle on the active tile's left edge */}
      {active && (
        <span
          aria-hidden
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-l-[6px] border-y-transparent border-l-tcs-active-caret"
        />
      )}
      {idx + 1}
      {/* Answered + Marked gets a green dot bottom-right */}
      {status === 'marked_answered' && (
        <span
          aria-hidden
          className="absolute bottom-[2px] right-[2px] w-1.5 h-1.5 rounded-full bg-tcs-answer-dot border border-white"
        />
      )}
    </button>
  );
});

export function QuestionPalette() {
  const questions = useExamStore((s) => s.questions);
  const currentIdx = useExamStore((s) => s.currentIdx);
  // Review palette reflects submitted answers; but during a re-attempt the
  // palette should show the live working copy (s.answers), otherwise tiles
  // never update as the user re-answers.
  const answers = useExamStore((s) =>
    (s.phase === 'submitted' && !s.reattemptMode) ? (s.submittedAnswers ?? s.answers) : s.answers);
  const flags = useExamStore((s) => s.flags);
  const visited = useExamStore((s) => s.visited);
  const phase = useExamStore((s) => s.phase);
  const navigateTo = useExamStore((s) => s.navigateTo);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const reattemptMode = useExamStore((s) => s.reattemptMode);
  const meta = useExamStore((s) => s.meta);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);

  // Restrict palette to the current section when sectional + active
  let rangeStart = 0;
  let rangeEnd = questions.length - 1;
  if (isSectionalMode && phase === 'active' && meta) {
    const sec = meta.sections[currentSectionIdx];
    rangeStart = sec.start;
    rangeEnd = sec.end;
  }

  const visibleIndices: number[] = [];
  for (let i = rangeStart; i <= rangeEnd; i++) visibleIndices.push(i);

  return (
    <div
      className="grid grid-cols-5 gap-1.5 pl-2"
      role="group"
      aria-label="Question palette"
    >
      {visibleIndices.map((idx) => {
        let status: TileStatus;
        if (phase === 'submitted' && !reattemptMode) {
          status = reviewStatus(idx, questions, answers);
        } else {
          const base = activeStatus(idx, answers, flags, visited);
          if (base === 'marked' && answers[idx] !== undefined) status = 'marked_answered';
          else status = base;
        }
        return (
          <PaletteButton
            key={idx}
            idx={idx}
            status={status}
            active={idx === currentIdx}
            onSelect={navigateTo}
          />
        );
      })}
    </div>
  );
}

/** TCS iON palette legend — pill counters + labels, exactly the 5-row stack TCS uses. */
export function PaletteLegend() {
  const questions = useExamStore((s) => s.questions);
  const answers = useExamStore((s) => s.answers);
  const flags = useExamStore((s) => s.flags);
  const visited = useExamStore((s) => s.visited);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const meta = useExamStore((s) => s.meta);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);
  const phase = useExamStore((s) => s.phase);

  let rangeStart = 0;
  let rangeEnd = questions.length - 1;
  if (isSectionalMode && phase === 'active' && meta) {
    const sec = meta.sections[currentSectionIdx];
    rangeStart = sec.start;
    rangeEnd = sec.end;
  }

  let notVisited = 0,
    notAnswered = 0,
    answered = 0,
    marked = 0,
    answeredMarked = 0;
  for (let i = rangeStart; i <= rangeEnd; i++) {
    if (!visited.has(i)) notVisited++;
    else if (answers[i] !== undefined && flags.has(i)) answeredMarked++;
    else if (flags.has(i)) marked++;
    else if (answers[i] !== undefined) answered++;
    else notAnswered++;
  }

  const rows = [
    { label: 'Not Visited', count: notVisited, color: 'bg-tcs-notvisited' },
    { label: 'Not Answered', count: notAnswered, color: 'bg-tcs-notanswered' },
    { label: 'Answered', count: answered, color: 'bg-tcs-answered' },
    { label: 'Marked for Review', count: marked, color: 'bg-tcs-marked' },
    {
      label: 'Answered & Marked for Review (will be considered for evaluation)',
      count: answeredMarked,
      color: 'bg-tcs-marked',
      dot: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[11px] text-muted">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white relative',
              r.color,
            )}
          >
            {r.count}
            {r.dot && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-tcs-answer-dot border border-white" />
            )}
          </span>
          <span className="leading-tight">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
