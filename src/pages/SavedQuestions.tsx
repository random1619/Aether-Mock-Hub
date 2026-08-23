import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Filter,
  BarChart3,
  Play,
  Zap,
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  Tag,
  Star,
  FileText,
  Sparkles,
  Download,
  CheckSquare,
  Square,
  ChevronDown,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  X,
  Check,
  Plus,
} from 'lucide-react';
import {
  getAllSavedQuestions,
  onDbChange,
  toggleSaveQuestion,
  getBookmarkFolders,
  createBookmarkFolder,
  updateBookmarkFolder,
  deleteBookmarkFolder,
  batchUpdateSavedQuestions,
  batchDeleteSavedQuestions,
  toggleStarQuestion,
  setQuestionFolder,
  setQuestionNotes,
  setQuestionPriority,
  addQuestionTag,
  removeQuestionTag,
} from '@/services/attemptStore';
import { loadMockCatalog } from '@/services/mockCatalog';
import { SafeHtml, Card, CardHeader, Button } from '@/components/ui';
import { SearchPill } from '@/components/dashboard';
import { AppChrome } from '@/components/layout';
import { BookmarkMockModal } from '@/components/exam/BookmarkMockModal';
import {
  BookmarkFolderModal,
  getFolderColorClasses,
  getFolderIconComponent,
} from '@/components/bookmarks/BookmarkFolderModal';
import { BookmarkFlashcardsModal } from '@/components/bookmarks/BookmarkFlashcardsModal';
import { BookmarkQuickQuizModal } from '@/components/bookmarks/BookmarkQuickQuizModal';
import { BookmarkExportModal } from '@/components/bookmarks/BookmarkExportModal';
import type { MockEntry, SavedQuestionRecord, BookmarkFolder } from '@/types';

type SavedDateFilter = 'all' | 'today' | '7d' | '30d';
type OutcomeFilter = 'all' | 'incorrect' | 'correct' | 'skipped' | 'unattempted';
type PriorityFilter = 'all' | 'starred' | 'high' | 'medium' | 'low';
type SortOption = 'newest' | 'oldest' | 'priority' | 'least-reviewed' | 'most-reviewed';

function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function outcomeTone(outcome?: SavedQuestionRecord['lastOutcome']): string {
  if (outcome === 'correct') return 'bg-success-soft text-success-fg border-success/30';
  if (outcome === 'incorrect') return 'bg-danger-soft text-danger-fg border-danger/30';
  if (outcome === 'skipped') return 'bg-warning-soft text-warning-fg border-warning/30';
  return 'bg-surface-2 text-muted border-border';
}

function priorityTone(priority?: 'high' | 'medium' | 'low'): { badge: string; text: string } {
  if (priority === 'high') return { badge: 'bg-danger-soft text-danger-fg border-danger/30', text: 'High' };
  if (priority === 'medium') return { badge: 'bg-warning-soft text-warning-fg border-warning/30', text: 'Med' };
  if (priority === 'low') return { badge: 'bg-primary-soft text-primary border-primary/30', text: 'Low' };
  return { badge: 'bg-surface-2 text-muted border-border', text: 'Normal' };
}

export default function SavedQuestions() {
  const [saved, setSaved] = useState<SavedQuestionRecord[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [mocks, setMocks] = useState<MockEntry[]>([]);
  const [catalogError, setCatalogError] = useState(false);

  // Active Category / Folder selection
  const [activeFolderId, setActiveFolderId] = useState<string>('all');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [subject, setSubject] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [dateSaved, setDateSaved] = useState<SavedDateFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Multi-select batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [mockInitialScope, setMockInitialScope] = useState<
    'all' | 'filtered' | 'category' | 'mistakes' | 'subject' | 'provider' | undefined
  >(undefined);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<BookmarkFolder | null>(null);
  const [flashcardsModalOpen, setFlashcardsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<
    (SavedQuestionRecord & { provider: string; subject: string }) | null
  >(null);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState<{ message: string; undoAction?: () => void } | null>(null);

  useEffect(() => {
    const sync = () => {
      setSaved(getAllSavedQuestions());
      setFolders(getBookmarkFolders());
    };
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

  // Enrich saved questions with mock catalog metadata & default folder
  const enriched = useMemo(
    () =>
      saved.map((item) => {
        const meta = metaByPath.get(item.examPath);
        return {
          ...item,
          folderId: item.folderId || 'default',
          provider: item.provider ?? meta?.provider ?? 'Unknown',
          subject: meta?.subject ?? 'Unknown',
        };
      }),
    [saved, metaByPath],
  );

  // Folder question count mapping
  const folderQuestionsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((f) => {
      counts[f.id] = 0;
    });
    enriched.forEach((item) => {
      const fId = item.folderId || 'default';
      counts[fId] = (counts[fId] || 0) + 1;
    });
    return counts;
  }, [folders, enriched]);

  // Mistakes count
  const mistakesCount = useMemo(
    () => enriched.filter((item) => item.lastOutcome === 'incorrect').length,
    [enriched],
  );

  // Starred count
  const starredCount = useMemo(
    () => enriched.filter((item) => item.isStarred || item.priority === 'high').length,
    [enriched],
  );

  // Providers and Subjects list
  const providers = useMemo(
    () => [...new Set(enriched.map((item) => item.provider).filter(Boolean))].sort(),
    [enriched],
  );

  const subjects = useMemo(
    () => [...new Set(enriched.map((item) => item.subject).filter(Boolean))].sort(),
    [enriched],
  );

  // All unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    enriched.forEach((item) => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((t) => tagSet.add(t));
      }
    });
    return [...tagSet].sort();
  }, [enriched]);

  // Filtered & Sorted list
  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();

    let list = enriched.filter((item) => {
      // Folder / Category filter
      if (activeFolderId !== 'all') {
        if (activeFolderId === 'mistakes') {
          if (item.lastOutcome !== 'incorrect') return false;
        } else if (item.folderId !== activeFolderId && !(Array.isArray(item.folderIds) && item.folderIds.includes(activeFolderId))) {
          return false;
        }
      }

      // Provider filter
      if (provider !== 'all' && item.provider !== provider) return false;

      // Subject filter
      if (subject !== 'all' && item.subject !== subject) return false;

      // Outcome filter
      if (outcomeFilter !== 'all') {
        if (outcomeFilter === 'unattempted' && item.lastOutcome) return false;
        if (outcomeFilter !== 'unattempted' && item.lastOutcome !== outcomeFilter) return false;
      }

      // Priority filter
      if (priorityFilter !== 'all') {
        if (priorityFilter === 'starred' && !item.isStarred) return false;
        if (priorityFilter !== 'starred' && item.priority !== priorityFilter) return false;
      }

      // Has Notes filter
      if (hasNotesOnly && !item.notes) return false;

      // Tag filter
      if (selectedTag && (!Array.isArray(item.tags) || !item.tags.includes(selectedTag))) {
        return false;
      }

      // Date saved filter
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

      // Search query filter (searches question, options, solution, notes, tags, exam name)
      if (q) {
        const searchable = [
          item.examName,
          item.provider,
          item.subject,
          item.question,
          ...(item.options || []),
          item.solution || '',
          item.notes || '',
          ...(item.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'newest') {
        return b.savedAt.localeCompare(a.savedAt);
      }
      if (sortBy === 'oldest') {
        return a.savedAt.localeCompare(b.savedAt);
      }
      if (sortBy === 'priority') {
        const pWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const weightA = (a.isStarred ? 4 : 0) + (pWeight[a.priority || ''] || 0);
        const weightB = (b.isStarred ? 4 : 0) + (pWeight[b.priority || ''] || 0);
        return weightB - weightA;
      }
      if (sortBy === 'least-reviewed') {
        return (a.timesReviewed || 0) - (b.timesReviewed || 0);
      }
      if (sortBy === 'most-reviewed') {
        return (b.timesReviewed || 0) - (a.timesReviewed || 0);
      }
      return 0;
    });

    return list;
  }, [
    enriched,
    activeFolderId,
    provider,
    subject,
    outcomeFilter,
    priorityFilter,
    hasNotesOnly,
    selectedTag,
    dateSaved,
    search,
    sortBy,
  ]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId),
    [folders, activeFolderId],
  );

  const clearFilters = () => {
    setSearch('');
    setProvider('all');
    setSubject('all');
    setOutcomeFilter('all');
    setPriorityFilter('all');
    setHasNotesOnly(false);
    setDateSaved('all');
    setSelectedTag(null);
    setSortBy('newest');
  };

  const hasActiveFilter =
    search !== '' ||
    provider !== 'all' ||
    subject !== 'all' ||
    outcomeFilter !== 'all' ||
    priorityFilter !== 'all' ||
    hasNotesOnly ||
    dateSaved !== 'all' ||
    selectedTag !== null;

  // Folder creation / edit handler
  const handleSaveFolder = (data: { name: string; color: string; icon: string; description: string }) => {
    if (editingFolder) {
      updateBookmarkFolder(editingFolder.id, data);
    } else {
      const created = createBookmarkFolder(data.name, data.color, data.icon, data.description);
      setActiveFolderId(created.id);
    }
    setEditingFolder(null);
  };

  const handleDeleteFolder = (id: string) => {
    deleteBookmarkFolder(id);
    if (activeFolderId === id) {
      setActiveFolderId('all');
    }
  };

  // Batch actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchMoveFolder = (folderId: string) => {
    if (!selectedIds.size) return;
    batchUpdateSavedQuestions([...selectedIds], { folderId });
    setSelectedIds(new Set());
  };

  const handleBatchSetPriority = (priority: 'high' | 'medium' | 'low') => {
    if (!selectedIds.size) return;
    batchUpdateSavedQuestions([...selectedIds], { priority });
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    batchDeleteSavedQuestions([...selectedIds]);
    setSelectedIds(new Set());
    setUndoToast({
      message: `Removed ${count} questions from bookmarks`,
    });
    setTimeout(() => setUndoToast(null), 4000);
  };

  const handleLaunchSelectedMock = () => {
    if (!selectedIds.size) return;
    setMockInitialScope('filtered');
    setMockModalOpen(true);
  };

  const openFolderMock = (folderId?: string) => {
    if (folderId && folderId !== 'all') {
      setActiveFolderId(folderId);
      setMockInitialScope('category');
    } else {
      setMockInitialScope('all');
    }
    setMockModalOpen(true);
  };

  return (
    <div className="min-h-screen page-surface mobile-page-shell md:pb-12">
      <AppChrome
        title="Bookmarks Hub"
        icon={<BookmarkCheck size={14} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/analytics"
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label="Analytics"
            >
              <BarChart3 size={15} />
            </Link>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {catalogError && (
          <Card className="text-center py-3 bg-warning-soft border-warning/40">
            <p className="text-xs sm:text-sm text-warning-fg">
              Mock catalog could not be loaded — subject filters may be incomplete.
            </p>
          </Card>
        )}

        {/* ── Top Hero & Actions Bar ─────────────────────────────── */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-surface to-surface-2 border-border/80 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-bold">
                <Sparkles size={13} />
                <span>Bookmark Question Bank &amp; Categories</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text">
                Saved Questions Hub
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
                Organize bookmarked questions into custom categories, add personal notes &amp; tags,
                and generate targeted TCS-style mock exams from any folder or weak area.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-3">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Play size={15} />}
                  onClick={() => openFolderMock(activeFolderId)}
                  className="font-bold shadow-md h-10 text-xs sm:text-sm"
                  disabled={saved.length === 0}
                >
                  {activeFolderId !== 'all' && activeFolder
                    ? `Take "${activeFolder.name}" Mock`
                    : 'Take Bookmark Mock'}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Zap size={15} className="text-amber-400" />}
                  onClick={() => setFlashcardsModalOpen(true)}
                  className="h-10 text-xs sm:text-sm font-semibold"
                  disabled={filtered.length === 0}
                >
                  Flashcard Mode ({filtered.length})
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<FolderPlus size={15} />}
                  onClick={() => {
                    setEditingFolder(null);
                    setFolderModalOpen(true);
                  }}
                  className="h-10 text-xs sm:text-sm font-semibold"
                >
                  New Category
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Download size={15} />}
                  onClick={() => setExportModalOpen(true)}
                  className="h-10 text-xs sm:text-sm"
                  disabled={filtered.length === 0}
                >
                  Export &amp; Print
                </Button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-w-0 lg:min-w-[28rem]">
              <MetricItem label="Total Saved" value={saved.length} icon={<Bookmark size={14} className="text-primary" />} />
              <MetricItem label="Categories" value={folders.length} icon={<Folder size={14} className="text-emerald-400" />} />
              <MetricItem label="Mistakes" value={mistakesCount} icon={<AlertTriangle size={14} className="text-rose-400" />} />
              <MetricItem label="Starred" value={starredCount} icon={<Star size={14} className="text-amber-400" />} />
            </div>
          </div>
        </Card>

        {/* ── Category / Folder Tabs & Navigator ──────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Folder size={13} className="text-primary" />
              <span>Browse by Category / Folder</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingFolder(null);
                setFolderModalOpen(true);
              }}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <Plus size={13} /> Add Category
            </button>
          </div>

          {/* Horizontal category cards/pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* All Questions Card */}
            <button
              type="button"
              onClick={() => setActiveFolderId('all')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                activeFolderId === 'all'
                  ? 'border-primary bg-primary-soft/60 ring-2 ring-primary/40 shadow-sm'
                  : 'border-border bg-surface hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
                  <BookmarkCheck size={16} />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-2 text-text tabular-nums">
                  {saved.length}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-text truncate">All Bookmarks</div>
              <div className="text-[10px] text-muted truncate mt-0.5">Master question bank</div>
            </button>

            {/* Mistakes & Revisit Drill Card */}
            {mistakesCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFolderId('mistakes')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  activeFolderId === 'mistakes'
                    ? 'border-danger bg-danger-soft/60 ring-2 ring-danger/40 shadow-sm'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-danger-soft text-danger-fg grid place-items-center">
                    <AlertTriangle size={16} />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-danger-soft text-danger-fg tabular-nums">
                    {mistakesCount}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-danger-fg truncate">Mistakes Drill</div>
                <div className="text-[10px] text-muted truncate mt-0.5">Incorrect answers</div>
              </button>
            )}

            {/* User Custom and Default Folders */}
            {folders.map((f) => {
              const IconComp = getFolderIconComponent(f.icon);
              const colorCls = getFolderColorClasses(f.color);
              const count = folderQuestionsMap[f.id] ?? 0;
              const isSelected = activeFolderId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className={`group relative p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary-soft/60 ring-2 ring-primary/40 shadow-sm'
                      : 'border-border bg-surface hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-xl grid place-items-center border ${colorCls.badge}`}>
                      <IconComp size={16} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-2 text-text tabular-nums">
                        {count}
                      </span>
                      {/* Edit Button for category */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolder(f);
                          setFolderModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-surface-3 text-muted hover:text-text transition-opacity"
                        title="Edit category"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-text truncate">{f.name}</div>
                  <div className="text-[10px] text-muted truncate mt-0.5">
                    {f.description || `${count} questions`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Search, Filters & Controls ─────────────────────────── */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <CardHeader title="Search &amp; Filter Questions" icon={<Filter size={15} />} />
            {hasActiveFilter && (
              <Button variant="secondary" size="sm" onClick={clearFilters} className="text-xs h-7">
                Clear all filters
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {/* Search Input */}
            <SearchPill
              value={search}
              onChange={setSearch}
              placeholder="Search across questions, options, explanations, notes, or tags..."
              ariaLabel="Search bookmark questions"
              size="md"
            />

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {/* Category Dropdown */}
              <label className="block">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Category
                </span>
                <select
                  value={activeFolderId}
                  onChange={(e) => setActiveFolderId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Categories ({saved.length})</option>
                  {mistakesCount > 0 && <option value="mistakes">Mistakes Drill ({mistakesCount})</option>}
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({folderQuestionsMap[f.id] ?? 0})
                    </option>
                  ))}
                </select>
              </label>

              {/* Provider Dropdown */}
              <label className="block">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Provider
                </span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Providers</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              {/* Subject Dropdown */}
              <label className="block">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Subject
                </span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {/* Outcome Status Dropdown */}
              <label className="block">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Outcome
                </span>
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Outcomes</option>
                  <option value="incorrect">Incorrect Only (Weak)</option>
                  <option value="correct">Correct Only (Mastered)</option>
                  <option value="skipped">Skipped</option>
                  <option value="unattempted">Not Attempted</option>
                </select>
              </label>

              {/* Priority Dropdown */}
              <label className="block">
                <span className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Priority
                </span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                  className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Priorities</option>
                  <option value="starred">Starred Only</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </label>
            </div>

            {/* Quick Filter Tags & Sorting Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
              {/* Tag filters pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted mr-1 flex items-center gap-1">
                  <Tag size={12} /> Tags:
                </span>
                {allTags.length > 0 ? (
                  allTags.map((t) => {
                    const isSelected = selectedTag === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTag(isSelected ? null : t)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-surface-2 text-text hover:bg-surface-3'
                        }`}
                      >
                        #{t}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-muted/60 italic">No custom tags added yet</span>
                )}

                {/* Has Notes toggle */}
                <button
                  type="button"
                  onClick={() => setHasNotesOnly((prev) => !prev)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ml-1 ${
                    hasNotesOnly
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-surface-2 text-text hover:bg-surface-3'
                  }`}
                >
                  <FileText size={11} /> With Notes
                </button>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted flex items-center gap-1">
                  <ArrowUpDown size={12} /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 px-2 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none"
                >
                  <option value="newest">Newest Saved</option>
                  <option value="oldest">Oldest Saved</option>
                  <option value="priority">High Priority First</option>
                  <option value="least-reviewed">Least Reviewed (Due)</option>
                  <option value="most-reviewed">Most Reviewed</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Floating Batch Operations Toolbar ──────────────────── */}
        {selectedIds.size > 0 && (
          <div className="sticky top-16 z-30 p-3 rounded-2xl bg-surface-3 border border-primary/40 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-primary hover:text-primary-hover flex items-center gap-1 text-xs font-bold"
              >
                {selectedIds.size === filtered.length ? <CheckSquare size={16} /> : <Square size={16} />}
                <span>
                  {selectedIds.size} of {filtered.length} Selected
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Practice selected */}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play size={13} />}
                onClick={handleLaunchSelectedMock}
                className="text-xs font-bold"
              >
                Practice Selected ({selectedIds.size})
              </Button>

              {/* Move to folder dropdown */}
              <div className="relative inline-block">
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBatchMoveFolder(e.target.value);
                  }}
                  defaultValue=""
                  className="h-8 px-2.5 rounded-lg bg-surface border border-border text-xs text-text font-semibold focus:outline-none"
                >
                  <option value="" disabled>
                    Move to Category...
                  </option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Set Priority dropdown */}
              <div className="relative inline-block">
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBatchSetPriority(e.target.value as any);
                  }}
                  defaultValue=""
                  className="h-8 px-2.5 rounded-lg bg-surface border border-border text-xs text-text font-semibold focus:outline-none"
                >
                  <option value="" disabled>
                    Set Priority...
                  </option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              {/* Batch Delete */}
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Trash2 size={13} className="text-danger-fg" />}
                onClick={handleBatchDelete}
                className="text-xs border-danger/30 text-danger-fg hover:bg-danger-soft"
              >
                Remove ({selectedIds.size})
              </Button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="p-1 text-muted hover:text-text text-xs"
                title="Deselect all"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Active Selection Header & Count ─────────────────────── */}
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-muted hover:text-text font-semibold flex items-center gap-1"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare size={14} className="text-primary" />
              ) : (
                <Square size={14} />
              )}
              <span>Select all</span>
            </button>
            <span>·</span>
            <span>
              Showing <strong className="text-text">{filtered.length}</strong> of {saved.length} questions
            </span>
          </div>

          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Play size={12} />}
                onClick={() => {
                  setMockInitialScope(activeFolderId !== 'all' ? 'category' : 'filtered');
                  setMockModalOpen(true);
                }}
                className="h-7 text-xs"
              >
                Mock from this view ({filtered.length})
              </Button>
            )}
          </div>
        </div>

        {/* ── Questions List / Cards ──────────────────────────────── */}
        {filtered.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-2 grid place-items-center text-muted opacity-70">
              <BookmarkCheck size={28} />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              {saved.length === 0 ? 'No bookmarked questions yet' : 'No questions match these filters'}
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
              {saved.length === 0
                ? 'Save tricky or important questions during any exam using the bookmark icon to build your custom revision bank.'
                : 'Try adjusting your search terms, categories, or filters.'}
            </p>
            {saved.length === 0 ? (
              <Link to="/">
                <Button variant="primary">Back to Dashboard</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={clearFilters}>
                Reset Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <SavedQuestionItem
                key={item.id}
                item={item}
                folders={folders}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelectOne(item.id)}
                onOpenQuiz={() => setQuizQuestion(item)}
                onFilterTag={(t) => setSelectedTag(t)}
              />
            ))}
          </div>
        )}

        {/* ── Modals Integration ──────────────────────────────────── */}
        <BookmarkMockModal
          open={mockModalOpen}
          onClose={() => setMockModalOpen(false)}
          allSavedCount={saved.length}
          filteredCount={filtered.length}
          filteredIds={
            selectedIds.size > 0
              ? [...selectedIds]
              : filtered.map((f) => f.id)
          }
          providers={providers}
          subjects={subjects}
          activeSubjectFilter={subject}
          activeProviderFilter={provider}
          folders={folders}
          activeFolderId={activeFolderId}
          initialScope={mockInitialScope}
          folderQuestionsMap={folderQuestionsMap}
          mistakesCount={mistakesCount}
        />

        <BookmarkFolderModal
          open={folderModalOpen}
          onClose={() => {
            setFolderModalOpen(false);
            setEditingFolder(null);
          }}
          onSave={handleSaveFolder}
          onDelete={handleDeleteFolder}
          folder={editingFolder}
          questionCount={editingFolder ? folderQuestionsMap[editingFolder.id] ?? 0 : 0}
        />

        <BookmarkFlashcardsModal
          open={flashcardsModalOpen}
          onClose={() => setFlashcardsModalOpen(false)}
          questions={filtered}
          title={
            activeFolderId !== 'all' && activeFolder
              ? `${activeFolder.name} Flashcards`
              : 'Bookmark Flashcards'
          }
        />

        <BookmarkQuickQuizModal
          open={!!quizQuestion}
          onClose={() => setQuizQuestion(null)}
          question={quizQuestion}
        />

        <BookmarkExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          questions={filtered}
          folderName={
            activeFolderId !== 'all' && activeFolder
              ? activeFolder.name
              : 'All Saved Bookmarks'
          }
        />

        {/* Undo Toast */}
        {undoToast && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-surface-3 border border-border shadow-2xl flex items-center gap-3 text-xs text-text animate-in fade-in slide-in-from-bottom-3">
            <span>{undoToast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Metric Summary Widget ───────────────────────────────────────── */
function MetricItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-2/80 border border-border/50 p-3 sm:p-3.5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted mb-1">
        <span className="text-[10px] sm:text-xs font-semibold">{label}</span>
        {icon}
      </div>
      <div className="text-xl sm:text-2xl font-black text-text tabular-nums">{value}</div>
    </div>
  );
}

/* ── Question Card Component ─────────────────────────────────────── */
function SavedQuestionItem({
  item,
  folders,
  isSelected,
  onToggleSelect,
  onOpenQuiz,
  onFilterTag,
}: {
  item: SavedQuestionRecord & { provider: string; subject: string };
  folders: BookmarkFolder[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenQuiz: () => void;
  onFilterTag: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteText, setNoteText] = useState(item.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const priorityInfo = priorityTone(item.priority);

  const handleSaveNotes = () => {
    setQuestionNotes(item.id, noteText.trim());
    setEditingNotes(false);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    addQuestionTag(item.id, tagInput.trim());
    setTagInput('');
    setShowTagInput(false);
  };

  const handleRemove = () => {
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
    <Card
      className={`transition-all duration-200 ${
        isSelected ? 'ring-2 ring-primary/60 bg-primary-soft/10 border-primary/40' : ''
      }`}
    >
      <div className="space-y-4">
        {/* Top Meta Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Selection Checkbox */}
            <button
              type="button"
              onClick={onToggleSelect}
              className="mt-1 text-muted hover:text-primary transition-colors shrink-0"
              aria-label="Select question"
            >
              {isSelected ? (
                <CheckSquare size={18} className="text-primary" />
              ) : (
                <Square size={18} />
              )}
            </button>

            <div className="min-w-0 space-y-1.5">
              {/* Badges strip */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Category Picker Dropdown */}
                <div className="relative inline-flex items-center">
                  <select
                    value={item.folderId || 'default'}
                    onChange={(e) => setQuestionFolder(item.id, e.target.value)}
                    className="h-6 px-2 pr-6 rounded-full bg-surface-2 border border-border text-[10px] sm:text-[11px] font-bold text-text focus:outline-none cursor-pointer appearance-none"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={11}
                    className="absolute right-1.5 pointer-events-none text-muted"
                  />
                </div>

                {/* Provider & Subject */}
                <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[10px] sm:text-[11px] font-bold">
                  {item.provider}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text-2 text-[10px] sm:text-[11px] font-semibold border border-border">
                  {item.subject}
                </span>

                {/* Priority Selector */}
                <div className="relative inline-flex items-center">
                  <select
                    value={item.priority || 'medium'}
                    onChange={(e) => setQuestionPriority(item.id, e.target.value as any)}
                    className={`h-6 px-2 pr-5 rounded-full border text-[10px] sm:text-[11px] font-bold focus:outline-none cursor-pointer appearance-none ${priorityInfo.badge}`}
                  >
                    <option value="high">🔥 High Priority</option>
                    <option value="medium">⚡ Med Priority</option>
                    <option value="low">🌱 Low Priority</option>
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-1.5 pointer-events-none opacity-60"
                  />
                </div>

                {/* Last Outcome */}
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-bold ${outcomeTone(
                    item.lastOutcome,
                  )}`}
                >
                  {item.lastOutcome === 'correct'
                    ? '✓ Correct'
                    : item.lastOutcome === 'incorrect'
                      ? '✗ Incorrect'
                      : item.lastOutcome === 'skipped'
                        ? '⊘ Skipped'
                        : 'Unattempted'}
                </span>

                {/* Star Button */}
                <button
                  type="button"
                  onClick={() => toggleStarQuestion(item.id)}
                  className={`p-1 rounded-full hover:bg-surface-2 transition-colors ${
                    item.isStarred ? 'text-amber-400' : 'text-muted/50 hover:text-amber-400'
                  }`}
                  title={item.isStarred ? 'Starred bookmark' : 'Star this question'}
                >
                  <Star size={15} fill={item.isStarred ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Exam Title & Saved Date */}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-text tracking-tight">
                  {item.examName}
                </h2>
                <span className="text-[11px] text-muted flex items-center gap-1">
                  <CalendarDays size={11} /> Saved {formatSavedDate(item.savedAt)}
                </span>
                {item.timesReviewed ? (
                  <span className="text-[11px] text-primary font-medium">
                    · Reviewed {item.timesReviewed}x
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Quick Actions on Card */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Zap size={12} className="text-primary" />}
              onClick={onOpenQuiz}
              className="text-xs h-8"
              title="Practice this question now"
            >
              Test Me
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs h-8"
            >
              {expanded ? 'Hide' : 'Details'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="text-xs h-8 text-danger-fg border-danger/30 hover:bg-danger-soft"
            >
              Remove
            </Button>
          </div>
        </div>

        {/* Question Text Box */}
        <div className="rounded-2xl bg-surface-2/90 border border-border/80 p-4 sm:p-5 space-y-4">
          {item.comp && (
            <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-2">
              <div className="font-bold text-muted uppercase text-[10px] mb-1">Passage</div>
              <SafeHtml html={item.comp} />
            </div>
          )}

          <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
            <span>Question {item.questionIdx + 1}</span>
            {item.marks ? <span className="text-[11px] text-muted">Marks: {item.marks}</span> : null}
          </div>

          <div className="text-sm sm:text-base font-semibold text-text leading-relaxed">
            <SafeHtml html={item.question} />
          </div>

          {/* Options Breakdown (Always shown or expanded for solution) */}
          <div className="space-y-2 pt-1">
            {item.options.map((option, idx) => {
              const isCorrect = idx === item.correct_option_id;
              const isChosen = item.lastChosen === idx;

              let optionCls = 'border-border bg-surface text-text';
              if (isCorrect) {
                optionCls = 'border-success bg-success-soft/70 text-text font-semibold';
              } else if (isChosen && !isCorrect) {
                optionCls = 'border-danger bg-danger-soft/60 text-text';
              }

              return (
                <div
                  key={idx}
                  className={`rounded-xl px-3.5 py-2.5 border text-xs sm:text-sm flex items-start gap-3 transition-colors ${optionCls}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] sm:text-xs font-bold grid place-items-center shrink-0 ${
                      isCorrect
                        ? 'bg-success text-white'
                        : isChosen
                          ? 'bg-danger text-white'
                          : 'bg-surface-2 text-text'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <SafeHtml html={option} />
                  </div>
                  {isCorrect && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success text-white shrink-0">
                      Correct
                    </span>
                  )}
                  {isChosen && !isCorrect && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger text-white shrink-0">
                      Your Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Solution section (Expandable) */}
          {expanded && item.solution && (
            <div className="mt-4 pt-4 border-t border-border/80">
              <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                <BookOpen size={13} />
                <span>Detailed Solution</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface border border-border text-xs sm:text-sm text-text leading-relaxed">
                <SafeHtml html={item.solution} />
              </div>
            </div>
          )}

          {/* Personal Notes Section */}
          <div className="mt-3 pt-3 border-t border-border/60">
            {editingNotes ? (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <FileText size={12} /> Personal Study Note
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write formulas, shortcuts, or tips to remember..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-surface border border-border text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={handleSaveNotes} className="text-xs">
                    Save Note
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNoteText(item.notes || '');
                      setEditingNotes(false);
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : item.notes ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-amber-400 uppercase text-[10px] mb-1 flex items-center gap-1">
                    <FileText size={11} /> Personal Note
                  </div>
                  <p className="text-text leading-relaxed">{item.notes}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="text-muted hover:text-text p-1 shrink-0"
                  title="Edit note"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingNotes(true)}
                className="text-xs text-muted hover:text-primary font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add Personal Study Note
              </button>
            )}
          </div>

          {/* Tags Chips Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1 flex items-center gap-1">
              <Tag size={11} /> Tags:
            </span>
            {item.tags && item.tags.length > 0 ? (
              item.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border text-[11px] text-text group cursor-pointer hover:border-primary"
                  onClick={() => onFilterTag(t)}
                >
                  <span>#{t}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestionTag(item.id, t);
                    }}
                    className="opacity-60 hover:opacity-100 text-muted hover:text-danger-fg"
                    title="Remove tag"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))
            ) : null}

            {/* Add tag button / input */}
            {showTagInput ? (
              <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tag name..."
                  className="h-6 w-24 px-1.5 rounded-lg bg-surface border border-border text-xs text-text focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-6 px-1.5 rounded-lg bg-primary text-white text-xs font-bold"
                >
                  <Check size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  className="h-6 px-1 rounded-lg text-muted hover:text-text text-xs"
                >
                  <X size={11} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="px-2 py-0.5 rounded-lg border border-dashed border-border text-muted hover:text-text hover:border-primary text-[10px] font-semibold flex items-center gap-0.5"
              >
                <Plus size={10} /> Add Tag
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
