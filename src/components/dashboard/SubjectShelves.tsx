import { BookOpen, Flame } from 'lucide-react';
import { Rail } from './Rail';
import { MockCard } from './MockCard';
import type { Attempt, MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

interface SubjectShelvesProps {
  bySubject: Array<{ subject: string; mocks: MockEntry[] }>;
  scoresMap: Record<string, Attempt>;
  isDone: (path: string) => boolean;
  onToggle: (mock: MockEntry) => void;
  onOpenModal?: (mock: MockEntry) => void;
  /** Max shelves to render (keeps the page from getting too long). */
  maxShelves?: number;
  /** Max cards per shelf. */
  perShelf?: number;
}

/** Cinematic shelves: one horizontal rail per subject, each gliding through
    that subject's mocks. Curated (top subjects, capped counts) so the page
    stays fast and scannable; the full catalog lives below. */
export function SubjectShelves({ bySubject, scoresMap, isDone, onToggle, onOpenModal, maxShelves = 4, perShelf = 12 }: SubjectShelvesProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const shelves = bySubject.slice(0, maxShelves);
  if (shelves.length === 0) return null;

  // Flatten all mocks for Top 10 row in Netflix mode
  const allMocks = bySubject.flatMap((s) => s.mocks);
  const top10 = allMocks.slice(0, 10);

  return (
    <div className="space-y-10" id="browse-tree">
      {/* Netflix Special "Top 10 Mocks Today" row */}
      {isNetflix && top10.length > 0 && (
        <Rail
          title="Top 10 Mocks Today"
          hint="Most attempted mock test series this week"
          icon={<Flame size={22} className="text-[#E50914]" />}
        >
          {top10.map((m, idx) => (
            <div key={m.path} className="flex items-center snap-start shrink-0">
              <span className="top10-rank -mr-5 z-10">{idx + 1}</span>
              <MockCard
                variant="rail"
                mock={m}
                done={isDone(m.path)}
                score={scoresMap[m.path]}
                onToggle={() => onToggle(m)}
                onOpenModal={onOpenModal}
              />
            </div>
          ))}
        </Rail>
      )}

      {shelves.map(({ subject, mocks }) => (
        <Rail
          key={subject}
          title={
            isNetflix ? (
              <span className="border-l-4 border-[#E50914] pl-2.5 inline-block text-white">
                {subject}
              </span>
            ) : (
              subject
            )
          }
          hint={`${mocks.length} mock${mocks.length === 1 ? '' : 's'}`}
          icon={!isNetflix ? <BookOpen size={20} /> : undefined}
        >
          {mocks.slice(0, perShelf).map((m) => (
            <MockCard
              key={m.path}
              variant="rail"
              mock={m}
              done={isDone(m.path)}
              score={scoresMap[m.path]}
              onToggle={() => onToggle(m)}
              onOpenModal={onOpenModal}
            />
          ))}
        </Rail>
      ))}
    </div>
  );
}
