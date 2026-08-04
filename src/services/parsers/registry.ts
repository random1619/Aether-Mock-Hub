/* PROVIDER PARSER REGISTRY
   Ordered adapter list — most specific first, resolved by catalog
   path. Returns null for providers with no adapter (the shared
   pipeline's generic heuristics then apply unchanged).

   Coverage (catalog folders under public/providers/):
     Mocks360         → letter-option unshuffle + key repair
     EnglishMadhyam   → 1-based key rebase + strip "N)" ordinals
     StaticGK         → strip embedded stem numbering
     Oliveboard       → canonical guard (tripwire on schema drift)
     Pundits          → canonical guard
     TheSolver        → canonical guard
     Random Mocks     → canonical guard (legacy q/opts/ans schema)
     CurrentAffairsPDF → no adapter — ships PDFs, not mock HTML */
import type { ProviderParser } from './types';
import { mocks360Parser } from './providers/mocks360';
import { englishMadhyamParser } from './providers/englishMadhyam';
import { staticGkParser } from './providers/staticGk';
import { canonicalGuard } from './providers/canonicalGuard';

const registry: ProviderParser[] = [
  mocks360Parser,
  englishMadhyamParser,
  staticGkParser,
  canonicalGuard({ id: 'oliveboard', folder: 'Oliveboard' }),
  canonicalGuard({ id: 'pundits', folder: 'Pundits' }),
  canonicalGuard({ id: 'thesolver', folder: 'TheSolver' }),
  canonicalGuard({ id: 'randommocks', folder: 'Random Mocks' }),
];

export function resolveProviderParser(path: string): ProviderParser | null {
  return registry.find((p) => p.match(path)) ?? null;
}
