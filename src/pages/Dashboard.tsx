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
  SubjectShelves, BrowseTree, MockDetailModal, MyListRail, BadgeShelf,
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

  // Others organized: subject -> topic -> mocks (precise hierarchy for the 579 newly organized)
  const othersBySubjectTopic = useMemo(() => {
    if (!mocks) return [];
    const others = mocks.filter(m=> m.provider==='Others');
    const bySubj = new Map<string, Map<string, MockEntry[]>>();
    others.forEach(m=>{
      const subj = m.subject || 'General';
      const topicKey = m.topic ? `${m.topic}${m.subtopic? ` — ${m.subtopic}`:''}` : (m.category || 'General');
      let byTopic = bySubj.get(subj);
      if(!byTopic) bySubj.set(subj, byTopic=new Map());
      const list = byTopic.get(topicKey) || [];
      list.push(m);
      byTopic.set(topicKey, list);
    });
    return [...bySubj.entries()].map(([subject, topicMap])=> ({
      subject,
      topics: [...topicMap.entries()].map(([topic, list])=> ({topic, mocks:list})).sort((a,b)=> b.mocks.length - a.mocks.length)
    })).sort((a,b)=> b.topics.reduce((s,t)=>s+t.mocks.length,0) - a.topics.reduce((s,t)=>s+t.mocks.length,0));
  }, [mocks]);

  const resetFilters = () => {
    reset();
    setProvider('all');
  };

  const handleToggle = useCompletionToggle(() => setTick((t) => t + 1));

  return (
    <div className="min-h-screen page-surface mobile-page-shell md:pb-0 dashboard-mobile-rhythm" data-scroll-section>
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

      {/* Command deck + weak sections + Badge shelf — staggered reveal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6 apple-reveal" data-scroll data-scroll-section>
        <CommandDeck
          today={today}
          goal={goal}
          onSetGoal={setDailyGoal}
          week={week}
          wrongCount={wrongCount}
          saved={saved}
        />

        <BadgeShelf />

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

      {/* Others Organized - APK perfect: compact rails, 44px touch, snap, no overflow */}
      {othersBySubjectTopic.length>0 && (
        <div id="others-organized" className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8" data-scroll-section>
          <div className="apple-reveal" data-scroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 sm:mb-6">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-[22px] font-bold tracking-[-0.02em] text-text flex flex-wrap items-center gap-2">
                  <span className="w-1.5 h-6 bg-primary rounded-full shrink-0" aria-hidden />
                  Others — Organized
                  <span className="text-[10px] sm:text-xs font-bold text-white bg-primary px-2 py-1 rounded-full shrink-0">579 classified</span>
                </h2>
                <p className="text-xs sm:text-[13px] text-muted mt-1 leading-relaxed">Subject → Topic • every file content-checked</p>
              </div>
            </div>
            <div className="space-y-8 sm:space-y-10">
              {othersBySubjectTopic.map(({subject, topics})=> (
                <div key={subject} className="space-y-3 sm:space-y-4">
                  <h3 className="text-sm sm:text-base font-bold tracking-[-0.01em] text-text flex flex-wrap items-center gap-2">
                    <span className="w-1 h-4 bg-primary/70 rounded-full shrink-0" /> <span className="truncate">{subject}</span>
                    <span className="text-[11px] sm:text-xs font-medium text-muted bg-surface-2 px-2 py-1 rounded-full shrink-0">{topics.reduce((s,t)=>s+t.mocks.length,0)} • {topics.length} topics</span>
                  </h3>
                  {topics.slice(0,4).map(({topic, mocks: tMocks})=> (
                    <div key={topic} className="ml-2 sm:ml-4">
                      <h4 className="text-xs sm:text-sm font-semibold text-text-2 mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-muted rounded-full shrink-0" /> <span className="truncate">{topic}</span>
                        <span className="text-[11px] sm:text-xs text-muted shrink-0">({tMocks.length})</span>
                      </h4>
                      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 overscroll-x-contain" style={{WebkitOverflowScrolling: 'touch'} as any}>
                        {tMocks.slice(0,8).map(m=> (
                          <div key={m.path} className="snap-start shrink-0">
                            <div className="w-[160px] sm:w-56">
                              <div className="text-[10px] font-medium text-muted truncate mb-1.5 px-0.5">{m.topic}{m.subtopic? ` • ${m.subtopic}`:''}</div>
                              <button onClick={()=> setSelectedMock(m)} className="w-full text-left rounded-xl bg-surface border border-border p-3 active:scale-[0.97] hover:border-primary/50 hover:shadow-sm transition-all min-h-[88px] flex flex-col justify-between">
                                <div className="text-sm font-semibold text-text line-clamp-2 leading-snug">{m.name}</div>
                                <div className="text-xs text-muted mt-2 flex items-center gap-1.5"><span className="w-1 h-1 bg-primary rounded-full" />{m.totalQuestions ?? ''} Qs • {m.format || 'Mock'}</div>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
