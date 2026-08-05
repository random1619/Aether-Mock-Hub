# Frontend Level-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the animation stack, adopt accessible primitives, and add virtualization + polish — shrinking the bundle while raising capability, per `docs/superpowers/specs/2026-08-05-frontend-design-audit-design.md`.

**Architecture:** Replace the unmaintained Locomotive Scroll with Lenis (keeping the exact `SmoothScroll` context interface so no consumer changes), swap hand-rolled a11y primitives for Radix (Modal) and cmdk (command palette) behind the existing styled API, virtualize the exam `QuestionPalette` with `react-virtuoso`, and replace the custom particle confetti with `canvas-confetti`. GSAP stays scoped to scroll-scrubbed hero parallax; framer-motion stays the primary React engine.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, framer-motion 12, GSAP 3 + ScrollTrigger, Zustand 5, vitest 4 + jsdom + (new) React Testing Library, Lenis, Radix UI, cmdk, react-virtuoso, canvas-confetti.

## Global Constraints

- **Offline / Electron-only** — every dependency is bundled at build time; no CDN fonts, no runtime services.
- **Free / OSS-only** — no paid libraries or plugins. (GSAP is fully free as of 3.13.)
- **Respect the 3-theme token system** (`--bg`, `--surface`, `--primary`, `--glass-border`, etc. in `src/styles/theme.css`). New components consume tokens; never hardcode colors.
- **Reduced-motion** — every animation path must honor `prefers-reduced-motion` (existing components already do; preserve it).
- **No breaking API changes** — `SmoothScroll` context (`{scrollTo, update, instance}`), `Modal`'s `ModalProps`, and `ConfettiBurst`'s mount-gated contract stay source-compatible with current callers.
- **Test runner** — vitest runs serialized on Windows (`pool:'forks'`, `maxWorkers:1`, `fileParallelism:false`); tests must be self-contained, no cross-file state.
- Run tests with `npm test` (vitest run). Lint with `npm run lint` (oxlint). Build/typecheck with `npm run build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/test/setup.ts` | *(create)* vitest setup — jest-dom matchers + RTL cleanup |
| `src/components/layout/SmoothScroll.tsx` | *(modify)* provider now drives Lenis instead of Locomotive; same context interface |
| `src/hooks/useLenisScroll.ts` | *(create, replaces `useLocomotiveScroll.ts`)* Lenis lifecycle + scrollTo/update/instance |
| `src/hooks/useHeroParallax.ts` | *(modify)* consume Lenis `scroll` event for `ScrollTrigger.update` instead of the Locomotive cast |
| `src/components/ui/Modal.tsx` | *(modify)* re-implement on Radix Dialog; keep `ModalProps` |
| `src/components/search/CommandPalette.tsx` | *(modify)* re-implement interaction layer on cmdk; keep result sources + styling |
| `src/components/exam/QuestionPalette.tsx` | *(modify)* virtualize the tile grid with `VirtuosoGrid` |
| `src/components/ui/ConfettiBurst.tsx` | *(modify)* fire `canvas-confetti` on mount; keep mount-gated, reduced-motion contract |
| `package.json` | *(modify)* add/remove deps |
| `vite.config.ts` | *(modify)* register `setupFiles` for the test setup |
| Tests | one `*.test.tsx` per touched component, co-located |

---

## Task 0: Test tooling (React Testing Library)

The project has no component-level interaction tests — only `renderToStaticMarkup` string asserts. The primitives we're replacing (focus trap, keyboard nav, virtualization) need a real DOM + events. jsdom is already the configured environment; this task adds RTL and a setup file.

**Files:**
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts` (add `setupFiles` to the `test` block)
- Modify: `package.json` (devDependencies)

**Interfaces:**
- Produces: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` available to all later tasks; global jest-dom matchers (`toBeInTheDocument`, `toHaveFocus`, …) via the setup file.

- [ ] **Step 1: Install the testing packages**

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Write the vitest setup file**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL cleanup between tests so the serialized Windows pool stays isolated.
afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Register the setup file in `vite.config.ts`**

In the `test: { ... }` block, add one line under `environment: 'jsdom',`:

```ts
    setupFiles: ['src/test/setup.ts'],
```

- [ ] **Step 4: Write a smoke test proving RTL works**

Create `src/test/rtl.smoke.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>count {n}</button>;
}

describe('RTL smoke', () => {
  it('renders and responds to a user click', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const btn = screen.getByRole('button', { name: /count 0/ });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(screen.getByRole('button', { name: /count 1/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests to verify the tooling passes**

Run: `npm test`
Expected: PASS — the smoke test runs green alongside the existing suite.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/test/rtl.smoke.test.tsx
git commit -m "test: add React Testing Library + jest-dom setup"
```

---

## Task 1: Replace Locomotive Scroll with Lenis

Locomotive Scroll v5 is unmaintained and forces a manual `instance.on('scroll', ScrollTrigger.update)` bridge in `useHeroParallax`. Lenis is the maintained successor with a clean rAF loop and an `on('scroll')` event. The `SmoothScroll` context interface (`{scrollTo, update, instance}`) is consumed by `HeroBand` and `useHeroParallax` — it must not change shape, so no consumer edits are needed beyond the parallax hook.

**Files:**
- Create: `src/hooks/useLenisScroll.ts`
- Modify: `src/components/layout/SmoothScroll.tsx`
- Modify: `src/hooks/useHeroParallax.ts`
- Delete: `src/hooks/useLocomotiveScroll.ts`
- Test: `src/hooks/useLenisScroll.test.tsx`
- Modify: `package.json` (remove `locomotive-scroll`, add `lenis`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `useLenisScroll(options?: { lerp?: number; duration?: number }): { containerRef: RefObject<HTMLDivElement | null>; scrollTo: (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => void; update: () => void; instance: Lenis | null }`
  - `SmoothScrollContextValue` (unchanged): `{ scrollTo, update, instance }`
  - `useSmoothScroll(): SmoothScrollContextValue` (unchanged export from `SmoothScroll.tsx`)

- [ ] **Step 1: Install Lenis, remove Locomotive**

```bash
npm uninstall locomotive-scroll
npm install lenis
```

- [ ] **Step 2: Write the failing test**

Create `src/hooks/useLenisScroll.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLenisScroll } from './useLenisScroll';

// Lenis constructs a rAF loop and touches scroll APIs jsdom doesn't fully
// implement; mock the class so the hook's contract is tested in isolation.
const rafMock = vi.fn();
const destroyMock = vi.fn();
const scrollToMock = vi.fn();
const onMock = vi.fn();
const resizeMock = vi.fn();

vi.mock('lenis', () => {
  return {
    default: class MockLenis {
      on = onMock;
      raf = rafMock;
      destroy = destroyMock;
      resize = resizeMock;
      scrollTo = scrollToMock;
      constructor(public opts: unknown) {}
    },
  };
});

describe('useLenisScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs Lenis with the lerp option and exposes an instance', () => {
    const { result } = renderHook(() => useLenisScroll({ lerp: 0.08 }));
    expect(result.current.instance).not.toBeNull();
  });

  it('scrollTo delegates to the Lenis instance with an offset', () => {
    const { result } = renderHook(() => useLenisScroll({}));
    result.current.scrollTo(100, { offset: -20 });
    expect(scrollToMock).toHaveBeenCalledWith(100, expect.objectContaining({ offset: -20 }));
  });

  it('destroys the instance on unmount', () => {
    const { unmount } = renderHook(() => useLenisScroll({}));
    unmount();
    expect(destroyMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/hooks/useLenisScroll.test.tsx`
Expected: FAIL — `useLenisScroll` does not exist yet.

- [ ] **Step 4: Implement `useLenisScroll`**

Create `src/hooks/useLenisScroll.ts`:

```ts
import { useEffect, useRef, useCallback, type RefObject } from 'react';
import Lenis from 'lenis';

interface UseLenisScrollOptions {
  /** Lerp factor — lower = springier. Apple default: 0.08 */
  lerp?: number;
  /** Wheel multiplier. Kept for parity with the old provider prop; Lenis folds
      this into `lerp`/`duration`, so it is accepted but currently unused. */
  multiplier?: number;
}

interface UseLenisScrollReturn {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollTo: (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => void;
  update: () => void;
  instance: Lenis | null;
}

/**
 * React hook wrapping Lenis smooth scroll with Apple-design defaults.
 *
 * Unlike Locomotive Scroll, Lenis does not need a dedicated scroll container
 * element with special classes — it smooths the window scroll. `containerRef`
 * is still returned so the provider's markup stays identical, but Lenis is
 * constructed against the window (default) and the ref is only a mount anchor.
 *
 * Reduced-motion: Lenis is not constructed at all — native scrolling applies.
 */
export function useLenisScroll(options: UseLenisScrollOptions = {}): UseLenisScrollReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Lenis | null>(null);
  const rafIdRef = useRef<number>(0);
  const { lerp = 0.08 } = options;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const lenis = new Lenis({ lerp, smoothWheel: true });
    instanceRef.current = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      rafIdRef.current = requestAnimationFrame(raf);
    };
    rafIdRef.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      lenis.destroy();
      instanceRef.current = null;
    };
  }, [lerp]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, o?: { offset?: number; duration?: number }) => {
      instanceRef.current?.scrollTo(target as never, {
        offset: o?.offset ?? 0,
        duration: o?.duration ?? 0.8,
      });
    },
    [],
  );

  const update = useCallback(() => {
    instanceRef.current?.resize();
  }, []);

  return { containerRef, scrollTo, update, instance: instanceRef.current };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/hooks/useLenisScroll.test.tsx`
Expected: PASS

- [ ] **Step 6: Rewire `SmoothScroll.tsx` to the new hook**

Replace the import and hook call. Change line 2–5 imports:

```ts
import { createContext, useContext, type ReactNode } from 'react';
import { useLenisScroll } from '@/hooks/useLenisScroll';
import type Lenis from 'lenis';
```

Change the context value type (lines 11–14 region):

```ts
interface SmoothScrollContextValue {
  /** Programmatic scroll-to with Apple easing */
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; duration?: number }) => void;
  /** Recalculate scroll bounds after layout shifts */
  update: () => void;
  /** The raw Lenis instance (null until mounted) */
  instance: Lenis | null;
}
```

Change the provider body (line 47–48):

```ts
export function SmoothScrollProvider({ children, lerp = 0.08 }: SmoothScrollProviderProps) {
  const { containerRef, scrollTo, update, instance } = useLenisScroll({ lerp });
```

(Drop the now-unused `multiplier` prop from `SmoothScrollProviderProps` and the `data-scroll-container` div stays as the mount anchor — keep the JSX unchanged.)

- [ ] **Step 7: Update `useHeroParallax` to consume Lenis's scroll event**

In `src/hooks/useHeroParallax.ts`, replace the Locomotive event-emitter interface (lines 17–20) and the listener wiring (lines 81–86). Lenis exposes `.on('scroll', cb)` / `.off('scroll', cb)` natively:

Delete the `LocomotiveScrollEventEmitter` interface. Replace the `onLsScroll` block with:

```ts
      // Recalculate triggers on the smoothed scroll position.
      const onLenisScroll = () => ScrollTrigger.update();
      if (instance) {
        instance.on('scroll', onLenisScroll);
        lsScrollUnsubscribe.current = () => instance.off('scroll', onLenisScroll);
      }
```

Also update the stale doc comment referencing "Locomotive Scroll v5 integration" to describe the Lenis integration. (The `dependencies: [instance]` and cleanup logic are unchanged.)

- [ ] **Step 8: Delete the old hook and run the full suite + typecheck**

```bash
rm src/hooks/useLocomotiveScroll.ts
npm test
npm run build
```

Expected: all tests PASS; `tsc -b` reports no errors (no dangling references to `useLocomotiveScroll` or `locomotive-scroll`).

- [ ] **Step 9: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/hooks/useLenisScroll.ts src/hooks/useLenisScroll.test.tsx src/components/layout/SmoothScroll.tsx src/hooks/useHeroParallax.ts src/hooks/useLocomotiveScroll.ts
git commit -m "feat(scroll): replace Locomotive Scroll with Lenis"
```

---

## Task 2: Re-implement Modal on Radix Dialog

The hand-rolled focus trap / scroll-lock / Escape handling in `Modal.tsx` is correct but reimplements what Radix Dialog hardens (nested portals, return-focus, aria). Rebuild `Modal` on Radix while keeping the exact `ModalProps` API and the current framer-motion enter/exit animation + token-driven styling, so all existing callers (`ResultModal`, etc.) work unchanged.

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Test: `src/components/ui/Modal.test.tsx`
- Modify: `package.json` (add `@radix-ui/react-dialog`)

**Interfaces:**
- Consumes: Task 0 (RTL + jest-dom).
- Produces: `Modal(props: ModalProps)` — **same `ModalProps` as today**: `{ open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; maxWidth?: string; showClose?: boolean; panelClassName?: string }`. Exported from `src/components/ui/index.ts` unchanged.

- [ ] **Step 1: Install Radix Dialog**

```bash
npm install @radix-ui/react-dialog
```

- [ ] **Step 2: Write the failing test**

Create `src/components/ui/Modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal (Radix)', () => {
  it('renders title and children when open', () => {
    render(
      <Modal open onClose={() => {}} title="Hello">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>nope</p>
      </Modal>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Esc">
        <button>inside</button>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('exposes dialog semantics (role + aria-modal)', () => {
    render(
      <Modal open onClose={() => {}} title="Aria">
        <p>x</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog when opened', () => {
    render(
      <Modal open onClose={() => {}} title="Focus">
        <button>first focusable</button>
      </Modal>,
    );
    // Radix focuses the dialog content (or first focusable) on open.
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Modal.test.tsx`
Expected: FAIL — current Modal does not set `aria-modal` via Radix / focus behavior differs (and the test file references the not-yet-Radix implementation).

- [ ] **Step 4: Re-implement `Modal.tsx` on Radix Dialog**

Replace the entire contents of `src/components/ui/Modal.tsx`:

```tsx
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  showClose?: boolean;
  /** Extra classes for the dialog panel (e.g. theme-specific card chrome). */
  panelClassName?: string;
}

/**
 * Accessible modal built on Radix Dialog (focus trap, Escape, scroll-lock,
 * return-focus, aria) with the app's framer-motion enter/exit animation and
 * token-driven surface styling. API is unchanged from the hand-rolled version.
 */
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', showClose = true, panelClassName }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-modal"
                style={{ background: 'var(--overlay)', backdropFilter: 'blur(6px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
              <Dialog.Content asChild>
                <motion.div
                  className={clsx(
                    'pointer-events-auto w-full bg-bg-raised rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto',
                    maxWidth,
                    panelClassName,
                  )}
                  initial={{ scale: 0.94, y: 12, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.96, y: 8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                  {(title || showClose) && (
                    <div className="flex items-center justify-between px-6 pt-5 pb-2 sticky top-0 bg-surface z-10">
                      <Dialog.Title className="text-lg font-bold text-text">{title}</Dialog.Title>
                      {showClose && (
                        <Dialog.Close asChild>
                          <button
                            aria-label="Close dialog"
                            className="w-8 h-8 grid place-items-center rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </Dialog.Close>
                      )}
                    </div>
                  )}
                  <div className="px-6 pb-6">{children}</div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

Note: Radix warns if `Dialog.Title` is missing for screen readers. `Modal` already always receives a `title` from callers; if a caller omits it, add an aria `VisuallyHidden` title — but current callers all pass one, so YAGNI.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Modal.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite + typecheck + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx
git commit -m "feat(a11y): rebuild Modal on Radix Dialog"
```

---

## Task 3: Re-implement the command palette on cmdk

`CommandPalette.tsx` hand-rolls filtering, arrow-key navigation, selection state, and scroll-into-view. `cmdk` owns all of that (fast fuzzy filter, keyboard nav, grouping, a11y) — it's the library behind shadcn's palette. Keep the existing result sources (nav actions, theme switcher, providers, mocks) and the token-driven styling; cmdk replaces only the interaction layer.

**Files:**
- Modify: `src/components/search/CommandPalette.tsx`
- Test: `src/components/search/CommandPalette.test.tsx`
- Modify: `package.json` (add `cmdk`)

**Interfaces:**
- Consumes: Task 0 (RTL).
- Produces: `CommandPalette()` and `SpotlightSearchTrigger({ className }: { className?: string })` — same exports, same ⌘K/Ctrl+K global trigger, same result categories.

- [ ] **Step 1: Install cmdk**

```bash
npm install cmdk
```

- [ ] **Step 2: Write the failing test**

Create `src/components/search/CommandPalette.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';

// The catalog loads asynchronously from a service; stub it so the palette
// renders deterministic nav/theme items.
vi.mock('@/services/mockCatalog', () => ({
  loadMockCatalog: vi.fn().mockResolvedValue([]),
}));

function openPalette() {
  // The palette listens for a global Ctrl/Cmd+K.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
}

describe('CommandPalette (cmdk)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens on Ctrl+K and shows the search input', async () => {
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    openPalette();
    expect(
      await screen.findByPlaceholderText(/search mocks, providers/i),
    ).toBeInTheDocument();
  });

  it('filters nav actions as you type', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    openPalette();
    const input = await screen.findByPlaceholderText(/search mocks, providers/i);
    await user.type(input, 'Analytics');
    expect(await screen.findByText(/Analytics & Insights/i)).toBeInTheDocument();
    expect(screen.queryByText('Saved Questions')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/search/CommandPalette.test.tsx`
Expected: FAIL — current palette does not filter out non-matching items the way cmdk does (its `results` memo keeps `Saved Questions` when typing a non-matching string is not guaranteed; the cmdk rewrite is what makes this deterministic).

- [ ] **Step 4: Re-implement the interaction layer with cmdk**

Keep every existing import and the result-building logic, but replace the manual `selectedIndex`/`handleKeyDownInList`/`scrollIntoView` machinery with cmdk's `Command` primitives. The key changes inside `CommandPalette`'s returned JSX:

Replace the `<motion.div … onKeyDown={handleKeyDownInList}>` container and inner input/list with cmdk:

```tsx
import { Command } from 'cmdk';
```

Inside the open branch, wrap the box:

```tsx
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl rounded-3xl bg-bg-raised/95 backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col z-10"
            >
              <Command label="Global search" loop>
                <div className="flex items-center px-4 sm:px-6 h-14 border-b border-[var(--glass-border)] gap-3">
                  <Search size={18} className="text-muted shrink-0" />
                  <Command.Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search mocks, providers, settings, or jump to page…"
                    className="flex-1 bg-transparent text-text placeholder:text-muted text-base focus:outline-none"
                  />
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 text-muted text-[11px] font-mono font-medium">
                    ESC
                  </span>
                </div>

                <Command.List className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                  <Command.Empty className="p-8 text-center text-muted">
                    <p className="text-sm font-semibold text-text">No results found</p>
                    <p className="text-xs mt-1">Try searching for provider names like "Oliveboard" or test names.</p>
                  </Command.Empty>
                  {results.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.title} ${item.subtitle ?? ''}`}
                      onSelect={() => item.action()}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none text-text data-[selected=true]:bg-primary-soft/50 data-[selected=true]:ring-1 data-[selected=true]:ring-primary/40 hover:bg-surface-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-surface-2">
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
                    </Command.Item>
                  ))}
                </Command.List>

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
              </Command>
            </motion.div>
```

Then **delete** the now-unused code: the `selectedIndex` state, `handleKeyDownInList`, the `listRef` + `scrollIntoView` effect, the reset-`selectedIndex` effect, and the per-item `isSelected`/`onMouseEnter` logic (cmdk manages selection via `data-[selected=true]`). Keep the ⌘K/Ctrl+K/Escape listener, the `query` state, the `results` memo, the catalog load, and `SpotlightSearchTrigger` exactly as they are. (`inputRef` auto-focus is no longer needed — cmdk's `Command.Input` autofocuses on mount; remove it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/search/CommandPalette.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite + typecheck + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all green (oxlint should flag the now-unused imports — remove any it reports).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/search/CommandPalette.tsx src/components/search/CommandPalette.test.tsx
git commit -m "feat(palette): rebuild command palette on cmdk"
```

---

## Task 4: Virtualize the exam QuestionPalette with react-virtuoso

`QuestionPalette` renders every visible question tile (up to ~200 in a full mock) via `visibleIndices.map`. The tiles are fixed-size squares in a 5-column grid — an ideal fit for `VirtuosoGrid`, which mounts only the on-screen rows. This is the biggest runtime perf win on the exam screen.

**Files:**
- Modify: `src/components/exam/QuestionPalette.tsx`
- Test: `src/components/exam/QuestionPalette.test.tsx`
- Modify: `package.json` (add `react-virtuoso`)

**Interfaces:**
- Consumes: Task 0 (RTL).
- Produces: `QuestionPalette()` and `PaletteLegend()` — same exports, same TCS iON tile semantics (`TileStatus`, `PaletteButton`), same store selectors. Only the rendering container changes (grid → virtualized grid).

- [ ] **Step 1: Install react-virtuoso**

```bash
npm install react-virtuoso
```

- [ ] **Step 2: Write the failing test**

Create `src/components/exam/QuestionPalette.test.tsx`. This mirrors the seeding pattern from `src/stores/examStore.test.ts` (the canonical fixture: `makeQuestion` / `makeMeta` factories + `loadExam` + `startExam`), which drives the store through its real public actions rather than guessing internal field shapes:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ExamMeta, Question } from '@/types';

/* examStore holds module singletons; reset modules + storage per test and
   re-import, exactly as src/stores/examStore.test.ts does. */
const loadStore = () => import('@/stores/examStore');
const loadPalette = () => import('./QuestionPalette');

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return { question: 'Q?', options: ['A', 'B', 'C', 'D'], correct_option_id: 1, marks: 2, ...overrides };
}

function makeMeta(questionCount: number): ExamMeta {
  return {
    path: 'providers/Test/exam.html',
    name: 'Test Exam',
    durationMinutes: 60,
    sections: [{ name: 'General', start: 0, end: questionCount - 1 }],
  };
}

async function renderActivePalette(questionCount: number) {
  const { useExamStore } = await loadStore();
  const { QuestionPalette } = await loadPalette();
  const questions = Array.from({ length: questionCount }, () => makeQuestion());
  useExamStore.getState().loadExam(makeMeta(questionCount), questions);
  useExamStore.getState().startExam();
  return render(<QuestionPalette />);
}

describe('QuestionPalette virtualization', () => {
  it('does not mount every tile for a long exam', async () => {
    await renderActivePalette(100);
    const mounted = screen.getAllByRole('button', { name: /question \d+/i });
    // VirtuosoGrid mounts only the visible window, far fewer than 100.
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(100);
  });

  it('renders the first question tile', async () => {
    await renderActivePalette(100);
    expect(screen.getByRole('button', { name: /question 1,/i })).toBeInTheDocument();
  });
});
```

(If `Question`'s required fields differ, copy the exact `makeQuestion`/`makeMeta` bodies from `src/stores/examStore.test.ts` — do not guess field names.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/exam/QuestionPalette.test.tsx`
Expected: FAIL — the current grid mounts all 100 tiles, so `mounted.length` is `100`, failing the `< 100` assertion.

- [ ] **Step 4: Virtualize the grid**

In `src/components/exam/QuestionPalette.tsx`, add the import:

```tsx
import { VirtuosoGrid } from 'react-virtuoso';
```

Replace the `<div className="grid grid-cols-5 …">{visibleIndices.map(…)}</div>` block (lines 113–138) with a `VirtuosoGrid`:

```tsx
  return (
    <VirtuosoGrid
      style={{ height: 420 }}
      totalCount={visibleIndices.length}
      listClassName="grid grid-cols-5 gap-1.5 pl-2"
      itemClassName="aspect-square"
      overscan={40}
      aria-label="Question palette"
      itemContent={(index) => {
        const idx = visibleIndices[index];
        let status: TileStatus;
        if (phase === 'submitted' && !reattemptMode) {
          status = reviewStatus(idx, questions, answers);
        } else {
          const base = activeStatus(idx, answers, flags, visited);
          if (base === 'marked' && answers[idx] !== undefined) status = 'marked_answered';
          else status = base;
        }
        return (
          <PaletteButton
            idx={idx}
            status={status}
            active={idx === currentIdx}
            onSelect={navigateTo}
          />
        );
      }}
    />
  );
```

Notes:
- `style={{ height: 420 }}` gives the virtualizer a fixed viewport. Match whatever max-height the palette container already uses in the exam layout — if the parent already constrains height, use `useVirtuosoGrid`'s default `height: 100%` via a wrapper instead. Confirm against the exam layout and pick the value that preserves current appearance.
- Keep the existing `PaletteButton` component and `memo` exactly as-is.
- `PaletteLegend` is untouched.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/exam/QuestionPalette.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite + typecheck + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/exam/QuestionPalette.tsx src/components/exam/QuestionPalette.test.tsx
git commit -m "perf(exam): virtualize question palette with react-virtuoso"
```

---

## Task 5: Replace ConfettiBurst with canvas-confetti

`ConfettiBurst` hand-animates 18 framer-motion particles per burst. `canvas-confetti` is GPU-cheap, richer, and honors reduced-motion with one flag. It's used once — `ResultModal.tsx` line 82, gated on `pct >= 40` and fired on mount. Keep that mount-gated, self-disabling-under-reduced-motion contract and the on-brand color palette.

**Files:**
- Modify: `src/components/ui/ConfettiBurst.tsx`
- Test: `src/components/ui/ConfettiBurst.test.tsx`
- Modify: `package.json` (add `canvas-confetti` + `@types/canvas-confetti`)

**Interfaces:**
- Consumes: Task 0 (RTL).
- Produces: `ConfettiBurst({ count }: { count?: number })` — same export from `src/components/ui/index.ts`, same props, same "fires once on mount, returns null under reduced-motion" contract. `count` is still accepted (maps to `particleCount`) so callers don't change.

- [ ] **Step 1: Install canvas-confetti**

```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

- [ ] **Step 2: Write the failing test**

Create `src/components/ui/ConfettiBurst.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import confetti from 'canvas-confetti';
import { ConfettiBurst } from './ConfettiBurst';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// framer-motion's useReducedMotion reads matchMedia; control it per test.
function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe('ConfettiBurst (canvas-confetti)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires a confetti burst on mount', () => {
    setReducedMotion(false);
    render(<ConfettiBurst />);
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it('maps count to particleCount', () => {
    setReducedMotion(false);
    render(<ConfettiBurst count={30} />);
    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ particleCount: 30 }));
  });

  it('does not fire under prefers-reduced-motion', () => {
    setReducedMotion(true);
    render(<ConfettiBurst />);
    expect(confetti).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ConfettiBurst.test.tsx`
Expected: FAIL — current implementation renders framer particles and never calls `canvas-confetti`.

- [ ] **Step 4: Re-implement `ConfettiBurst.tsx`**

Replace the entire contents of `src/components/ui/ConfettiBurst.tsx`:

```tsx
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useReducedMotion } from 'framer-motion';

export interface ConfettiBurstProps {
  /** Number of particles. Default 90 reads as "celebration" on a desktop canvas. */
  count?: number;
}

/** Resolve a CSS custom property to a concrete color for the canvas renderer. */
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * One-shot confetti burst fired on mount (used by ResultModal for a passing
 * score). Canvas-based via canvas-confetti — GPU-cheap and self-cleaning.
 * Honors prefers-reduced-motion by not firing. Renders nothing to the DOM.
 * Colors resolve from the app's tonal tokens so it stays on-brand per theme.
 */
export function ConfettiBurst({ count = 90 }: ConfettiBurstProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const colors = [
      token('--primary', '#6366f1'),
      token('--success', '#22c55e'),
      token('--info', '#3b82f6'),
      token('--warning', '#f59e0b'),
      token('--accent', '#6366f1'),
    ];
    confetti({
      particleCount: count,
      spread: 75,
      startVelocity: 38,
      origin: { x: 0.5, y: 0.2 },
      colors,
      disableForReducedMotion: true,
    });
  }, [count, reduce]);

  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/ConfettiBurst.test.tsx`
Expected: PASS

- [ ] **Step 6: Verify the caller is unchanged and run the full suite + typecheck + lint**

`ResultModal.tsx` still does `{pct >= 40 && <ConfettiBurst />}` with no `count` prop — that still works (default 90). No edit needed.

```bash
npm test && npm run build && npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/ui/ConfettiBurst.tsx src/components/ui/ConfettiBurst.test.tsx
git commit -m "feat(ui): replace custom confetti with canvas-confetti"
```

---

## Self-Review

**Spec coverage** (against `2026-08-05-frontend-design-audit-design.md` shortlist):
1. Lenis (replace Locomotive) → **Task 1** ✓
2. Radix primitives for Modal → **Task 2** ✓ (ProvidersNavDropdown deferred — see gaps)
3. cmdk palette → **Task 3** ✓
4. react-virtuoso for long lists → **Task 4** ✓ (QuestionPalette)
5. canvas-confetti → **Task 5** ✓
6. Embla → **deferred to Phase 2** (spec explicitly marks YAGNI) — intentionally not a task.
7. `motion` migration + framer `LazyMotion` → **deferred "later, not urgent"** in spec — intentionally not a task.

**Known scope notes (not gaps — conscious deferrals):**
- **ProvidersNavDropdown → Radix DropdownMenu/NavigationMenu**: the spec bundles it with the Modal rec, but it's a hover-driven megamenu (440px grid), not a simple menu — Radix NavigationMenu is the right primitive and it deserves its own focused task + design pass. Deferred to keep this plan's tasks bite-sized; recommended as the immediate follow-up.
- Dashboard rails/grids (`MockGrid`, `MyListRail`) virtualization: `QuestionPalette` was the highest-value target; rails are horizontal snap-rows better served by Embla (Phase 2) than by `react-virtuoso`.

**Placeholder scan:** all steps have concrete code/commands; the only forward-reference is the explicit "read examStore.test.ts for the fixture shape" instruction in Task 4 (a real instruction, not a placeholder).

**Type consistency:** `SmoothScrollContextValue`, `ModalProps`, `ConfettiBurstProps`, and `useLenisScroll`'s return type are used identically across producer and consumer tasks. Lenis instance type (`Lenis`) matches between `useLenisScroll`, `SmoothScroll`, and `useHeroParallax`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-05-frontend-level-up.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
