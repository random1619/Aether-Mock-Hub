import { Flame } from 'lucide-react';
import { Rail } from './Rail';
import { MockCard } from './MockCard';
import type { MockEntry, Attempt } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCompletionToggle } from '@/hooks/useMockFilters';

export interface RecommendationItem {
  mock: MockEntry;
  score?: { score: number; maxScore: number; accuracy: number };
  /** The mock this recommendation is based on */
  basedOn?: string;
}

/**
 * "Because you watched X" recommendation rail - Netflix style
 * Shows mocks from the same category/provider that the user might like
 */
export function BecauseYouWatchedRail({
  items,
  watchedTitle = "your history",
}: {
  items: RecommendationItem[];
  watchedTitle?: string;
}) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const handleToggle = useCompletionToggle(() => {});

  if (items.length === 0) return null;

  return (
    <Rail
      title={
        isNetflix ? (
          <span className="border-l-4 border-[#E50914] pl-2.5 inline-block text-white">
            Because you watched {watchedTitle}
          </span>
        ) : (
          `Because you watched ${watchedTitle}`
        )
      }
      hint={isNetflix ? "More mocks you might enjoy" : "Recommended based on your activity"}
      icon={!isNetflix ? <Flame size={20} /> : undefined}
    >
      {items.map((item, idx) => (
        <MockCard
          key={item.mock.path}
          mock={item.mock}
          done={false}
          score={item.score}
          onToggle={() => handleToggle(item.mock)}
          variant="rail"
          rank={idx + 1}
        />
      ))}
    </Rail>
  );
}

/** Group recommendations by category/provider */
export function groupRecommendations(
  mocks: MockEntry[],
  scoresMap: Record<string, Attempt>,
  category: string
): RecommendationItem[] {
  return mocks
    .filter(m => m.category === category || m.provider === category)
    .slice(0, 10)
    .map(m => ({
      mock: m,
      score: scoresMap[m.path]
        ? {
            score: scoresMap[m.path].score,
            maxScore: scoresMap[m.path].maxScore,
            accuracy: scoresMap[m.path].accuracy,
          }
        : undefined,
    }));
}