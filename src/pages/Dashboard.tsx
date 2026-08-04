import { useEffect, useMemo, useState } from 'react';
import { loadMockCatalog, providersOf, subjectsOf } from '@/services/mockCatalog';
import {
  getStats, getLatestScoresMap, isComplete, onDbChange,
  getTodayProgress, getDayActivity, getDailyGoal, setDailyGoal, getDb,
  getAllSavedQuestions, getMyList, getLatestAttempt, isInMyList, toggleMyList, localDayKey,
} from '@/services/attemptStore';
import { countWrongQuestions } from '@/services/smartRevision';
import { computeSectionStats } from '@/services/sectionAnalytics';
import { useMockFilters, useCompletionToggle, filterMocks } from '@/hooks/useMockFilters';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MockEntry } from '@/types';
import {
  HeroBand, StatStrip, CommandDeck, FocusRail, WeakSections, FilterBar, MockGrid, ProviderCards,
  SubjectShelves, BrowseTree, MockDetailModal, MyListRail,
} from '@/components/dashboard';
import type { FocusItem } from '@/components/dashboard';
import { useSmoothScroll } from '@/components/layout/SmoothScroll';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Dashboard() {
  const [mocks, setMocks] = useState<MockEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMock, setSelectedMock] = useState<MockEntry | null>(null);
  const { search, setSearch, subject, setSubject, status, setStatus, visible, loadMore, reset } = useMockFilters();
  const [provider, setProvider] = useState<string>('all');
  const [dbTick, setTick] = useState(0); // bumped on any aether-db write (same-tab or cross-tab)
  const { theme, toggleTheme } = useSettingsStore();
  const { update } = useSmoothScroll();

  useEffect(() => {
    loadMockCatalog()
      .then(setMocks)
      .catch((e: Error) => setError(e.message));
    return onDbChange(() => setTick((t) => t + 1));
  }, []);

  // Recalculate scroll bounds whenever the DOM changes (catalog loaded, filters
  // toggled, etc.) so LS keeps parallax and sticky positions accurate.
  useEffect(() => {
    if (mocks) update();
  }, [mocks, update]);

  /* Stats/scores derive from aether-db, not the catalog — key memos on dbTick so
     a submit/toggle in any tab re-derives without waiting for mocks to reload. */
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick, not mocks
  const stats = useMemo(() => getStats(), [dbTick]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick, not mocks
  const scoresMap = useMemo(() => getLatestScoresMap(), [dbTick]);

  const mockByPath = useMemo(() => new Map((mocks ?? []).map((m) => [m.path, m])), [mocks]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const myList = useMemo(() => getMyList().map((path) => mockByPath.get(path)).filter((mock): mock is MockEntry => Boolean(mock)), [dbTick, mockByPath]);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- isComplete reads aether-db; dbTick re-derives on any write
  const filtered = useMemo(
    () => (mocks ? filterMocks(mocks, { search, provider, subject, status }, { searchProvider: true }) : []),
    [mocks, search, provider, subject, status, dbTick],
  );

  const shown = filtered.slice(0, visible);
  const providers = useMemo(() => (mocks ? providersOf(mocks) : []), [mocks]);
  const subjects = useMemo(() => (mocks ? subjectsOf(mocks) : []), [mocks]);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- isComplete reads aether-db; dbTick re-derives on any write
  const completedCount = useMemo(() => (mocks ? mocks.filter((m) => isComplete(m.path)).length : 0), [mocks, dbTick]);
  const progressPct = mocks && mocks.length ? Math.round((completedCount / mocks.length) * 100) : 0;

  /* Command deck data (all live from aether-db). */
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const today = useMemo(() => getTodayProgress(), [dbTick]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const activity = useMemo(() => getDayActivity(), [dbTick]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const goal = useMemo(() => getDailyGoal(), [dbTick]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const wrongCount = useMemo(() => countWrongQuestions(), [dbTick]);
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on dbTick
  const saved = useMemo(() => getAllSavedQuestions(), [dbTick]);

  // Last 7 days, oldest → newest (today last).
  const week = useMemo(() => {
    const days: Array<{ letter: string; met: boolean; isToday: boolean; done: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDayKey(d);
      const done = activity[key] || 0;
      days.push({ letter: DAY_LETTERS[d.getDay()], met: done >= goal, isToday: i === 0, done });
    }
    return days;
  }, [activity, goal]);

  /* Focus rail: recent attempts joined to catalog, newest first. */
  const recents = useMemo<FocusItem[]>(() => {
    const rows: FocusItem[] = [];
    Object.entries(scoresMap).forEach(([path, attempt]) => {
      const mock = mockByPath.get(path);
      if (mock) rows.push({ mock, attempt });
    });
    return rows
      .sort((a, b) => b.attempt.submittedAt.localeCompare(a.attempt.submittedAt))
      .slice(0, 6);
  }, [scoresMap, mockByPath]);

  /* Weak-section spotlight: bottom 5 by accuracy (nulls excluded). */
  const weakSections = useMemo(
    () => computeSectionStats(getDb()).filter((s) => s.accuracy !== null).slice(0, 5),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- reads aether-db via getDb; re-derives on dbTick
    [dbTick],
  );

  /* Subject shelves: group the catalog by subject, biggest subjects first. */
  const bySubject = useMemo(() => {
    if (!mocks) return [];
    const map = new Map<string, MockEntry[]>();
    mocks.forEach((m) => {
      const key = m.subject && m.subject !== 'General' ? m.subject : 'General';
      const arr = map.get(key);
      if (arr) arr.push(m);
      else map.set(key, [m]);
    });
    return [...map.entries()]
      .map(([subject, list]) => ({ subject, mocks: list }))
      .sort((a, b) => b.mocks.length - a.mocks.length);
  }, [mocks]);

  const resetFilters = () => {
    reset();
    setProvider('all');
  };

  const handleToggle = useCompletionToggle(() => setTick((t) => t + 1));

  return (
    <div className="min-h-screen page-surface" data-scroll-section>
      {/* Hero: full-bleed section with subtle parallax on the inner content */}
      <HeroBand
        search={search}
        onSearch={setSearch}
        theme={theme}
        onToggleTheme={toggleTheme}
        mockCount={mocks?.length ?? null}
        onOpenInfo={() => {
          if (mocks && mocks.length > 0) setSelectedMock(mocks[0]);
        }}
        mocks={mocks ?? []}
      >
        <div data-scroll data-scroll-speed="0.6">
          <StatStrip
            stats={stats}
            progressPct={progressPct}
            completedCount={completedCount}
            total={mocks?.length ?? null}
          />
        </div>
      </HeroBand>

      {/* Command deck + weak sections — staggered reveal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6 apple-reveal" data-scroll data-scroll-section>
        <CommandDeck
          today={today}
          goal={goal}
          onSetGoal={setDailyGoal}
          week={week}
          wrongCount={wrongCount}
          saved={saved}
        />

        <WeakSections sections={weakSections} />
      </div>

      {/* Cinematic rails — each row reveals as it enters the viewport */}
      <div className="max-w-7xl mx-auto py-10 space-y-12" data-scroll-section>
        <div className="apple-reveal" data-scroll>
          <FocusRail items={recents} />
          <MyListRail
            mocks={myList}
            scoresMap={scoresMap}
            isDone={isComplete}
            onToggleDone={handleToggle}
            onOpenModal={(mock) => { setSelectedMock(mock); }}
          />
        </div>

        <div id="browse-tree" className="apple-reveal" data-scroll data-scroll-speed="0.4">
          <BrowseTree
            mocks={mocks ?? []}
            scoresMap={scoresMap}
            isDone={isComplete}
            onToggle={handleToggle}
          />
        </div>

        <div id="all-mocks" className="apple-reveal" data-scroll>
          <FilterBar
            provider={provider}
            subject={subject}
            status={status}
            providers={providers}
            subjects={subjects}
            filteredCount={filtered.length}
            onProvider={setProvider}
            onSubject={setSubject}
            onStatus={setStatus}
            onReset={resetFilters}
          />

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
            onOpenModal={(mock) => { setSelectedMock(mock); }}
            onReset={resetFilters}
          />
        </div>
      </div>

      {/* Providers section */}
      <div id="providers" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12" data-scroll-section>
        <div className="apple-reveal" data-scroll>
          <ProviderCards mocks={mocks} />
        </div>

        <div className="apple-reveal" data-scroll>
          <SubjectShelves
            bySubject={bySubject}
            scoresMap={scoresMap}
            isDone={isComplete}
            onToggle={handleToggle}
            onOpenModal={(mock) => { setSelectedMock(mock); }}
          />
        </div>
      </div>

      {selectedMock && (
        <MockDetailModal
          mock={selectedMock}
          done={isComplete(selectedMock.path)}
          attempt={getLatestAttempt(selectedMock.path)}
          inMyList={isInMyList(selectedMock.path)}
          onClose={() => { setSelectedMock(null); }}
          onToggleDone={() => { handleToggle(selectedMock); }}
          onToggleMyList={() => { toggleMyList(selectedMock.path); setTick((t) => t + 1); }}
        />
      )}
    </div>
  );
}
