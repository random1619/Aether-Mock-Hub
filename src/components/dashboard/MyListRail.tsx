import { ListPlus } from 'lucide-react';
import { Rail } from './Rail';
import { MockCard } from './MockCard';
import type { Attempt, MockEntry } from '@/types';

interface MyListRailProps {
  mocks: MockEntry[];
  scoresMap: Record<string, Attempt>;
  isDone: (path: string) => boolean;
  onToggleDone: (mock: MockEntry) => void;
  onOpenModal: (mock: MockEntry) => void;
}

export function MyListRail({ mocks, scoresMap, isDone, onToggleDone, onOpenModal }: MyListRailProps) {
  if (!mocks.length) return null;

  return (
    <div id="my-list">
      <Rail title="My List" hint="Mocks saved to this profile" icon={<ListPlus size={20} />}>
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
