import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { SafeHtml } from '@/components/ui';
import type { LangView } from '@/types';

const CLAMP_PX = 220; // collapsed height for long passages

/**
 * Comprehension / reading passage that clamps to a fixed height when long,
 * with a smooth expand/collapse toggle — so it never pushes the question
 * stem and options off-screen.
 */
export function CollapsiblePassage({ html, lang }: { html: string; lang: LangView }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setClamped(el.scrollHeight > CLAMP_PX + 24);
  }, [html]);

  return (
    <div className="mb-5 rounded-lg bg-surface-2 border border-border overflow-hidden">
      <div
        className="relative px-4 pt-4 text-sm transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: expanded || !clamped ? 'none' : CLAMP_PX, overflow: 'hidden' }}
      >
        <div ref={innerRef}>
          <SafeHtml html={html} lang={lang} />
        </div>
        {clamped && !expanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--surface-2))' }}
          />
        )}
      </div>
      {clamped && (
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold',
            'text-primary hover:bg-primary-soft/40 transition-colors border-t border-border',
          )}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Read full passage
            </>
          )}
        </button>
      )}
    </div>
  );
}
