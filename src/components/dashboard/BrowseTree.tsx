import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderOpen, Library } from 'lucide-react';
import { MockCard } from './MockCard';
import { providerMeta, providerPath } from '@/lib/providers';
import type { Attempt, MockEntry } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

interface BrowseTreeProps {
  mocks: MockEntry[] | null;
  scoresMap: Record<string, Attempt>;
  isDone: (path: string) => boolean;
  onToggle: (mock: MockEntry) => void;
  /** Mocks shown per category before a "show all" expansion kicks in. */
  perCategory?: number;
}

interface CategoryNode {
  /** Full category path as it appears in the catalog (m.category). */
  category: string;
  /** Last path segment — the label shown in the tree. */
  label: string;
  mocks: MockEntry[];
}

interface ProviderNode {
  provider: string;
  categories: CategoryNode[];
  count: number;
}

/** "Browse the catalog" — a collapsible Provider → Category → Mock tree.
    Providers and categories start collapsed so ~1,200 mocks stay scannable;
    expanding a category reveals a compact grid of mock tiles (MockCard in
    its rail variant) with the same done/score/toggle wiring as the shelves. */
export function BrowseTree({ mocks, scoresMap, isDone, onToggle, perCategory = 12 }: BrowseTreeProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

  const tree = useMemo<ProviderNode[]>(() => {
    if (!mocks) return [];
    const byProvider = new Map<string, Map<string, MockEntry[]>>();
    mocks.forEach((m) => {
      let cats = byProvider.get(m.provider);
      if (!cats) byProvider.set(m.provider, (cats = new Map()));
      const cat = m.category && m.category !== '' ? m.category : 'General';
      const list = cats.get(cat);
      if (list) list.push(m);
      else cats.set(cat, [m]);
    });
    return [...byProvider.entries()]
      .map(([provider, cats]) => {
        const categories: CategoryNode[] = [...cats.entries()]
          .map(([category, list]) => ({
            category,
            label: category.split('/').pop() || category,
            mocks: list,
          }))
          .sort((a, b) => b.mocks.length - a.mocks.length || a.label.localeCompare(b.label));
        const count = categories.reduce((n, c) => n + c.mocks.length, 0);
        return { provider, categories, count };
      })
      .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
  }, [mocks]);

  const [openProviders, setOpenProviders] = useState<Set<string>>(new Set());
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  if (!mocks) return null;

  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  return (
    <section>
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-xl sm:text-[22px] font-bold tracking-[-0.02em] text-text flex items-center gap-2.5">
            {isNetflix ? (
              <span className="flex items-center gap-2.5 text-white">
                <span className="w-1.5 h-6 bg-[#E50914] rounded-full inline-block shadow-[0_0_12px_#E50914]" />
                Browse the Catalog
              </span>
            ) : (
              <>
                <span className="text-primary"><Library size={20} /></span>
                Browse the Catalog
              </>
            )}
          </h2>
          <p className="text-[13px] text-muted mt-0.5">provider → course → mock, neatly stacked</p>
        </div>
        <span className="text-sm text-muted tabular-nums">{mocks.length} total</span>
      </div>

      <div className="space-y-2.5">
        {tree.map((p) => {
          const meta = providerMeta(p.provider);
          const pOpen = openProviders.has(p.provider);
          return (
            <div key={p.provider} className="rounded-2xl bg-surface overflow-hidden ring-1 ring-[var(--glass-border)]">
              {/* Provider header: toggle button + "Open" link as siblings —
                  nesting a link inside a button is invalid HTML and confuses AT. */}
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition-colors">
                <button
                  onClick={() => toggleSet(openProviders, p.provider, setOpenProviders)}
                  aria-expanded={pOpen}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  <span className="text-muted shrink-0">
                    {pOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold tracking-[-0.01em] text-text truncate">
                      {meta?.title ?? p.provider}
                    </span>
                    <span className="block text-xs text-muted truncate mt-0.5">
                      {p.count} mock{p.count === 1 ? '' : 's'} · {p.categories.length} {p.categories.length === 1 ? 'collection' : 'collections'}
                    </span>
                  </span>
                </button>
                <Link
                  to={providerPath(p.provider)}
                  className="shrink-0 inline-flex items-center px-4 py-1.5 rounded-full bg-surface-2 text-xs font-semibold text-text-2 hover:bg-primary hover:text-white active:scale-95 transition-all shadow-xs"
                >
                  Open
                </Link>
              </div>

              {/* Categories */}
              {pOpen && (
                <div className="border-t border-border">
                  {p.categories.map((c) => {
                    const catKey = `${p.provider}::${c.category}`;
                    const cOpen = openCats.has(catKey);
                    const expanded = expandedCats.has(catKey);
                    const shown = expanded ? c.mocks : c.mocks.slice(0, perCategory);
                    return (
                      <div key={catKey} className="border-b border-border last:border-b-0">
                        <button
                          onClick={() => toggleSet(openCats, catKey, setOpenCats)}
                          aria-expanded={cOpen}
                          className="w-full flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2.5 pl-7 sm:pl-10 text-left hover:bg-surface-2 transition-colors cursor-pointer"
                        >
                          <span className="text-muted shrink-0">
                            {cOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <FolderOpen size={14} className="text-primary shrink-0" />
                          <span className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-text truncate">
                            {c.label}
                          </span>
                          <span className="shrink-0 text-xs text-muted tabular-nums">
                            {c.mocks.length}
                          </span>
                        </button>

                        {cOpen && (
                          <div className="px-3 sm:px-5 pb-3 sm:pb-4 pt-1 flex flex-wrap gap-2.5 sm:gap-4">
                            {shown.map((m) => (
                              <MockCard
                                key={m.path}
                                variant="rail"
                                mock={m}
                                done={isDone(m.path)}
                                score={scoresMap[m.path]}
                                onToggle={() => onToggle(m)}
                              />
                            ))}
                            {c.mocks.length > perCategory && !expanded && (
                              <button
                                onClick={() => toggleSet(expandedCats, catKey, setExpandedCats)}
                                className="w-44 sm:w-52 rounded-2xl border border-dashed border-border text-sm font-medium text-muted hover:text-primary hover:border-primary transition-colors grid place-items-center min-h-[180px]"
                              >
                                Show all {c.mocks.length}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
