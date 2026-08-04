import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { loadMockCatalog, subjectsOf } from '@/services/mockCatalog';
import { getLatestScoresMap, isComplete, onDbChange } from '@/services/attemptStore';
import { useMockFilters, useCompletionToggle, filterMocks, STATUS_OPTIONS } from '@/hooks/useMockFilters';
import { providerMeta } from '@/lib/providers';
import { Badge, Button } from '@/components/ui';
import { MockGrid, SearchPill, SegmentedControl } from '@/components/dashboard';
import { AppChrome } from '@/components/layout';
import type { MockEntry } from '@/types';

export default function ProviderPage({ provider }: { provider: string }) {
  // Brand metadata comes from the registry — single source of truth.
  const meta = providerMeta(provider);
  const brand = {
    provider,
    title: meta?.title ?? provider,
    tagline: meta?.tagline ?? '',
    tone: meta?.tone ?? ('neutral' as const),
  };
  const [mocks, setMocks] = useState<MockEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { search, setSearch, subject, setSubject, status, setStatus, visible, loadMore, reset } = useMockFilters();
  const [dbTick, setTick] = useState(0);

  useEffect(() => {
    loadMockCatalog()
      .then(setMocks)
      .catch((e: Error) => setError(e.message));
    return onDbChange(() => setTick((t) => t + 1));
  }, []);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const scoresMap = useMemo(() => getLatestScoresMap(), [dbTick]);

  /* Only this provider's mocks. */
  const own = useMemo(
    () => (mocks ?? []).filter((m) => m.provider === brand.provider),
    [mocks, brand.provider],
  );

  const subjects = useMemo(() => subjectsOf(own), [own]);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- isComplete reads aether-db; dbTick re-derives on any write
  const filtered = useMemo(
    () => filterMocks(own, { search, subject, status }),
    [own, search, subject, status, dbTick],
  );

  const shown = filtered.slice(0, visible);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- isComplete reads aether-db; dbTick re-derives on any write
  const completedCount = useMemo(() => own.filter((m) => isComplete(m.path)).length, [own, dbTick]);
  const progressPct = own.length ? Math.round((completedCount / own.length) * 100) : 0;

  const handleToggle = useCompletionToggle(() => setTick((t) => t + 1));

  return (
    <div className="min-h-screen page-surface">
      {/* Frosted nav — shared shell */}
      <AppChrome
        title={brand.title}
        actions={
          <Link
            to="/analytics"
            className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Analytics"
          >
            <BarChart3 size={15} />
          </Link>
        }
      />

      {/* Hero — apple.com product-page typography */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        {/* Gate hero metrics on catalog load — otherwise they flash "0 mocks". */}
        <Badge tone={brand.tone} className="mb-4">{mocks ? `${own.length} mocks` : '…'}</Badge>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-[-0.025em] text-text leading-[1.05]">
          {brand.title}
        </h1>
        <p className="text-muted mt-3 text-base sm:text-lg font-medium tracking-[-0.01em] max-w-2xl mx-auto">{brand.tagline}</p>

        {mocks && (
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs font-medium text-muted mb-2">
              <span>Progress</span>
              <span className="tabular-nums">{completedCount}/{own.length} · {progressPct}%</span>
            </div>
            <div
              className="h-1.5 rounded-full bg-surface-3 overflow-hidden"
              role="progressbar"
              aria-label={`${brand.title} completion`}
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${completedCount} of ${own.length} mocks completed`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Filters + grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-surface rounded-2xl p-5 flex flex-col gap-4">
          <SearchPill
            value={search}
            onChange={setSearch}
            placeholder={mocks ? `Search ${own.length} ${brand.title} mocks` : `Search ${brand.title} mocks`}
            ariaLabel={`Search ${brand.title} mocks`}
            size="md"
          />

          <div className="flex flex-wrap items-center gap-4">
            {subjects.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subject">
                {['all', ...subjects].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    aria-pressed={subject === s}
                    className={clsx(
                      'text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors capitalize',
                      subject === s
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text',
                    )}
                  >
                    {s === 'all' ? 'All subjects' : s}
                  </button>
                ))}
              </div>
            )}

            {/* iOS segmented control */}
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              ariaLabel="Completion status"
              className="ml-auto"
            />
          </div>
        </div>

        {/* Skip the grid's "No mocks found" card when the provider itself has
            zero mocks — the dedicated block below covers that case (no stacking). */}
        {(mocks === null || error || own.length > 0) && (
          <MockGrid
            mocks={mocks}
            shown={shown}
            scoresMap={scoresMap}
            filteredCount={filtered.length}
            visible={visible}
            error={error}
            isDone={isComplete}
            onLoadMore={loadMore}
            onToggle={handleToggle}
            onReset={reset}
          />
        )}

        {mocks && own.length === 0 && !error && (
          <div className="text-center py-10">
            <p className="text-sm text-muted mb-4">
              No renderable mocks for {brand.title} in the catalog.
            </p>
            <Link to="/">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
