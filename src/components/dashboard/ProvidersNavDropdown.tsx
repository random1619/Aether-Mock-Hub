import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Layers, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { PROVIDERS } from '@/lib/providers';
import { CoverArt } from './CoverArt';

export function ProvidersNavDropdown({ isNetflix = false }: { isNetflix?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Providers dropdown menu"
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none',
          isNetflix
            ? 'text-[#E5E5E5] hover:text-white hover:bg-white/10'
            : 'text-text-2 hover:text-text hover:bg-surface-2',
          open && (isNetflix ? 'bg-white/10 text-white' : 'bg-surface-2 text-text')
        )}
      >
        <Layers size={14} className="text-primary" />
        <span>Providers</span>
        <ChevronDown size={13} className={clsx('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[440px] max-w-[92vw] rounded-2xl bg-bg-raised/95 backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl p-3 z-[9999] overflow-hidden"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 py-1 flex items-center justify-between">
              <span>Mock Providers</span>
              <span className="text-[10px] font-semibold text-primary">{PROVIDERS.length} Sources</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {PROVIDERS.map((p) => (
                <Link
                  key={p.slug}
                  to={`/provider/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-2 transition-all group cursor-pointer"
                >
                  <CoverArt seed={p.title} title={p.title} className="w-8 h-8 rounded-lg shrink-0 text-xs shadow-xs" iconScale={0.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text truncate group-hover:text-primary transition-colors">
                      {p.title}
                    </div>
                    <div className="text-[10px] text-muted truncate">Explore mocks</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="border-t border-[var(--glass-border)] mt-2 pt-2 px-1 text-center">
              <a
                href="#providers"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                View provider shelves <ArrowRight size={11} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
