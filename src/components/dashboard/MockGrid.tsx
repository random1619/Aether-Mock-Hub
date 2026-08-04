import { SearchX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card } from '@/components/ui';
import { Skeleton } from '@/components/layout';
import { MockCard } from './MockCard';
import type { Attempt, MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { clsx } from 'clsx';

interface MockGridProps {
  mocks: MockEntry[] | null;
  shown: MockEntry[];
  scoresMap: Record<string, Attempt>;
  filteredCount: number;
  visible: number;
  error: string | null;
  isDone: (path: string) => boolean;
  onLoadMore: () => void;
  onToggle: (mock: MockEntry) => void;
  onOpenModal?: (mock: MockEntry) => void;
  onReset: () => void;
}

import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 26 },
  },
};

/** The catalog grid + loading / error / empty states + "Load more" pagination. */
export function MockGrid({ mocks, shown, scoresMap, filteredCount, visible, error, isDone, onLoadMore, onToggle, onOpenModal, onReset }: MockGridProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  
  if (error) {
    return (
      <Card className="text-center py-16">
        <p className="text-danger font-semibold mb-2">Failed to load catalog</p>
        <p className="text-sm text-muted mb-5">{error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
      </Card>
    );
  }

  if (!mocks) {
    /* Layout-shaped skeleton grid: reserves the exact card footprint so the
       catalog doesn't jump when it finishes loading (no spinner, no shift). */
    return (
      <div 
        className={clsx(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
          isNetflix ? "gap-2 sm:gap-3" : "gap-4 lg:gap-6"
        )} 
        role="status" aria-live="polite" aria-label="Loading mocks"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={clsx(
            "rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden",
            isNetflix ? "bg-[#181818]" : "bg-surface ring-1 ring-[var(--glass-border)]"
          )}>
            <Skeleton shape="block" className={clsx("w-full rounded-xl", isNetflix ? "aspect-video" : "aspect-square")} />
            <Skeleton className="h-4 w-4/5 rounded-md mt-1" />
            <Skeleton className="h-3.5 w-3/5 rounded-md" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton shape="circle" className="w-7 h-7" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading mocks…</span>
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <Card className="text-center py-20">
        <SearchX size={40} className="mx-auto mb-3 text-muted opacity-40" aria-hidden />
        <h3 className="text-lg font-bold text-text mb-1">No mocks found</h3>
        <p className="text-sm text-muted mb-5">Try adjusting your search or filters.</p>
        <Button variant="secondary" onClick={onReset}>Clear all filters</Button>
      </Card>
    );
  }

  return (
    <>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={clsx(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
          isNetflix ? "gap-2 sm:gap-4 overflow-visible pb-28 -mb-28" : "gap-4 lg:gap-6"
        )}
      >
        <AnimatePresence mode="popLayout">
          {shown.map((m) => (
            <motion.div
              key={m.path}
              layout
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={clsx("h-full", isNetflix && "relative hover:z-50")}
            >
              <MockCard
                mock={m}
                done={isDone(m.path)}
                score={scoresMap[m.path]}
                onToggle={() => onToggle(m)}
                onOpenModal={onOpenModal}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {filteredCount > visible && (
        <div className="flex justify-center mt-10">
          <Button variant="secondary" size="lg" onClick={onLoadMore}>
            Load more · {filteredCount - visible} remaining
          </Button>
        </div>
      )}
    </>
  );
}
