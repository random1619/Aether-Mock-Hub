import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Zap,
  Clock,
  Shuffle,
  Layers,
  Sparkles,
  Timer,
  CheckCircle2,
  BookmarkCheck,
  Flame,
  Gauge,
  Sliders,
} from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { examPath } from '@/lib/examLink';
import {
  encodeBookmarkMockPath,
  calculateBookmarkMockDuration,
  DEFAULT_MINUTES_PER_QUESTION,
  type BookmarkMockConfig,
} from '@/services/bookmarkMock';

export type PacingPreset = 'standard' | 'speed' | 'deep' | 'custom';

export interface BookmarkMockModalProps {
  open: boolean;
  onClose: () => void;
  allSavedCount: number;
  filteredCount?: number;
  filteredIds?: string[];
  providers?: string[];
  subjects?: string[];
  activeSubjectFilter?: string;
  activeProviderFilter?: string;
}

export function BookmarkMockModal({
  open,
  onClose,
  allSavedCount,
  filteredCount,
  filteredIds,
  providers = [],
  subjects = [],
  activeSubjectFilter = 'all',
  activeProviderFilter = 'all',
}: BookmarkMockModalProps) {
  const navigate = useNavigate();

  // Scope selection: 'all' | 'filtered' | 'subject' | 'provider'
  const hasFilter =
    filteredCount !== undefined &&
    filteredCount > 0 &&
    filteredCount !== allSavedCount;

  const [scope, setScope] = useState<'all' | 'filtered' | 'subject' | 'provider'>(
    hasFilter ? 'filtered' : 'all',
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(
    activeSubjectFilter !== 'all' ? activeSubjectFilter : subjects[0] || '',
  );
  const [selectedProvider, setSelectedProvider] = useState<string>(
    activeProviderFilter !== 'all' ? activeProviderFilter : providers[0] || '',
  );

  // Sync initial scope if opened while filtered
  useEffect(() => {
    if (open) {
      if (hasFilter) {
        setScope('filtered');
      } else if (activeSubjectFilter !== 'all') {
        setScope('subject');
        setSelectedSubject(activeSubjectFilter);
      } else if (activeProviderFilter !== 'all') {
        setScope('provider');
        setSelectedProvider(activeProviderFilter);
      } else {
        setScope('all');
      }
    }
  }, [open, hasFilter, activeSubjectFilter, activeProviderFilter]);

  // Max available questions in current chosen scope
  const availableCount = useMemo(() => {
    if (scope === 'filtered') return filteredCount ?? allSavedCount;
    if (scope === 'all') return allSavedCount;
    return allSavedCount;
  }, [scope, filteredCount, allSavedCount]);

  // Question count subset
  const [questionCount, setQuestionCount] = useState<number>(availableCount || 10);
  const [shuffle, setShuffle] = useState<boolean>(true);
  const [groupBySubject, setGroupBySubject] = useState<boolean>(true);

  // Update questionCount when scope changes or available count shifts
  useEffect(() => {
    setQuestionCount(availableCount);
  }, [availableCount]);

  // Pacing / variable timing selection
  const [pacing, setPacing] = useState<PacingPreset>('standard');
  const [customMinutes, setCustomMinutes] = useState<number>(() =>
    calculateBookmarkMockDuration(availableCount || 10, DEFAULT_MINUTES_PER_QUESTION),
  );

  // Keep customMinutes updated with a reasonable default when question count changes
  const activeMinutesPerQuestion = useMemo(() => {
    if (pacing === 'speed') return 0.8;
    if (pacing === 'deep') return 2.0;
    if (pacing === 'standard') return 1.2;
    return questionCount > 0 ? Number((customMinutes / questionCount).toFixed(2)) : 1.2;
  }, [pacing, customMinutes, questionCount]);

  const totalDurationMinutes = useMemo(() => {
    if (pacing === 'custom') return Math.max(1, customMinutes);
    return calculateBookmarkMockDuration(questionCount, activeMinutesPerQuestion);
  }, [pacing, customMinutes, questionCount, activeMinutesPerQuestion]);

  const secPerQuestion = useMemo(() => {
    if (questionCount <= 0) return 72;
    return Math.round((totalDurationMinutes * 60) / questionCount);
  }, [totalDurationMinutes, questionCount]);

  const handleStartMock = () => {
    const config: BookmarkMockConfig = {
      scope,
      questionCount: questionCount < availableCount ? questionCount : undefined,
      shuffle,
      groupBySubject,
      minutesPerQuestion: pacing !== 'custom' ? activeMinutesPerQuestion : undefined,
      customDurationMinutes: pacing === 'custom' ? totalDurationMinutes : undefined,
    };

    if (scope === 'filtered' && filteredIds && filteredIds.length > 0) {
      config.questionIds = filteredIds;
      config.title = `Bookmark Mock — Filtered (${questionCount} Qs)`;
    } else if (scope === 'subject' && selectedSubject) {
      config.subject = selectedSubject;
      config.title = `Bookmark Mock — ${selectedSubject} (${questionCount} Qs)`;
    } else if (scope === 'provider' && selectedProvider) {
      config.provider = selectedProvider;
      config.title = `Bookmark Mock — ${selectedProvider} (${questionCount} Qs)`;
    } else {
      config.title = `Bookmark Mock — All Bookmarks (${questionCount} Qs)`;
    }

    const syntheticPath = encodeBookmarkMockPath(config);
    onClose();
    navigate(examPath(syntheticPath));
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      panelClassName="overflow-y-auto overscroll-contain"
    >
      <div className="space-y-3 sm:space-y-6 pt-0.5 sm:pt-0" data-lenis-prevent>
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary-soft text-primary text-[10px] sm:text-xs font-semibold mb-1 sm:mb-2">
            <Sparkles size={11} className="shrink-0" />
            <span>Custom Mock Test Engine</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-text">
            Practice Bookmarked Questions
          </h2>
          <p className="text-[11px] sm:text-sm text-muted mt-0.5 sm:mt-1 leading-relaxed">
            Generate a TCS-style exam from your saved questions.
          </p>
        </div>

        {/* Question Scope */}
        <div className="space-y-1.5 sm:space-y-3">
          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted">
            Question Source &amp; Scope
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex items-center justify-between p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all ${
                scope === 'all'
                  ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                  : 'border-border bg-surface-2 hover:bg-surface-3'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11px] sm:text-sm font-bold text-text flex items-center gap-1.5">
                  <BookmarkCheck size={13} className="text-primary shrink-0" />
                  <span>All Saved Questions</span>
                </div>
                <div className="text-[10px] sm:text-xs text-muted mt-0.5 truncate hidden sm:block">
                  Entire bookmarked question bank
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-text tabular-nums shrink-0 ml-2">
                {allSavedCount} Qs
              </span>
            </button>

            {hasFilter && (
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`flex items-center justify-between p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all ${
                  scope === 'filtered'
                    ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                    : 'border-border bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-sm font-bold text-text flex items-center gap-1.5">
                    <Sliders size={13} className="text-info shrink-0" />
                    <span>Current Filtered Set</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted mt-0.5 truncate hidden sm:block">
                    Matches current page filters
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-text tabular-nums shrink-0 ml-2">
                  {filteredCount} Qs
                </span>
              </button>
            )}

            {subjects.length > 0 && (
              <button
                type="button"
                onClick={() => setScope('subject')}
                className={`flex items-center justify-between p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all ${
                  scope === 'subject'
                    ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                    : 'border-border bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] sm:text-sm font-bold text-text flex items-center gap-1.5">
                    <Layers size={13} className="text-success shrink-0" />
                    <span>Specific Subject</span>
                  </div>
                  {scope === 'subject' ? (
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-full h-7 sm:h-8 px-2 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none"
                    >
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] sm:text-xs text-muted mt-0.5 truncate hidden sm:block">
                      Scope to a single subject
                    </div>
                  )}
                </div>
              </button>
            )}

            {providers.length > 0 && (
              <button
                type="button"
                onClick={() => setScope('provider')}
                className={`flex items-center justify-between p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all ${
                  scope === 'provider'
                    ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                    : 'border-border bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] sm:text-sm font-bold text-text flex items-center gap-1.5">
                    <Flame size={13} className="text-warning shrink-0" />
                    <span>Specific Provider</span>
                  </div>
                  {scope === 'provider' ? (
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-full h-7 sm:h-8 px-2 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none"
                    >
                      {providers.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] sm:text-xs text-muted mt-0.5 truncate hidden sm:block">
                      Scope to a specific mock source
                    </div>
                  )}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Question Count & Options */}
        <div className="rounded-xl sm:rounded-2xl bg-surface-2 p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted">
                Number of Questions
              </span>
              <div className="text-[11px] sm:text-sm font-semibold text-text mt-0.5">
                Practicing <span className="text-primary font-bold">{questionCount}</span> of{' '}
                {availableCount} questions
              </div>
            </div>

            {/* Preset count pills */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {[10, 20, 25, 50]
                .filter((n) => n < availableCount)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuestionCount(n)}
                    className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                      questionCount === n
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface text-text hover:bg-surface-3'
                    }`}
                  >
                    {n} Qs
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setQuestionCount(availableCount)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                  questionCount === availableCount
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-text hover:bg-surface-3'
                }`}
              >
                All ({availableCount})
              </button>
            </div>
          </div>

          {availableCount > 5 && (
            <input
              type="range"
              min={1}
              max={availableCount}
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
              className="w-full h-1.5 sm:h-2 rounded-lg bg-surface accent-primary cursor-pointer"
            />
          )}

          {/* Toggles */}
          <div className="flex flex-row items-center gap-4 sm:gap-5 pt-2 border-t border-border/60 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-text select-none">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded accent-primary cursor-pointer"
              />
              <span className="font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                <Shuffle size={11} className="text-muted shrink-0" /> Shuffle
              </span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer text-text select-none">
              <input
                type="checkbox"
                checked={groupBySubject}
                onChange={(e) => setGroupBySubject(e.target.checked)}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded accent-primary cursor-pointer"
              />
              <span className="font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                <Layers size={11} className="text-muted shrink-0" /> Group by subject
              </span>
            </label>
          </div>
        </div>

        {/* Variable Timing & Pacing Configuration */}
        <div className="space-y-1.5 sm:space-y-3">
          <div className="flex items-center justify-between gap-0.5">
            <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted">
              Variable Timing &amp; Pacing
            </label>
            <span className="text-[10px] sm:text-xs text-muted hidden sm:inline">
              Auto-scales with question count
            </span>
          </div>

          {/* Horizontal scroll on mobile, 3-col grid on desktop */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible scrollbar-none">
            <div className="flex sm:grid sm:grid-cols-3 gap-2 sm:gap-3 min-w-max sm:min-w-0">
              {/* Standard Exam Pace (1.2m/Q) */}
              <button
                type="button"
                onClick={() => setPacing('standard')}
                className={`w-[10rem] sm:w-auto p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all shrink-0 sm:shrink ${
                  pacing === 'standard'
                    ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-1.5">
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-primary">
                    <Gauge size={12} className="shrink-0" />
                    <span>Standard</span>
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    Rec
                  </span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-text tabular-nums">
                  {calculateBookmarkMockDuration(questionCount, 1.2)}m
                </div>
                <div className="text-[9px] sm:text-[11px] text-muted mt-0.5 leading-tight">
                  ~72s/Q · TCS
                </div>
              </button>

              {/* Speed Drill (0.8m/Q) */}
              <button
                type="button"
                onClick={() => setPacing('speed')}
                className={`w-[10rem] sm:w-auto p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all shrink-0 sm:shrink ${
                  pacing === 'speed'
                    ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-1.5">
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-warning-fg">
                    <Zap size={12} className="shrink-0" />
                    <span>Speed</span>
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-fg">
                    Rapid
                  </span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-text tabular-nums">
                  {calculateBookmarkMockDuration(questionCount, 0.8)}m
                </div>
                <div className="text-[9px] sm:text-[11px] text-muted mt-0.5 leading-tight">
                  ~48s/Q · Drill
                </div>
              </button>

              {/* Deep Focus (2.0m/Q) */}
              <button
                type="button"
                onClick={() => setPacing('deep')}
                className={`w-[10rem] sm:w-auto p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all shrink-0 sm:shrink ${
                  pacing === 'deep'
                    ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-1.5">
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-info">
                    <Clock size={12} className="shrink-0" />
                    <span>In-Depth</span>
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-info-soft text-info">
                    Relaxed
                  </span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-text tabular-nums">
                  {calculateBookmarkMockDuration(questionCount, 2.0)}m
                </div>
                <div className="text-[9px] sm:text-[11px] text-muted mt-0.5 leading-tight">
                  ~120s/Q · Deep
                </div>
              </button>
            </div>
          </div>

          {/* Custom time option */}
          <div className="rounded-xl sm:rounded-2xl bg-surface-2 p-2 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="pacing-type"
                checked={pacing === 'custom'}
                onChange={() => setPacing('custom')}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-primary cursor-pointer"
              />
              <span className="text-[11px] sm:text-xs font-bold text-text flex items-center gap-1">
                <Timer size={12} className="text-muted shrink-0" /> Custom
              </span>
            </label>

            {pacing === 'custom' ? (
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <input
                  type="range"
                  min={1}
                  max={Math.max(180, questionCount * 3)}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(parseInt(e.target.value, 10))}
                  className="flex-1 sm:w-36 h-1.5 sm:h-2 rounded-lg bg-surface accent-primary cursor-pointer"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-12 h-7 sm:h-8 px-1 rounded-lg bg-surface border border-border text-[11px] sm:text-xs font-bold text-center text-text focus:outline-none"
                  />
                  <span className="text-[10px] text-muted font-medium">m</span>
                </div>
              </div>
            ) : (
              <span className="text-[10px] sm:text-xs text-muted">
                Set custom exam time
              </span>
            )}
          </div>
        </div>

        {/* Live Examination Summary Card */}
        <div className="rounded-xl sm:rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/30 to-surface-2 p-2.5 sm:p-4">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 text-center sm:text-left">
            <div>
              <div className="text-[9px] sm:text-[11px] font-semibold text-muted">Qs</div>
              <div className="text-sm sm:text-xl font-extrabold text-text tabular-nums mt-0.5">
                {questionCount}
              </div>
            </div>

            <div>
              <div className="text-[9px] sm:text-[11px] font-semibold text-muted">Time</div>
              <div className="text-sm sm:text-xl font-extrabold text-primary tabular-nums mt-0.5">
                {totalDurationMinutes}m
              </div>
            </div>

            <div>
              <div className="text-[9px] sm:text-[11px] font-semibold text-muted">Pace</div>
              <div className="text-sm sm:text-xl font-extrabold text-text tabular-nums mt-0.5">
                {secPerQuestion}s
              </div>
            </div>

            <div>
              <div className="text-[9px] sm:text-[11px] font-semibold text-muted">Skin</div>
              <div className="text-[10px] sm:text-xs font-bold text-text-2 mt-0.5 sm:mt-1 inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-surface">
                <CheckCircle2 size={10} className="text-success shrink-0" /> TCS
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions — pb includes safe area for mobile bottom nav */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-1 sm:pt-2 pb-[env(safe-area-inset-bottom,0px)]">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm">
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={<Play size={14} />}
            onClick={handleStartMock}
            className="w-full sm:w-auto h-10 sm:h-11 font-bold shadow-md text-xs sm:text-sm"
          >
            Start Mock
          </Button>
        </div>
      </div>
    </Modal>
  );
}
