import type { CSSProperties, ReactNode } from 'react';
import { clsx } from 'clsx';

/* COVER ART — deterministic artwork tiles, two looks in one.
   Mocks have no real artwork, so every card derives stable art from
   its title/path. Which look renders is decided purely by CSS under
   [data-theme] — no JS theme subscription, no re-render:

   • Apple (default): an iOS-style app-icon tile — a soft neutral field
     with a centered colorful squircle bearing the title's monogram.
   • Netflix: a cinematic 16:9 poster — a rich title-colored gradient,
     a bottom-to-top black scrim, and the title set bold bottom-left.

   Both layers always render; CSS shows exactly one per theme. */

/* [light-a, light-b] pairs from Apple's system palette. Stable per title. */
const ICON_GRADIENTS: Array<[string, string]> = [
  ['#64d2ff', '#0a84ff'], // blue
  ['#63e6be', '#30d158'], // green
  ['#ffd60a', '#ff9f0a'], // yellow → orange
  ['#ff9f8a', '#ff453a'], // salmon → red
  ['#da9fff', '#bf5af2'], // purple
  ['#7dd3fc', '#5ac8fa'], // teal-blue
  ['#ffb3c7', '#ff375f'], // pink
  ['#a8e05f', '#32d74b'], // lime
  ['#f5c87a', '#ff9f0a'], // amber
  ['#9ea7ff', '#5e5ce6'], // indigo
  ['#6ee7dd', '#40c8e0'], // cyan
  ['#ffc78a', '#ff6482'], // peach
];

/* Darker, cinematic two-stop gradients for the Netflix poster field. The same
   index is used as the Apple tile (stable per title) so a mock keeps its color
   identity across themes — just rendered as a moodier poster. */
const POSTER_GRADIENTS: Array<[string, string]> = [
  ['#0a84ff', '#062a52'],
  ['#30d158', '#0b3d1e'],
  ['#ff9f0a', '#4d2c00'],
  ['#ff453a', '#4a0b08'],
  ['#bf5af2', '#2f0b4a'],
  ['#5ac8fa', '#0b3550'],
  ['#ff375f', '#4a0516'],
  ['#32d74b', '#0b3d16'],
  ['#ff9f0a', '#3d2400'],
  ['#5e5ce6', '#14143d'],
  ['#40c8e0', '#083540'],
  ['#ff6482', '#4a0f22'],
];

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Two-letter monogram from a title ("SSC CGL Mock 05" → "SC"). */
export function monogram(title: string): string {
  const words = title.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = words.filter((w) => /[a-zA-Z]/.test(w[0])).slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join('') || 'AM';
}

export function iconGradient(seed: string): CSSProperties {
  const [a, b] = ICON_GRADIENTS[hashOf(seed) % ICON_GRADIENTS.length];
  return { background: `linear-gradient(150deg, ${a} 0%, ${b} 100%)` };
}

function posterGradient(seed: string): CSSProperties {
  const [a, b] = POSTER_GRADIENTS[hashOf(seed) % POSTER_GRADIENTS.length];
  return { background: `linear-gradient(160deg, ${a} 0%, ${b} 100%)` };
}

interface CoverArtProps {
  seed: string;
  title: string;
  /** Extra classes for sizing (defaults: full-bleed square Apple tile). */
  className?: string;
  /** Scale of the inner app icon, 0–1 (default 0.42). Apple variant only. */
  iconScale?: number;
  children?: ReactNode;
}

/** Dual-look artwork tile. Apple app-icon by default; Netflix poster under
    [data-theme='netflix'] (see the .coverart-* rules in theme.css). */
export function CoverArt({ seed, title, className, iconScale = 0.42, children }: CoverArtProps) {
  return (
    <div
      aria-hidden
      className={clsx(
        'coverart mockcard-sheen-container relative grid place-items-center overflow-hidden rounded-2xl bg-surface-2 select-none transition-transform duration-300 ease-out group-hover:scale-[1.03]',
        className,
      )}
    >
      {/* Apple variant — centered squircle app icon with dynamic shadow */}
      <div
        className="coverart-apple grid place-items-center shadow-md ring-1 ring-[var(--glass-border)] transition-transform duration-300 group-hover:scale-105"
        style={{
          ...iconGradient(seed),
          width: `${iconScale * 100}%`,
          aspectRatio: '1',
          borderRadius: '24%',
        }}
      >
        {children ?? (
          <span className="text-[1.5em] font-bold tracking-[-0.02em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
            {monogram(title)}
          </span>
        )}
      </div>

      {/* Netflix variant — full-bleed poster field + scrim + bottom-left title */}
      <div className="coverart-netflix absolute inset-0 transition-transform duration-300 group-hover:scale-105" style={posterGradient(seed)}>
        {/* soft top sheen for a photographic feel */}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/14 via-transparent to-transparent" />
        {/* bottom-to-top black scrim */}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        {/* large ghost monogram behind the title */}
        <span aria-hidden className="absolute right-2 top-1 text-[3em] font-black text-white/10 leading-none select-none">
          {monogram(title)}
        </span>
        <span className="absolute left-2.5 right-2 bottom-2 text-white font-extrabold leading-tight tracking-[-0.01em] text-[0.85em] line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          {title}
        </span>
      </div>
    </div>
  );
}
