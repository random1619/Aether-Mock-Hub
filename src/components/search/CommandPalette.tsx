import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Search, Command, FileText, Layers, BarChart3, Bookmark, 
  Settings, Sun, Moon, Sparkles, CornerDownLeft, X 
} from 'lucide-react';
import { clsx } from 'clsx';
import { loadMockCatalog } from '@/services/mockCatalog';
import { PROVIDERS } from '@/lib/providers';
import { examPath } from '@/lib/examLink';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MockEntry } from '@/types';

interface SearchResultItem {
  id: string;
  type: 'mock' | 'provider' | 'nav' | 'theme';
  title: string;
  subtitle?: string;
  category?: string;
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mocks, setMocks] = useState<MockEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { theme, setTheme } = useSettingsStore();

  // Load catalog on initial mount
  useEffect(() => {
    loadMockCatalog()
      .then(setMocks)
      .catch(() => setMocks([]));
  }, []);

  // Keyboard shortcut listener for ⌘K / Ctrl+K and Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Build dynamic search results
  const results = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];
    const q = query.trim().toLowerCase();

    // 1. Navigation Actions
    const navActions: SearchResultItem[] = [
      {
        id: 'nav-dashboard',
        type: 'nav',
        title: 'Dashboard',
        subtitle: 'Go to main dashboard & overview',
        icon: <Layers className="text-primary" size={16} />,
        action: () => { navigate('/'); setOpen(false); },
      },
      {
        id: 'nav-analytics',
        type: 'nav',
        title: 'Analytics & Insights',
        subtitle: 'View detailed accuracy, performance & weakness charts',
        icon: <BarChart3 className="text-success-fg" size={16} />,
        action: () => { navigate('/analytics'); setOpen(false); },
      },
      {
        id: 'nav-saved',
        type: 'nav',
        title: 'Saved Questions',
        subtitle: 'Review bookmarked questions and notes',
        icon: <Bookmark className="text-info-fg" size={16} />,
        action: () => { navigate('/saved'); setOpen(false); },
      },
      {
        id: 'nav-settings',
        type: 'nav',
        title: 'User Settings',
        subtitle: 'Manage profile credentials, goals & theme appearance',
        icon: <Settings className="text-muted" size={16} />,
        action: () => { navigate('/settings'); setOpen(false); },
      },
    ];

    // Filter nav actions if query matches
    if (!q) {
      items.push(...navActions);
    } else {
      navActions.forEach((item) => {
        if (item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)) {
          items.push(item);
        }
      });
    }

    // 2. Theme Switcher Items
    if (!q || 'theme light dark netflix mode appearance'.includes(q)) {
      items.push(
        {
          id: 'theme-light',
          type: 'theme',
          title: 'Switch to Apple Light Mode',
          subtitle: 'Clean white surface palette',
          icon: <Sun className="text-warning-fg" size={16} />,
          action: () => { setTheme('light'); setOpen(false); },
          badge: theme === 'light' ? 'Active' : undefined,
        },
        {
          id: 'theme-dark',
          type: 'theme',
          title: 'Switch to Apple Dark Mode',
          subtitle: 'Deep OLED black & slate palette',
          icon: <Moon className="text-info-fg" size={16} />,
          action: () => { setTheme('dark'); setOpen(false); },
          badge: theme === 'dark' ? 'Active' : undefined,
        },
        {
          id: 'theme-netflix',
          type: 'theme',
          title: 'Switch to Netflix Cinema Mode',
          subtitle: 'Red accent cinematic dark scheme',
          icon: <Sparkles className="text-danger-fg" size={16} />,
          action: () => { setTheme('netflix'); setOpen(false); },
          badge: theme === 'netflix' ? 'Active' : undefined,
        }
      );
    }

    // 3. Provider Pages
    PROVIDERS.forEach((p) => {
      if (!q || p.title.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q)) {
        items.push({
          id: `provider-${p.slug}`,
          type: 'provider',
          title: p.title,
          subtitle: p.tagline,
          icon: <Layers className="text-primary" size={16} />,
          action: () => { navigate(`/provider/${p.slug}`); setOpen(false); },
          badge: 'Provider',
        });
      }
    });

    // 4. Mock Tests matching query
    if (q.length >= 2) {
      const matchedMocks = mocks
        .filter((m) => 
          m.name.toLowerCase().includes(q) ||
          m.provider?.toLowerCase().includes(q) ||
          m.subject?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q)
        )
        .slice(0, 15);

      matchedMocks.forEach((m) => {
        items.push({
          id: `mock-${m.path}`,
          type: 'mock',
          title: m.name,
          subtitle: `${m.provider}${m.subject ? ` · ${m.subject}` : ''}`,
          category: m.category,
          icon: <FileText className="text-primary" size={16} />,
          action: () => { navigate(examPath(m.path)); setOpen(false); },
          badge: 'Test',
        });
      });
    }

    return items;
  }, [query, mocks, theme, navigate, setTheme]);

  // Handle arrow key navigation
  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].action();
    }
  };

  // Scroll selected item into view smoothly
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <>
      {/* Search trigger listener bound to global window events */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-16 sm:pt-24 px-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Command Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onKeyDown={handleKeyDownInList}
              className="relative w-full max-w-2xl rounded-3xl bg-bg-raised/95 backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Search Header Input */}
              <div className="flex items-center px-4 sm:px-6 h-14 border-b border-[var(--glass-border)] gap-3">
                <Search size={18} className="text-muted shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search mocks, providers, settings, or jump to page…"
                  className="flex-1 bg-transparent text-text placeholder:text-muted text-base focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 text-muted text-[11px] font-mono font-medium">
                  ESC
                </span>
              </div>

              {/* Results List */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                {results.length === 0 ? (
                  <div className="p-8 text-center text-muted">
                    <p className="text-sm font-semibold text-text">No results found</p>
                    <p className="text-xs mt-1">Try searching for provider names like "Oliveboard" or test names.</p>
                  </div>
                ) : (
                  results.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={clsx(
                          'flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none',
                          isSelected
                            ? 'bg-primary-soft/50 text-text ring-1 ring-primary/40'
                            : 'hover:bg-surface-2 text-text-2'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={clsx('w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-surface-2', isSelected && 'bg-primary text-white')}>
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-text truncate flex items-center gap-2">
                              {item.title}
                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-3 text-muted">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-muted truncate mt-0.5">{item.subtitle}</div>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                            <span>Open</span>
                            <CornerDownLeft size={13} />
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Command Palette Footer */}
              <div className="px-4 py-2.5 border-t border-[var(--glass-border)] bg-surface/50 text-[11px] text-muted flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-surface-2 font-mono font-bold text-text">↑</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-2 font-mono font-bold text-text">↓</span> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-surface-2 font-mono font-bold text-text">↵</span> Select
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <Command size={11} /> + K to trigger anywhere
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Global Search Pill Button trigger for Navbar */
export function SpotlightSearchTrigger({ className }: { className?: string }) {
  // Fire ⌘K key event on click
  const triggerSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <button
      onClick={triggerSearch}
      className={clsx(
        'flex items-center justify-between gap-3 h-9 px-3.5 rounded-full bg-surface-2 border border-[var(--glass-border)] text-muted hover:text-text hover:bg-surface-3 transition-all cursor-pointer select-none text-xs font-medium',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Search size={14} className="text-muted shrink-0" />
        <span className="truncate">Search mocks, providers…</span>
      </div>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-surface-3 text-text font-mono text-[10px] font-bold">
        <Command size={10} />K
      </kbd>
    </button>
  );
}
