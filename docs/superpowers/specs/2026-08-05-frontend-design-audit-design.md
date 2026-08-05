# Frontend Design Audit & Level-Up — Design Spec

**Date:** 2026-08-05
**Project:** Aether Mock Hub (Electron + React 19 + Vite + Tailwind v4)
**Status:** Approved direction (Approach B), pending implementation plan
**Skill phase:** Brainstorming → design. Implementation is a separate `writing-plans` step.

---

## Goal

Audit the frontend and recommend libraries/frameworks to level up frontend design across four dimensions: **visual polish & motion**, **component system & DX**, **accessibility & robustness**, and **performance & bundle**.

The stack is already mature (3-theme token system, custom liquid glass, three animation engines, hand-rolled a11y primitives). This is therefore not "add missing basics." It is: **(1) remove redundancy** costing bundle + complexity, **(2) replace hand-rolled accessibility with battle-tested primitives**, **(3) add high-leverage polish** on that cleaner base.

---

## 1 · Context & Constraints

### Current stack
- **Build/runtime:** Electron 34, Vite 8, React 19, TypeScript 6
- **Styling:** Tailwind CSS v4 (CSS-first `@theme`); 3 themes (Apple light default, Apple dark, Netflix) via CSS custom properties + `@custom-variant dark`
- **State/routing:** Zustand 5, react-router-dom 7
- **Animation (3 overlapping engines):** framer-motion 12, GSAP 3 + ScrollTrigger + `@gsap/react`, Locomotive Scroll 5 — plus react-intersection-observer 11 and `@number-flow/react`
- **Custom design system:** visionOS **LiquidGlass** (SVG `feTurbulence` + `feDisplacementMap` refraction); semantic tokens (`--bg`, `--surface`, `--primary`, `--chart-1..5`, `--liquid-shadow`)
- **Hand-rolled a11y primitives:** `Modal` (focus trap / Escape / scroll-lock), `ProvidersNavDropdown`, `CommandPalette`, `Reveal`, `ConfettiBurst`
- **Charts/misc:** recharts 3, sonner, lucide-react, dompurify, dayjs, clsx

### Hard constraints
- **Offline / Electron-only** — no CDN-hosted fonts, no runtime services; everything bundled.
- **Free / OSS-only** — no paid libraries or plugins. (GSAP is fully free as of 3.13 post-Webflow acquisition, so existing GSAP use is compliant.)

### Approach chosen: **B — Consolidate + Level-Up**
The highest-leverage moves are *removing redundancy* and *adopting proven primitives*, then adding polish on a cleaner base. Net effect: smaller bundle **and** more capability.

- **Rejected A (targeted gap-fill):** leaves the three-engine overlap and unmaintained smooth-scroll in place.
- **Rejected C (full design-system rebuild):** high effort/risk; YAGNI given the strong existing token system and components.

---

## 2 · Findings & Recommendations (by dimension)

### 2.1 Visual polish & motion

**Finding:** Three overlapping animation engines coexist — framer-motion (springs/modals/reveals), GSAP+ScrollTrigger (hero parallax), Locomotive Scroll (smooth scroll) — plus `@number-flow/react` for numerals. This costs KB and integration complexity: `useHeroParallax` manually bridges Locomotive → ScrollTrigger via `instance.on('scroll', ScrollTrigger.update)`.

| Move | Library | Rationale |
|---|---|---|
| **Replace Locomotive Scroll** | **Lenis** (`lenis`) | Locomotive is effectively unmaintained (~2021). Lenis is the modern, lighter, actively-maintained successor with first-class GSAP/ScrollTrigger integration that **deletes the manual bridge**. Same `lerp` feel. |
| **Keep framer-motion as primary React engine** | — (existing) | Springs, `AnimatePresence`, layout/reveal. Optionally evaluate `motion` (`motion/react`, its successor) later — no urgency. |
| **Scope GSAP to scroll-scrubbed scenes only** | — (existing, now free) | Keep for hero parallax; stop using it where framer-motion already covers the job. |
| **Replace hand-rolled confetti** | **`canvas-confetti`** | `ConfettiBurst` hand-animates 18 framer particles. `canvas-confetti` is GPU-cheap, richer, and supports `disableForReducedMotion`. |
| **Keep `@number-flow/react`** | — (existing) | Animated numerals are a win; retain. |

### 2.2 Component system & DX

**Finding:** Accessibility primitives are hand-rolled. `Modal`, `ProvidersNavDropdown`, and `CommandPalette` are correct but reimplement problems that dedicated libraries solve more robustly (focus-management edge cases, aria attributes, portal handling, typeahead).

| Move | Library | Rationale |
|---|---|---|
| **Adopt headless primitives under styled components** | **Radix UI** (`@radix-ui/react-dialog`, `-dropdown-menu`, `-navigation-menu`) | Keep the exact visual design (tokens, liquid glass) but swap the **behavior** layer. Radix gives focus trap, aria, portal, dismissal for free — battle-tested. **Chosen over Base UI** for ecosystem maturity. |
| **Replace hand-rolled ⌘K palette** | **`cmdk`** | Purpose-built command menu: fast filtering, keyboard nav, grouping, a11y. Keep existing result sources (nav / theme / providers / mocks); cmdk owns interaction. |
| **(Deferred — Phase 2) Carousel for Netflix rails** | **Embla Carousel** (`embla-carousel-react`) | Buttery, accessible, keyboard-friendly carousels with drag physics; headless so it skins to the theme. **Only if true carousel drag/keyboard behavior is wanted** — otherwise YAGNI for now. |

### 2.3 Accessibility & robustness

Mostly **won by the moves above** (Radix / cmdk / Embla are accessibility-first). One addition:

| Move | Library | Rationale |
|---|---|---|
| **Virtualize long mock/question lists** | **`react-virtuoso`** | Long lists render every row today. Virtualization keeps the DOM small → smoother scroll, faster, less layout jank. **Chosen over `@tanstack/react-virtual`** as friendlier for variable-height rows. |
| **Focus / portal correctness** | *(via Radix)* | Radix's focus-trap is hardened against nested portals, iframes, and return-focus edge cases vs. the hand-rolled trap. |

All chosen libraries work **fully offline** — no CDN fonts, no runtime services. `dompurify` (SafeHtml) retained.

### 2.4 Performance & bundle

| Move | Impact |
|---|---|
| **Locomotive → Lenis** | Removes an unmaintained dep + deletes the manual ScrollTrigger bridge. Net smaller. |
| **`canvas-confetti`** replaces custom particle system | Drops per-particle framer-motion overhead. |
| **Virtualization** | Biggest runtime win on long screens — fewer mounted nodes, less reconcile work. |
| **Headless primitives (Radix / cmdk)** | Small and tree-shakeable (per-component imports); slight add, offset by Locomotive removal. |
| **(Later) framer-motion `LazyMotion` + `domAnimation`** | The app imports full framer-motion everywhere; `LazyMotion` can cut its baseline meaningfully. Bundle hygiene, not urgent. |

**Expected net effect:** fewer total animation KB and faster long screens, despite added capability.

---

## 3 · Ranked Shortlist — "do these first"

1. **Lenis** (replace Locomotive) — kills an unmaintained dep + simplifies `useHeroParallax`. *Low risk, immediate payoff.*
2. **Radix primitives** for Modal + ProvidersNavDropdown — biggest a11y/robustness win, keeps the design. *Medium effort.*
3. **`cmdk`** for the command palette — better UX + less code. *Low-medium effort.*
4. **`react-virtuoso`** for long mock lists — biggest runtime perf win. *Low effort, contained.*
5. **`canvas-confetti`** — cheap polish upgrade. *Trivial.*
6. **(Phase 2) Embla** for Netflix rails — only if true carousel behavior is wanted; otherwise defer (YAGNI).
7. **(Later) `motion` migration + framer `LazyMotion`** — bundle hygiene, not urgent.

---

## 4 · Non-Goals

- Re-theming or rebuilding the design-token system (already strong).
- Removing GSAP (kept, scoped to scroll-scrubbed scenes).
- Any CDN/hosted/runtime-service dependency (violates offline/Electron).
- Any paid library or plugin (violates free/OSS).
- Replacing recharts, sonner, lucide-react, dompurify, dayjs (all retained).

## 5 · Open Decisions (resolved)

- **Radix vs Base UI** → **Radix** (ecosystem maturity).
- **Embla** → included as a **deferred Phase-2** recommendation, not core scope.

## 6 · Next Step

Produce a phased **implementation plan** (via the `writing-plans` skill) that sequences the ranked shortlist with migration notes — starting with Lenis, then Radix primitives, then cmdk, then virtualization — each phase independently shippable with tests passing.
