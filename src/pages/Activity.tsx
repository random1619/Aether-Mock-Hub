import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Target, Trophy, Clock3, CalendarDays, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { getDb, getStats, getDayActivity, getDailyGoal, localDayKey, onDbChange } from '@/services/attemptStore';
import { useEffect, useState } from 'react';
import { AppChrome } from '@/components/layout';
import { Reveal } from '@/components/ui';
import type { Attempt } from '@/types';

function heatColor(count: number, goal: number): string {
  if (count === 0) return 'var(--surface-2)';
  const r = Math.min(1, count / Math.max(1, goal));
  if (r >= 1) return 'var(--success)';
  if (r >= 0.6) return 'color-mix(in srgb, var(--success) 70%, var(--surface-2))';
  if (r >= 0.3) return 'color-mix(in srgb, var(--success) 40%, var(--surface-2))';
  return 'color-mix(in srgb, var(--success) 22%, var(--surface-2))';
}

export default function Activity() {
  const [tick, setTick] = useState(0);
  useEffect(() => onDbChange(() => setTick((t) => t + 1)), []);
  const db = useMemo(() => getDb(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db; re-derives on tick
  const stats = useMemo(() => getStats(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db
  const activity = useMemo(() => getDayActivity(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db
  const goal = useMemo(() => getDailyGoal(), [tick]);

  // Last 84 days (12 weeks) for heatmap, oldest → newest.
  const days = useMemo(() => {
    const arr: { key: string; date: Date; count: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDayKey(d);
      arr.push({ key, date: new Date(d), count: activity[key] ?? 0 });
    }
    return arr;
  }, [activity]);

  // Timeline: flatten attempts newest-first
  const timeline = useMemo(() => {
    const rows: { path: string; a: Attempt; name: string }[] = [];
    Object.entries(db.attempts).forEach(([path, list]) => {
      if (path.startsWith('smart-revision/')) return;
      list.forEach((a) => rows.push({ path, a, name: path }));
    });
    return rows.sort((a, b) => b.a.submittedAt.localeCompare(a.a.submittedAt)).slice(0, 16);
  }, [db.attempts]);

  const weeks: Array<typeof days> = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="min-h-screen page-surface pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
      <AppChrome title="Activity" icon={<CalendarDays size={14} />} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* KPI strip — bento */}
        <Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <Kpi icon={<Flame size={15} />} label="Streak" value={`${stats.streakDays} days`} tone="warning" />
            <Kpi icon={<Target size={15} />} label="Avg Accuracy" value={`${stats.avgAccuracy}%`} tone="success" />
            <Kpi icon={<Trophy size={15} />} label="Best Score" value={stats.bestScore ? `${stats.bestScore.score.toFixed(1)}/${stats.bestScore.maxScore.toFixed(0)}` : '—'} tone="info" />
            <Kpi icon={<Clock3 size={15} />} label="Attempts" value={`${timeline.length} logged`} tone="primary" />
          </div>
        </Reveal>

        {/* Heatmap */}
        <Reveal delay={0.06}>
          <div className="rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-3">
              <h2 className="text-xs sm:text-sm font-bold tracking-[-0.01em] text-text">Daily activity — last 12 weeks</h2>
              <span className="text-[11px] sm:text-xs text-muted">Goal {goal}/day · darker = more done</span>
            </div>

            <div className="mt-3 sm:mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-none">
              <div className="min-w-[560px]">
                <div className="grid grid-flow-col auto-cols-fr gap-1.5">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-rows-7 gap-1.5">
                      {week.map((d) => (
                        <motion.div
                          key={d.key}
                          initial={{ scale: 0.9, opacity: 0 }}
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ type: 'spring', stiffness: 400, damping: 24 } as any}
                          title={`${d.key}: ${d.count} done`}
                          className="h-3.5 rounded-[5px] ring-1 ring-[var(--glass-border)]"
                          style={{ background: heatColor(d.count, goal) }}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[10px] sm:text-[11px] text-muted">
                  <span>Less</span>
                  <span className="inline-flex gap-1">
                    {[0, 0.25, 0.6, 1].map((r) => (
                      <span key={r} className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[4px] ring-1 ring-[var(--glass-border)] inline-block" style={{ background: heatColor(Math.round(r * maxCount), goal) }} />
                    ))}
                  </span>
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Timeline */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs sm:text-sm font-bold tracking-[-0.01em] text-text">Recent timeline</h2>
              <Link to="/analytics" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                Analytics <ArrowRight size={12} />
              </Link>
            </div>

            {timeline.length === 0 ? (
              <div className="mt-6 text-center py-8 sm:py-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto grid place-items-center rounded-full bg-surface-2 text-muted"><Play size={18} /></div>
                <p className="mt-3 text-xs sm:text-sm font-semibold text-text">No attempts yet</p>
                <p className="text-[11px] sm:text-xs text-muted mt-1">Your activity will appear here after your first mock.</p>
                <Link to="/" className="mt-3 sm:mt-4 inline-flex px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-primary text-white text-xs sm:text-sm font-semibold">Start a mock</Link>
              </div>
            ) : (
              <ol className="mt-4 relative border-s border-border ps-5 sm:ps-6 space-y-3.5 sm:space-y-4">
                {timeline.map(({ path, a }) => (
                  <li key={path + a.submittedAt} className="relative">
                    <span className="absolute -start-[25px] sm:-start-[29px] top-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary ring-4 ring-surface" />
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-bold text-text truncate max-w-[16rem] sm:max-w-[28rem]">{path.replace(/_/g, ' ').replace('.json', '')}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-muted">{new Date(a.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(a.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: a.accuracy >= 70 ? 'var(--success-soft)' : a.accuracy >= 40 ? 'var(--warning-soft)' : 'var(--danger-soft)', color: a.accuracy >= 70 ? 'var(--success-fg)' : a.accuracy >= 40 ? 'var(--warning-fg)' : 'var(--danger-fg)' }}>
                          <CheckCircle2 size={11} /> {a.accuracy}% · {a.score.toFixed(1)}/{a.maxScore.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'primary' | 'success' | 'warning' | 'info' }) {
  const tones: Record<string, string> = {
    primary: 'text-primary',
    success: 'text-success-fg',
    warning: 'text-warning-fg',
    info: 'text-info-fg',
  };
  return (
    <div className="rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-3 sm:p-4">
      <div className={`w-7 h-7 sm:w-8 sm:h-8 grid place-items-center rounded-full bg-surface-2 ${tones[tone]}`}>{icon}</div>
      <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm sm:text-base font-bold text-text tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
