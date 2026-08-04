import { clsx } from 'clsx';
import { useExamStore } from '@/stores/examStore';

/**
 * TCS iON: subject tab strip just below the header.
 * The active tab is filled with primary colour; inactive ones are flat.
 * For single-section exams this still shows one row with the exam name.
 */
export function SectionTabs() {
  const meta = useExamStore((s) => s.meta);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const currentIdx = useExamStore((s) => s.currentIdx);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);
  const setCurrentSection = useExamStore((s) => s.setCurrentSection);
  const phase = useExamStore((s) => s.phase);
  if (!meta) return null;

  // Always show — even single-section exams, since TCS shows "Subject: <name>" row.
  const sections = meta.sections.length > 1 ? meta.sections : null;

  return (
    <div className="flex items-stretch bg-tcs-ink border-b border-tcs-border">
      <div className="px-3 sm:px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-tcs-muted border-r border-tcs-border">
        Subject
      </div>
      {sections ? (
        <div className="flex overflow-x-auto">
          {sections.map((sec, idx) => {
            // Active = the section currently being attempted. In review mode the
            // section is just where the viewed question sits, so highlight by index.
            const active =
              phase === 'active' && isSectionalMode
                ? idx === currentSectionIdx
                : currentIdx >= sec.start && currentIdx <= sec.end;
            return (
              <button
                key={sec.name + idx}
                onClick={() => setCurrentSection(idx)}
                aria-pressed={active}
                className={clsx(
                  'px-4 py-2 text-xs font-bold tracking-wide uppercase border-r border-tcs-border whitespace-nowrap transition-colors',
                  active
                    ? 'bg-tcs-panel-2 text-tcs-text'
                    : 'text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel',
                )}
              >
                {sec.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-tcs-text">
          {meta.name}
        </div>
      )}

      {/* Right side tag — TCS puts "Section 1 of N" or similar here in an active exam */}
      {phase === 'active' && sectionLineUsing(currentIdx, sections || meta.sections) && (
        <div className="ml-auto px-3 sm:px-4 py-2 text-[11px] text-tcs-muted font-medium hidden md:block whitespace-nowrap">
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
