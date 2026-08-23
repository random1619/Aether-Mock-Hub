import { clsx } from 'clsx';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { canAccessSection } from '@/services/cglPattern';

/**
 * TCS iON: subject tab strip just below the header.
 * Displays sectional lock indicators during active exams and
 * unlocks all sections post-submission.
 */
export function SectionTabs() {
  const meta = useExamStore((s) => s.meta);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const sectionalTimerEnabled = useExamStore((s) => s.sectionalTimerEnabled);
  const currentIdx = useExamStore((s) => s.currentIdx);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);
  const setCurrentSection = useExamStore((s) => s.setCurrentSection);
  const lockedSections = useExamStore((s) => s.lockedSections);
  const completedSections = useExamStore((s) => s.completedSections);
  const phase = useExamStore((s) => s.phase);

  if (!meta) return null;

  const sections = meta.sections.length > 1 ? meta.sections : null;
  const isSubmitted = phase === 'submitted';

  // Impeccable: precise 15-min blocks for Tier 1, with subtle progress indication
  const totalMins = meta.sections.reduce((s, sec) => s + (sec.durationMinutes || 15), 0);
  return (
    <div className="flex items-stretch bg-tcs-panel/80 backdrop-blur-xl border-b border-tcs-border/60 select-none shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="px-3 sm:px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-tcs-muted border-r border-tcs-border/60 flex items-center gap-1.5 shrink-0 bg-tcs-panel-2/50">
        <span className="w-1 h-1 rounded-full bg-primary" aria-hidden />
        {totalMins === 60 && meta.sections.length === 4 ? 'Tier 1 • 15m × 4' : `${totalMins}m • ${meta.sections.length} Sec`}
      </div>
      {sections ? (
        <div
          className="flex overflow-x-auto overscroll-x-contain scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } as any}
        >
          {sections.map((sec, idx) => {
            const isAccessible = canAccessSection(
              idx,
              currentSectionIdx,
              lockedSections,
              sectionalTimerEnabled,
              isSubmitted,
              meta.sections,
            );
            const isLocked = !isSubmitted && sectionalTimerEnabled && !isAccessible;
            const isCompleted = !isSubmitted && completedSections.has(idx);
            const active = isSubmitted
              ? currentIdx >= sec.start && currentIdx <= sec.end
              : isSectionalMode
                ? idx === currentSectionIdx
                : currentIdx >= sec.start && currentIdx <= sec.end;
            const qCount = sec.end - sec.start + 1;

            return (
              <button
                key={sec.name + idx}
                onClick={() => { if (isAccessible) setCurrentSection(idx); }}
                disabled={isLocked}
                aria-pressed={active}
                aria-disabled={isLocked}
                title={
                  isSubmitted ? `${sec.name} (Review)` : isCompleted ? `${sec.name} (Locked)` : isLocked ? `${sec.name} (Locked — complete current)` : `${sec.name} • ${qCount}Q • ${sec.durationMinutes || 15}m`
                }
                className={clsx(
                  'group relative px-3 sm:px-4 py-2.5 text-xs font-bold tracking-wide uppercase border-r border-tcs-border/60 whitespace-nowrap transition-all min-h-[44px] flex items-center gap-2',
                  isLocked && 'opacity-50 cursor-not-allowed bg-tcs-ink/30 text-tcs-muted',
                  !isLocked && active && 'bg-tcs-text text-tcs-panel shadow-sm cursor-pointer',
                  !isLocked && !active && 'text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel-2/60 cursor-pointer active:scale-[0.98]',
                )}
              >
                {isLocked && <Lock size={12} className="shrink-0" />}
                {isCompleted && !isLocked && <CheckCircle2 size={12} className="shrink-0 text-tcs-save" />}
                {!isLocked && !isCompleted && active && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" aria-hidden />}
                <span className="flex flex-col items-start leading-none gap-0.5">
                  <span className="text-[11px] sm:text-xs truncate max-w-[140px] sm:max-w-none">{sec.name.replace(/^Section \d+:\s*/,'')}</span>
                  <span className={clsx('text-[10px] font-medium normal-case tracking-normal flex items-center gap-1', active ? 'text-white/70' : 'text-tcs-muted')}>
                    <span>{qCount}Q</span>
                    <span className="w-px h-2 bg-current opacity-30" aria-hidden />
                    <span>{sec.durationMinutes || 15}m</span>
                    {sec.durationMinutes === 15 && <span className="hidden sm:inline opacity-60">• 15′</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-tcs-text flex items-center">
          {meta.name}
        </div>
      )}

      {sectionLineUsing(currentIdx, sections || meta.sections) && (
        <div className="ml-auto px-3 sm:px-4 py-2 text-[11px] text-tcs-muted font-medium hidden md:flex items-center gap-2 whitespace-nowrap">
          {isSubmitted && <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-answered/10 text-answered border border-answered/20">Review</span>}
          {sectionLineUsing(currentIdx, sections || meta.sections)}
        </div>
      )}
    </div>
  );
}

function sectionLineUsing(currentIdx: number, sections: { name: string; start: number; end: number }[]) {
  if (sections.length <= 1) return null;
  const idx = sections.findIndex((s) => currentIdx >= s.start && currentIdx <= s.end);
  if (idx < 0) return null;
  return `Section ${idx + 1} of ${sections.length}`;
}
