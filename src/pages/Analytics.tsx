import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PenSquare, Target, Flame, Trophy, CheckCircle2, ChartPie,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { getDb, getStats, onDbChange } from '@/services/attemptStore';
import { computeSectionStats } from '@/services/sectionAnalytics';
import type { SectionStat } from '@/services/sectionAnalytics';
import { loadMockCatalog } from '@/services/mockCatalog';
import { examPath } from '@/lib/examLink';
import { AppChrome, StatTile } from '@/components/layout';
import { Card, CardHeader, Reveal } from '@/components/ui';
import type { Attempt, MockEntry } from '@/types';

/* Chart colors come from the --chart-* tokens (light/dark aware) instead of
   hardcoded hex, so every series re-tints automatically with the theme. */
const COLORS = {
  correct: 'var(--chart-3)',
  incorrect: 'var(--chart-4)',
  unattempted: 'var(--chart-5)',
  primary: 'var(--chart-1)',
  info: 'var(--chart-2)',
};

export default function Analytics() {
  const [mocks, setMocks] = useState<MockEntry[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    loadMockCatalog().then(setMocks).catch((e: unknown) => {
      console.error('[Analytics] Failed to load mocks catalog:', e);
      setCatalogError(true);
    });
  }, []);

  // Recompute stats on ANY aether-db change — same-tab saves AND cross-tab writes.
  const [dbTick, setDbTick] = useState(0);
  useEffect(() => onDbChange(() => setDbTick((t) => t + 1)), []);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db; re-derives on dbTick
  const stats = useMemo(() => getStats(), [dbTick]);
  const db = getDb();
  const nameByPath = useMemo(() => new Map(mocks.map((m) => [m.path, m.name])), [mocks]);

  // Flatten attempts into a chronological series.
  const series = useMemo(() => {
    const rows: { date: string; scorePct: number; accuracy: number; name: string }[] = [];
    Object.entries(db.attempts).forEach(([path, arr]) => {
      // Skip Smart Revision paths — their questions already count under the real
      // mock, and recomputeStats() excludes them; including them double-counts.
      if (path.startsWith('smart-revision/')) return;
      arr.forEach((a: Attempt) => {
        rows.push({
          date: a.submittedAt.slice(0, 10),
          scorePct: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
          accuracy: a.accuracy,
          name: nameByPath.get(path) || path,
        });
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- dbTick re-derives on any aether-db write
  }, [db.attempts, nameByPath, dbTick]);

  // Answer distribution
  const dist = useMemo(() => {
    let c = 0, w = 0, u = 0;
    Object.entries(db.attempts).forEach(([path, arr]) => {
      if (path.startsWith('smart-revision/')) return;
      const a = arr[arr.length - 1];
      if (!a) return;
      c += a.correct; w += a.incorrect; u += a.unattempted;
    });
    return [
      { name: 'Correct', value: c, color: COLORS.correct },
      { name: 'Incorrect', value: w, color: COLORS.incorrect },
      { name: 'Skipped', value: u, color: COLORS.unattempted },
    ].filter((d) => d.value > 0);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- dbTick re-derives on any aether-db write
  }, [db.attempts, dbTick]);

  // Provider comparison
  const providerData = useMemo(
    () =>
      Object.entries(stats.byProvider).map(([name, s]) => ({
        name,
        accuracy: s.avgAccuracy,
        attempted: s.attempted,
      })),
    [stats],
  );

  // Recent attempts
  const recent = useMemo(() => {
    const rows: { path: string; score: number; maxScore: number; accuracy: number; date: string }[] = [];
    Object.entries(db.attempts).forEach(([path, arr]) => {
      if (path.startsWith('smart-revision/')) return;
      const a = arr[arr.length - 1];
      if (a) rows.push({ path, score: a.score, maxScore: a.maxScore, accuracy: a.accuracy, date: a.submittedAt });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [db.attempts]);

  // Weak-section heatmap — accuracy + speed per section across all attempts.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db; re-derives on dbTick
  const sectionStats = useMemo(() => computeSectionStats(getDb()), [dbTick]);

  const hasData = stats.totalAttempted > 0;

  const tooltipStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 13,
    boxShadow: 'var(--shadow-lg)',
  } as const;
  const legendStyle = { fontSize: 12, color: 'var(--text-2)' } as const;
  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 } as const;

  return (
    <div className="min-h-screen page-surface pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
      <AppChrome title="Analytics" icon={<ChartPie size={14} />} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {catalogError && (
          <Card className="mb-6 text-center py-4 bg-warning-soft border-warning/40">
            <p className="text-sm text-warning-fg">
              Mock catalog could not be loaded — mock names may show as file paths instead of titles.
            </p>
          </Card>
        )}
        {!hasData ? (
          <Card className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-2 grid place-items-center text-muted opacity-60">
              <ChartPie size={30} />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">No Data Yet</h3>
            <p className="text-sm text-muted max-w-md mx-auto mb-6">
              Complete at least one mock test to unlock your performance analytics — score trends, subject breakdown, and time analysis.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm">
              Start a Mock
            </Link>
          </Card>
        ) : (
          <>
            {/* Summary cards */}
            <Reveal>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4 mb-4 sm:mb-8">
                <StatTile icon={<PenSquare size={15} />} value={stats.totalAttempted} format="plain" label="Attempted" tone="primary" />
                <StatTile icon={<Target size={15} />} value={stats.avgAccuracy} format="percent" label="Avg Accuracy" tone="success" />
                <StatTile icon={<Flame size={15} />} value={stats.streakDays} format="plain" label="Day Streak" tone="warning" />
                <StatTile icon={<Trophy size={15} />} value={stats.bestScore ? stats.bestScore.score : null} format="score" label="Best Score" tone="info" />
                <StatTile icon={<CheckCircle2 size={15} />} value={dist.find((d) => d.name === 'Correct')?.value ?? 0} format="plain" label="Total Correct" tone="primary" />
                <StatTile icon={<ChartPie size={15} />} value={series.length} format="plain" label="Attempts" tone="info" />
              </div>
            </Reveal>

            {/* Score trend */}
            <Reveal delay={0.05}>
              <Card className="mb-4 sm:mb-6" shine>
                <CardHeader title="Score Trend" hint="score % per attempt" />
              <div className="h-60 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} stroke="var(--border)" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis tick={axisTick} stroke="var(--border)" domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border-strong)' }} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" />
                    <Area type="monotone" dataKey="scorePct" name="Score %" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#scoreFill)" dot={{ r: 3, fill: COLORS.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke={COLORS.info} strokeWidth={2} dot={false} strokeDasharray="5 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            </Reveal>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              {/* Answer distribution */}
              <Reveal delay={0.1}>
                <Card>
                  <CardHeader title="Answer Distribution" />
                  <div className="h-56 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                      <Pie data={dist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={4} cornerRadius={4} stroke="var(--surface)" strokeWidth={2}>
                        {dist.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={9} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Reveal>

              {/* Provider comparison */}
              <Reveal delay={0.15}>
                <Card>
                  <CardHeader title="Provider Accuracy" hint="average per provider" />
                  <div className="h-56 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={providerData} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} stroke="var(--border)" tickLine={false} />
                        <YAxis tick={axisTick} stroke="var(--border)" domain={[0, 100]} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} />
                        <Bar dataKey="accuracy" name="Avg Accuracy %" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Reveal>
            </div>

            {/* Weak-section heatmap */}
            {sectionStats.length > 0 && (
              <Reveal delay={0.18}>
                <Card className="mb-4 sm:mb-6">
                  <CardHeader title="Section Strength" hint="accuracy across all attempts — weakest first" />
                  <div className="space-y-2.5 sm:space-y-3">
                    {sectionStats.map((s) => (
                      <SectionRow key={s.name} stat={s} />
                    ))}
                  </div>
                </Card>
              </Reveal>
            )}

            {/* Recent attempts */}
            <Reveal delay={0.2}>
              <Card padded={false}>
                <div className="px-4 sm:px-5 pt-4 sm:pt-5">
                  <CardHeader title="Recent Attempts" hint="latest score per mock" />
                </div>
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-xs sm:text-sm min-w-[500px] sm:min-w-[600px]">
                  <thead>
                    <tr className="bg-surface-2 text-muted text-[11px] sm:text-xs uppercase tracking-wide">
                      <th className="text-left px-4 sm:px-5 py-2.5 sm:py-3 font-semibold">Mock</th>
                      <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Score</th>
                      <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Accuracy</th>
                      <th className="text-right px-4 sm:px-5 py-2.5 sm:py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.path + r.date} className="border-t border-border hover:bg-surface-2 transition-colors">
                        <td className="px-4 sm:px-5 py-2.5 sm:py-3 font-medium text-text max-w-[200px] sm:max-w-[280px] truncate">
                          <Link
                            to={examPath(r.path, { mode: 'review' })}
                            className="hover:text-primary transition-colors block truncate"
                            title={`Review ${nameByPath.get(r.path) || r.path}`}
                          >
                            {nameByPath.get(r.path) || r.path}
                          </Link>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right tabular-nums text-text-2">{r.score.toFixed(1)}<span className="text-muted text-[11px]">/{r.maxScore.toFixed(0)}</span></td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
                          <span
                            className="inline-block px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold tabular-nums"
                            style={
                              r.accuracy >= 70
                                ? { background: 'var(--success-soft)', color: 'var(--success-fg)' }
                                : r.accuracy >= 40
                                  ? { background: 'var(--warning-soft)', color: 'var(--warning-fg)' }
                                  : { background: 'var(--danger-soft)', color: 'var(--danger-fg)' }
                            }
                          >
                            {r.accuracy}%
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-2.5 sm:py-3 text-right text-muted text-[11px] sm:text-xs whitespace-nowrap">{r.date.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </Card>
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
}

/* Weak-section heatmap row: color-coded accuracy bar + counts + avg time.
   Color scale mirrors the accuracy badge thresholds used elsewhere on the page. */
function SectionRow({ stat }: { stat: SectionStat }) {
  const acc = stat.accuracy;
  const color =
    acc === null
      ? { bar: 'var(--border-strong)', fg: 'var(--text-muted)', soft: 'var(--surface-2)' }
      : acc >= 70
        ? { bar: 'var(--success)', fg: 'var(--success-fg)', soft: 'var(--success-soft)' }
        : acc >= 40
          ? { bar: 'var(--warning)', fg: 'var(--warning-fg)', soft: 'var(--warning-soft)' }
          : { bar: 'var(--danger)', fg: 'var(--danger-fg)', soft: 'var(--danger-soft)' };

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="w-28 sm:w-40 md:w-52 shrink-0 truncate text-sm font-medium text-text" title={stat.name}>
        {stat.name}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="h-2.5 rounded-full bg-surface-2 overflow-hidden"
          role="progressbar"
          aria-label={`${stat.name} accuracy`}
          aria-valuenow={acc ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${acc ?? 0}%`, background: color.bar }}
          />
        </div>
      </div>
      <div className="shrink-0 w-14 text-right">
        <span
          className="inline-block px-2 py-0.5 rounded-md text-xs font-bold tabular-nums"
          style={{ background: color.soft, color: color.fg }}
        >
          {acc === null ? '—' : `${acc}%`}
        </span>
      </div>
      <div className="hidden sm:block shrink-0 w-24 text-right text-xs text-muted tabular-nums">
        {stat.correct}/{stat.answered} right
      </div>
      <div className="hidden md:block shrink-0 w-16 text-right text-xs text-muted tabular-nums">
        {stat.avgTimeSec === null ? '' : `${stat.avgTimeSec}s/q`}
      </div>
    </div>
  );
}

