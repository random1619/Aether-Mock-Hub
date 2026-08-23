import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';
import { SegmentedControl } from './chrome';
import { STATUS_OPTIONS } from '@/hooks/useMockFilters';

interface FilterBarProps {
  provider: string;
  subject: string;
  status: 'all' | 'completed' | 'pending';
  providers: string[];
  subjects: string[];
  filteredCount: number;
  onProvider: (v: string) => void;
  onSubject: (v: string) => void;
  onStatus: (v: 'all' | 'completed' | 'pending') => void;
  onReset: () => void;
}

/** Full-width filter toolbar (replaces the old sidebar). Collapses behind a
    toggle on small screens; always visible on lg+. Same state/logic as before. */
export function FilterBar({ provider, subject, status, providers, subjects, filteredCount, onProvider, onSubject, onStatus, onReset }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const activeCount = (provider !== 'all' ? 1 : 0) + (subject !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);

  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden w-full flex items-center justify-between px-5 py-4"
        aria-expanded={open}
        aria-controls="filter-panel"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <SlidersHorizontal size={15} /> Filters
          {activeCount > 0 && <span className="text-xs font-semibold text-primary bg-primary-soft px-2 py-0.5 rounded-full">{activeCount}</span>}
        </span>
        <ChevronDown size={16} className={clsx('text-muted transition-transform', open && 'rotate-180')} />
      </button>

      <div id="filter-panel" className={clsx('p-4 sm:p-5 flex-col gap-4 sm:gap-5', open ? 'flex' : 'hidden lg:flex')}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold text-text">Filters</span>
          <span className="text-xs font-medium text-muted bg-surface-2 px-2.5 py-1 rounded-full tabular-nums shrink-0">{filteredCount} mocks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <FilterGroup label="Provider">
            <PillRow group="provider" options={['all', ...providers]} active={provider} onSelect={onProvider} />
          </FilterGroup>
          <FilterGroup label="Subject">
            <PillRow group="subject" options={['all', ...subjects]} active={subject} onSelect={onSubject} />
          </FilterGroup>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Status">
            {/* iOS segmented control */}
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={status}
              onChange={onStatus}
              ariaLabel="Completion status"
            />
          </FilterGroup>
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={14} />} onClick={onReset} className="self-end">
            Reset filters
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">{label}</div>
      {children}
    </div>
  );
}

function PillRow({ group, options, active, onSelect }: { group: string; options: string[]; active: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 max-h-44 sm:max-h-32 overflow-y-auto overscroll-contain p-0.5 -m-0.5">
      {options.map((o) => {
        const isActive = active === o;
        return (
          <button
            key={o}
            onClick={() => onSelect(o)}
            aria-pressed={isActive}
            className={clsx(
              'relative text-xs sm:text-xs font-medium px-3.5 py-2 sm:py-1.5 rounded-full transition-colors duration-150 capitalize min-h-[36px] sm:min-h-0 active:scale-95',
              isActive
                ? 'text-white'
                : 'bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`pill-active-${group}`}
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{o === 'all' ? 'All' : o}</span>
          </button>
        );
      })}
    </div>
  );
}
