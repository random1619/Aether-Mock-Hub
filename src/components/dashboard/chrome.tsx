import { AnimatePresence, motion } from 'framer-motion';
import { Command, Moon, Search, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { MockEntry } from '@/types';
import { examPath } from '@/lib/examLink';

/** Shared chrome used by the dashboard hero and the provider pages —
   frosted nav bar, animated theme toggle, search pill, and the iOS-style
   segmented control. Extracted so the two page shells stop drifting. */

/** Apple translucent material — floating functional layer with blur + saturation.
    Content scrolls underneath; heavier shadow over busy content handled via unscrolled state. */
export const FROSTED_NAV =
  'sticky top-0 z-sticky bg-[var(--glass)] backdrop-blur-[20px] backdrop-saturate-[180%] border-b border-[var(--glass-border)] supports-[backdrop-filter:blur(0)]:bg-[var(--glass)]';

/** Animated sun/moon theme toggle with the rotation transition. */
export function ThemeToggle({
  theme,
  onToggle,
  className,
}: {
  theme: 'dark' | 'light' | 'netflix' | 'onepiece';
  onToggle: () => void;
  className?: string;
}) {
  /* The toggle flips between the two Apple schemes. When Netflix/OnePiece is active the
     icon shows Sun (clicking returns to light) */
  const showSun = theme === 'dark' || theme === 'netflix' || theme === 'onepiece';
  return (
    <button
      onClick={onToggle}
      className={clsx(
        'w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors',
        className,
      )}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -70, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 70, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="grid place-items-center"
        >
          {showSun ? <Sun size={15} /> : <Moon size={15} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
/** Netflix-style search with autocomplete dropdown & ⌘K Spotlight trigger */
export function SearchPill({
  value,
  onChange,
  placeholder,
  ariaLabel,
  size = 'sm',
  className,
  isNetflix = false,
  mocks = [],
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
  isNetflix?: boolean;
  mocks?: MockEntry[];
}) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const openSpotlight = () => {
    // Prefer a direct custom event (reliable) over synthesizing a KeyboardEvent
    // which some browsers don't deliver to keydown metaKey handlers.
    window.dispatchEvent(new CustomEvent('aether:open-palette'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  const filteredMocks = useMemo(() => {
    if (!mocks || value.length < 2) return [];
    const lower = value.toLowerCase();
    return mocks
      .filter(m => m.name.toLowerCase().includes(lower) || m.provider?.toLowerCase().includes(lower) || m.subject?.toLowerCase().includes(lower))
      .slice(0, 6);
  }, [mocks, value]);

  const showDropdown = focused && value.length > 0 && filteredMocks.length > 0;

  useEffect(() => {
    if (!focused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [focused]);

  return (
    <div ref={containerRef} className={clsx('relative flex items-center', className)}>
      <Search
        size={size === 'sm' ? 14 : 15}
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10',
          size === 'sm' ? 'left-3' : 'left-4',
        )}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onClick={() => { if (!value) openSpotlight(); }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={clsx(
          'w-full text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)] transition-all duration-300 cursor-pointer pr-10 rounded-full',
          size === 'sm' ? 'h-8 pl-9 text-[13px]' : 'h-10 pl-10 text-sm',
          isNetflix
            ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/15 focus:ring-2 focus:ring-[#E50914]/40'
            : 'bg-surface-2'
        )}
      />
      <button
        onClick={openSpotlight}
        className={clsx(
          "absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold cursor-pointer transition-all active:scale-95",
          isNetflix
            ? "bg-white/15 border border-white/20 text-white/90 hover:bg-white/25 hover:text-white"
            : "bg-surface-3 text-text hover:bg-primary-soft hover:text-primary"
        )}
        title="Open Spotlight Search (⌘K)"
      >
        <Command size={10} />K
      </button>

      {/* Autocomplete dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute top-full left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border overflow-hidden z-50 p-1.5 backdrop-blur-2xl',
              isNetflix ? 'bg-[#141414]/95 border-white/15' : 'bg-bg-raised border-[var(--glass-border)]'
            )}
          >
            {filteredMocks.map((mock) => (
              <Link
                key={mock.path}
                to={examPath(mock.path)}
                onClick={() => { setFocused(false); onChange(''); }}
                className={clsx(
                  'block px-3 py-2 rounded-xl transition-all',
                  isNetflix ? 'text-white hover:bg-white/10' : 'text-text hover:bg-primary-soft'
                )}
              >
                <div className="text-sm font-medium truncate">{mock.name}</div>
                <div className={clsx('text-xs', isNetflix ? 'text-[#86868b]' : 'text-muted')}>
                  {mock.provider} {mock.subject && `· ${mock.subject}`}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** iOS-style segmented control (all / completed / pending on both shells). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={clsx('flex bg-surface-2 rounded-full p-1 gap-0.5', className)} role="group" aria-label={ariaLabel}>
      {options.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={clsx(
            'px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all',
            value === s ? 'bg-bg-raised text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
