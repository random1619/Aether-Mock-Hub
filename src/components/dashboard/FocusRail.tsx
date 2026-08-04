import { Link } from 'react-router-dom';
import { History, Play, Rocket } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { AccuracyRing } from './AccuracyRing';
import { Rail } from './Rail';
import { CoverArt } from './CoverArt';
import { examPath } from '@/lib/examLink';
import type { Attempt, MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

export interface FocusItem {
  mock: MockEntry;
  attempt: Attempt;
}

/** "Pick up where you left off" — recent attempts as Apple tiles with a
    Resume pill. In Netflix mode, formats as "Continue Practice". */
export function FocusRail({ items }: { items: FocusItem[] }) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

  if (items.length === 0) {
    return (
      <Card className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-primary-soft text-primary">
          <Rocket size={19} />
        </div>
        <div>
          <div className="text-sm font-semibold text-text">Take your first mock</div>
          <div className="text-[13px] text-muted mt-0.5">
            Your recent attempts and continue-links will appear here.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Rail
      title={
        isNetflix ? (
          <span className="border-l-4 border-[#E50914] pl-2.5 inline-block text-white">
            Continue Practice for Aspirant
          </span>
        ) : (
          "Pick up where you left off"
        )
      }
      hint={isNetflix ? "Recent attempted mock tests" : "resume a recent attempt"}
      icon={!isNetflix ? <History size={20} /> : undefined}
    >
      {items.map(({ mock, attempt }) => {
        const acc = attempt.accuracy;
        const tone = acc >= 70 ? 'success' : acc >= 40 ? 'warning' : 'danger';
        return (
          <div
            key={mock.path}
            className="snap-start shrink-0 w-60 rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-4 flex gap-3.5 transition-all duration-200 ease-standard hover:-translate-y-0.5 card-elevated-hover"
          >
            <CoverArt seed={mock.path} title={mock.name} className="w-16 h-16 shrink-0 text-lg" iconScale={0.52} />
            <div className="min-w-0 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="primary">{mock.provider}</Badge>
                <AccuracyRing acc={acc} tone={tone} />
              </div>
              <div className="font-semibold text-text text-[13px] leading-snug line-clamp-2 mt-1.5 flex-1">
                {mock.name}
              </div>
              <Link
                to={examPath(mock.path)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm self-start"
              >
                <Play size={11} fill="currentColor" /> Resume
              </Link>
            </div>
          </div>
        );
      })}
    </Rail>
  );
}
