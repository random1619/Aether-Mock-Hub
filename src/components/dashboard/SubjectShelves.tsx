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
  const isOnePiece = theme === 'onepiece';
  const shelves = bySubject.slice(0, maxShelves);
  if (shelves.length === 0) return null;

  // Flatten all mocks for Top 10 row in Netflix/One Piece mode
  const allMocks = bySubject.flatMap((s) => s.mocks);
  const top10 = allMocks.slice(0, 10);

  return (
    <div className="space-y-10" id="browse-tree">
      {/* One Piece Special "Yonko Tier Mocks" row */}
      {isOnePiece && top10.length > 0 && (
        <Rail
          title={
            <span className="text-white font-black tracking-wide flex items-center gap-2">
              <span className="text-lg">👑</span> Yonko Tier &amp; Pinnacle Mocks
            </span>
          }
          hint="Most sought-after Grand Line battle series"
          icon={<Flame size={22} className="text-[#FFB703]" />}
        >
          {top10.map((m, idx) => (
            <div key={m.path} className="flex items-center snap-start shrink-0">
              <span className="top10-rank -mr-5 z-10 text-[#FFB703] drop-shadow-[0_2px_8px_rgba(255,183,3,0.3)]">{idx + 1}</span>
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
            isOnePiece ? (
              <span className="border-l-4 border-[#FFB703] pl-2.5 inline-block text-white font-black tracking-wide">
                {subject} Islands
              </span>
            ) : isNetflix ? (
              <span className="flex items-center gap-2.5 text-white">
                <span className="w-1.5 h-6 bg-[#E50914] rounded-full inline-block shadow-[0_0_12px_#E50914]" />
                {subject}
              </span>
            ) : (
              subject
            )
          }
          hint={`${mocks.length} mock${mocks.length === 1 ? '' : 's'}`}
          icon={!isNetflix && !isOnePiece ? <BookOpen size={20} /> : undefined}
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
