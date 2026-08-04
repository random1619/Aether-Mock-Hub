import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Rail } from './Rail';
import { CoverArt } from './CoverArt';
import { PROVIDERS } from '@/lib/providers';
import type { MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

const MotionLink = motion.create(Link);

/** "Browse by Provider" — App Store–style tiles: app-icon artwork, tight
    title, muted metadata. Counts derive live from the loaded catalog. */
export function ProviderCards({ mocks }: { mocks: MockEntry[] | null }) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (mocks ?? []).forEach((m) => map.set(m.provider, (map.get(m.provider) ?? 0) + 1));
    return map;
  }, [mocks]);

  return (
    <div id="providers">
      <Rail
        title={
          isNetflix ? (
            <span className="border-l-4 border-[#E50914] pl-2.5 inline-block text-white">
              Browse by Provider
            </span>
          ) : (
            "Browse by Provider"
          )
        }
        hint="every source, one shelf"
      >
      {PROVIDERS.map((p) => {
        const count = counts.get(p.provider) ?? 0;
        return (
          <MotionLink
            key={p.slug}
            to={`/provider/${p.slug}`}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="group snap-start shrink-0 w-52 rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-3.5 flex flex-col gap-3 card-elevated-hover shadow-sm transition-colors"
          >
            <CoverArt seed={p.title} title={p.title} className="w-full aspect-square text-3xl" iconScale={0.5} />
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text truncate group-hover:text-primary transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-muted truncate mt-0.5">
                  {count} mocks · {p.tagline}
                </p>
              </div>
              <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-surface-2 text-muted group-hover:bg-primary group-hover:text-white transition-all group-hover:scale-110">
                <ChevronRight size={14} />
              </span>
            </div>
          </MotionLink>
        );
      })}
    </Rail>
    </div>
  );
}
