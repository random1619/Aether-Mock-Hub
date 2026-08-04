import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CalendarDays, Filter, BarChart3 } from 'lucide-react';
import { getAllSavedQuestions, onDbChange, toggleSaveQuestion } from '@/services/attemptStore';
import { loadMockCatalog } from '@/services/mockCatalog';
import { SafeHtml, Card, CardHeader, Button } from '@/components/ui';
import { SearchPill } from '@/components/dashboard';
import { AppChrome } from '@/components/layout';
import type { MockEntry, SavedQuestionRecord } from '@/types';

type SavedDateFilter = 'all' | 'today' | '7d' | '30d';

function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSavedDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function outcomeTone(outcome?: SavedQuestionRecord['lastOutcome']): string {
  if (outcome === 'correct') return 'bg-success-soft text-success-fg';
  if (outcome === 'incorrect') return 'bg-danger-soft text-danger-fg';
  if (outcome === 'skipped') return 'bg-warning-soft text-warning-fg';
  return 'bg-surface-2 text-muted';
}

export default function SavedQuestions() {
  const [saved, setSaved] = useState<SavedQuestionRecord[]>([]);
  const [mocks, setMocks] = useState<MockEntry[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [subject, setSubject] = useState('all');
  const [dateSaved, setDateSaved] = useState<SavedDateFilter>('all');

  useEffect(() => {
    const sync = () => setSaved(getAllSavedQuestions());
    sync();
    return onDbChange(sync);
  }, []);

  useEffect(() => {
    loadMockCatalog()
      .then(setMocks)
      .catch((e: unknown) => {
        console.error('[SavedQuestions] Failed to load mocks catalog:', e);
        setCatalogError(true);
      });
  }, []);

  const metaByPath = useMemo(() => new Map(mocks.map((m) => [m.path, m])), [mocks]);

  const enriched = useMemo(
    () =>
      saved.map((item) => {
        const meta = metaByPath.get(item.examPath);
        return {
          ...item,
          provider: item.provider ?? meta?.provider ?? 'Unknown',
          subject: meta?.subject ?? 'Unknown',
        };
      }),
    [saved, metaByPath],
  );

  const providers = useMemo(
    () => [...new Set(enriched.map((item) => item.provider).filter(Boolean))].sort(),
    [enriched],
  );

  const subjects = useMemo(
    () => [...new Set(enriched.map((item) => item.subject).filter(Boolean))].sort(),
    [enriched],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return enriched.filter((item) => {
      if (provider !== 'all' && item.provider !== provider) return false;
      if (subject !== 'all' && item.subject !== subject) return false;
      if (dateSaved !== 'all') {
        const savedAt = new Date(item.savedAt).getTime();
        const age = now - savedAt;
        if (dateSaved === 'today') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          if (savedAt < start.getTime()) return false;
        } else if (dateSaved === '7d' && age > 7 * 24 * 60 * 60 * 1000) {
          return false;
        } else if (dateSaved === '30d' && age > 30 * 24 * 60 * 60 * 1000) {
          return false;
        }
      }
      if (!q) return true;
      return [item.examName, item.provider, item.subject, item.question]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [enriched, provider, subject, dateSaved, search]);

  const clearFilters = () => {
    setSearch('');
    setProvider('all');
    setSubject('all');
    setDateSaved('all');
  };

  return (
    <div className="min-h-screen page-surface">
      <AppChrome
        title="Saved Questions"
        icon={<BookmarkCheck size={14} />}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {catalogError && (
          <Card className="text-center py-4 bg-warning-soft border-warning/40">
            <p className="text-sm text-warning-fg">
              Mock catalog could not be loaded — subject filters may be incomplete.
            </p>
          </Card>
        )}

        <Card>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
                <Bookmark size={13} /> Question bank
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-text">Saved Questions</h1>
              <p className="text-sm text-muted mt-2 max-w-2xl">
                Review every bookmarked question in one place and filter by provider, subject, and date saved.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0 lg:min-w-[26rem]">
              <Metric label="Saved" value={saved.length} />
              <Metric label="Shown" value={filtered.length} />
              <Metric label="Providers" value={providers.length} />
              <Metric label="Subjects" value={subjects.length} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Filters" icon={<Filter size={15} />} />
          <div className="space-y-4">
            <SearchPill
              value={search}
              onChange={setSearch}
              placeholder="Search saved questions"
              ariaLabel="Search saved questions"
              size="md"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-muted mb-1.5">Provider</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm text-text focus:outline-none focus:shadow-[var(--focus-ring)]"
                >
                  <option value="all">All providers</option>
                  {providers.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-muted mb-1.5">Subject</span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm text-text focus:outline-none focus:shadow-[var(--focus-ring)]"
                >
                  <option value="all">All subjects</option>
                  {subjects.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-muted mb-1.5">Date saved</span>
                <select
                  value={dateSaved}
                  onChange={(e) => setDateSaved(e.target.value as SavedDateFilter)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm text-text focus:outline-none focus:shadow-[var(--focus-ring)]"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {filtered.length} of {saved.length} saved question{saved.length === 1 ? '' : 's'} shown
              </p>
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        </Card>

        {filtered.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-2 grid place-items-center text-muted opacity-70">
              <BookmarkCheck size={28} />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              {saved.length === 0 ? 'No saved questions yet' : 'No questions match these filters'}
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto mb-6">
              {saved.length === 0
                ? 'Bookmark questions during an exam to build your personal revision list.'
                : 'Try a different provider, subject, or date range.'}
            </p>
            <Link to="/">
              <Button variant="primary">Back to dashboard</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <SavedQuestionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="text-2xl font-bold text-text tabular-nums leading-none">{value}</div>
      <div className="text-xs font-medium text-muted mt-1">{label}</div>
    </div>
  );
}

function SavedQuestionCard({ item }: { item: SavedQuestionRecord & { provider: string; subject: string } }) {
  const [expanded, setExpanded] = useState(false);

  const remove = () => {
    toggleSaveQuestion(item.examPath, item.examName, item.provider, {
      questionIdx: item.questionIdx,
      question: item.question,
      comp: item.comp,
      options: item.options,
      correct_option_id: item.correct_option_id,
      solution: item.solution,
      marks: item.marks,
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary-soft text-primary text-[11px] font-semibold">
                {item.provider}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-2 text-text-2 text-[11px] font-semibold">
                {item.subject}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 text-muted text-[11px] font-semibold">
                <CalendarDays size={12} /> {formatSavedDate(item.savedAt)}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${outcomeTone(item.lastOutcome)}`}>
                {item.lastOutcome ?? 'not attempted'}
              </span>
            </div>

            <h2 className="text-lg font-bold text-text tracking-[-0.015em]">{item.examName}</h2>
            <p className="text-xs text-muted mt-1">
              Question {item.questionIdx + 1} · Saved {formatSavedDateTime(item.savedAt)}
              {item.timesReviewed ? ` · Reviewed ${item.timesReviewed} time${item.timesReviewed === 1 ? '' : 's'}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Hide details' : 'Show details'}
            </Button>
            <Button variant="outline" size="sm" onClick={remove}>
              Remove
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-2 px-4 py-4">
          {item.comp && expanded && (
            <div className="mb-4 pb-4 border-b border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Passage</div>
              <SafeHtml html={item.comp} />
            </div>
          )}

          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Question</div>
          <SafeHtml html={item.question} />

          {expanded && (
            <>
              <div className="mt-5 space-y-2">
                {item.options.map((option, idx) => {
                  const isCorrect = idx === item.correct_option_id;
                  const isChosen = item.lastChosen === idx;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl px-3.5 py-3 border ${
                        isCorrect
                          ? 'border-success bg-success-soft/60'
                          : isChosen
                            ? 'border-danger bg-danger-soft/50'
                            : 'border-border bg-surface'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-surface-2 text-xs font-bold text-text grid place-items-center shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <SafeHtml html={option} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {item.solution && (
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Solution</div>
                  <SafeHtml html={item.solution} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
