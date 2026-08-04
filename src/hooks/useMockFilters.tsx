import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { isComplete, toggleComplete } from '@/services/attemptStore';
import type { MockEntry } from '@/types';

/* Shared catalog-filter stack used by the Dashboard and the provider pages:
   search / subject / status state with page-size pagination, the matching
   predicate, and the completion toggle with its toast. Extracted so the two
   pages stop carrying identical copies. */

export const PAGE_SIZE = 24;

export const STATUS_OPTIONS = ['all', 'completed', 'pending'] as const;
export type MockStatus = (typeof STATUS_OPTIONS)[number];

export interface MockFilterState {
  search: string;
  subject: string;
  status: MockStatus;
  /** Optional provider dimension (Dashboard only). */
  provider?: string;
}

/**
 * Search / subject / status / visible-count state. Every setter resets
 * pagination, matching both pages' previous behavior.
 */
export function useMockFilters() {
  const [search, setSearchRaw] = useState('');
  const [subject, setSubjectRaw] = useState<string>('all');
  const [status, setStatusRaw] = useState<MockStatus>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const resetPage = useCallback(() => setVisible(PAGE_SIZE), []);
  const setSearch = useCallback((v: string) => {
    setSearchRaw(v);
    setVisible(PAGE_SIZE);
  }, []);
  const setSubject = useCallback((v: string) => {
    setSubjectRaw(v);
    setVisible(PAGE_SIZE);
  }, []);
  const setStatus = useCallback((v: MockStatus) => {
    setStatusRaw(v);
    setVisible(PAGE_SIZE);
  }, []);
  const loadMore = useCallback(() => setVisible((v) => v + PAGE_SIZE), []);
  const reset = useCallback(() => {
    setSearchRaw('');
    setSubjectRaw('all');
    setStatusRaw('all');
    setVisible(PAGE_SIZE);
  }, []);

  return { search, setSearch, subject, setSubject, status, setStatus, visible, loadMore, reset, resetPage };
}

/**
 * The isComplete-based predicate both pages shared. Pass
 * `searchProvider: true` to include the provider name in the search haystack
 * (Dashboard behavior; provider pages scope to one provider already).
 */
export function filterMocks(
  mocks: MockEntry[],
  f: MockFilterState,
  opts?: { searchProvider?: boolean },
): MockEntry[] {
  const q = f.search.trim().toLowerCase();
  return mocks.filter((m) => {
    if (f.provider && f.provider !== 'all' && m.provider !== f.provider) return false;
    if (f.subject !== 'all' && m.subject !== f.subject) return false;
    const done = isComplete(m.path);
    if (f.status === 'completed' && !done) return false;
    if (f.status === 'pending' && done) return false;
    if (q) {
      const hay = opts?.searchProvider
        ? `${m.name} ${m.provider} ${m.subject} ${m.category}`
        : `${m.name} ${m.subject} ${m.category}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/** Completion toggle with the shared toast. `onToggled` lets the page bump
    its db tick so dependent memos re-derive. */
export function useCompletionToggle(onToggled: () => void) {
  return useCallback(
    (mock: MockEntry) => {
      const nowDone = toggleComplete(mock.path);
      onToggled();
      if (nowDone) {
        toast.success('Marked complete', { description: mock.name, icon: <CheckCircle2 size={16} /> });
      } else {
        toast('Marked as pending', { description: mock.name });
      }
    },
    [onToggled],
  );
}
