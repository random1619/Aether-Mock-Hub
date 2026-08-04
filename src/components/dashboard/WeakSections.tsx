import { Link } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import { Card, CardHeader, Reveal } from '@/components/ui';
import type { SectionStat } from '@/services/sectionAnalytics';

/** "Where you're losing marks" — weakest sections as gradient meters.
    Expects pre-filtered/sorted stats (weakest first, accuracy non-null). */
export function WeakSections({ sections }: { sections: SectionStat[] }) {
  return (
    <Reveal delay={0.05}>
      <Card>
        <CardHeader
          title="Where you're losing marks"
          hint="weakest sections across all attempts"
          icon={<TrendingDown size={15} />}
          action={
            <Link to="/analytics" className="text-[13px] font-medium text-primary hover:underline transition-colors">
              Full analytics ›
            </Link>
          }
        />
        {sections.length === 0 ? (
          <p className="text-sm text-muted">Take a mock to unlock section-by-section insights.</p>
        ) : (
          <div className="space-y-3.5">
            {sections.map((s) => (
              <WeakRow key={s.name} stat={s} />
            ))}
          </div>
        )}
      </Card>
    </Reveal>
  );
}

function WeakRow({ stat }: { stat: SectionStat }) {
  const acc = stat.accuracy ?? 0;
  const fill = acc >= 70 ? 'bg-success' : acc >= 40 ? 'bg-warning' : 'bg-danger';
  const fg = acc >= 70 ? 'text-success-fg' : acc >= 40 ? 'text-warning-fg' : 'text-danger-fg';
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 sm:w-56 shrink-0 truncate text-sm font-medium text-text" title={stat.name}>
        {stat.name}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="h-1.5 rounded-full bg-surface-3 overflow-hidden"
          role="progressbar"
          aria-label={`${stat.name} accuracy`}
          aria-valuenow={acc}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${fill}`}
            style={{ width: `${acc}%` }}
          />
        </div>
      </div>
      <div className={`shrink-0 w-12 text-right text-sm font-semibold tabular-nums ${fg}`}>
        {stat.accuracy === null ? '—' : `${acc}%`}
      </div>
    </div>
  );
}
