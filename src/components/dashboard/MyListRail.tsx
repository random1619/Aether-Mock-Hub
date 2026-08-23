import { ListPlus } from 'lucide-react';
import { Rail } from './Rail';
import { MockCard } from './MockCard';
import type { Attempt, MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

interface MyListRailProps {
  mocks: MockEntry[];
  scoresMap: Record<string, Attempt>;
  isDone: (path: string) => boolean;
  onToggleDone: (mock: MockEntry) => void;
  onOpenModal: (mock: MockEntry) => void;
}

export function MyListRail({ mocks, scoresMap, isDone, onToggleDone, onOpenModal }: MyListRailProps) {
  const { theme } = useSettingsStore();
  const isOnePiece = theme === 'onepiece';

  if (!mocks.length) return null;

  return (
    <div id="my-list">
      <Rail
        title={
          isOnePiece ? (
            <span className="border-l-4 border-[#FFB703] pl-2.5 inline-block text-white font-black tracking-wide">
              🏴‍☠️ Crew Log Pose (My List)
            </span>
          ) : (
            <span className="flex items-center gap-2.5 text-white">
              <span className="w-1.5 h-6 bg-[#E50914] rounded-full inline-block shadow-[0_0_12px_#E50914]" />
              My List
            </span>
          )
        }
        hint={isOnePiece ? 'Islands bookmarked on your Grand Line journey' : 'Mocks saved to this profile'}
        icon={<ListPlus size={20} className={isOnePiece ? 'text-[#FFB703]' : undefined} />}
      >
        {mocks.map((mock) => (
          <MockCard
            key={mock.path}
            mock={mock}
            done={isDone(mock.path)}
            score={scoresMap[mock.path]}
            onToggle={() => onToggleDone(mock)}
            onOpenModal={onOpenModal}
            variant="rail"
          />
        ))}
      </Rail>
    </div>
  );
}
