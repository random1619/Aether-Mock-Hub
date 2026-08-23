/* PROVIDER REGISTRY — canonical metadata for each mock provider.
   Maps the catalog `provider` string → dashboard route, display
   title, tagline, and accent tone. Single source of truth shared by
   the provider pages (via ProviderPage brands) and the dashboard's
   Browse-by-Provider cards. */

export interface ProviderMeta {
  /** Exact provider string as it appears in mocks-data (m.provider). */
  provider: string;
  /** Dashboard route under /provider/. */
  slug: string;
  /** Display title (may normalize the catalog string's casing). */
  title: string;
  tagline: string;
  /** Accent tone for cards / hero badge. */
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'Oliveboard',
    slug: 'oliveboard',
    title: 'Oliveboard',
    tagline: 'The largest collection — full mocks, tier-wise practice, and advanced GK across every SSC subject.',
    tone: 'primary',
  },
  {
    provider: 'English Madhyam',
    slug: 'english-madhyam',
    title: 'English Madhyam',
    tagline: 'Chapter-wise previous-year questions for English — synonyms, antonyms, idioms, and vocabulary drills.',
    tone: 'info',
  },
  {
    provider: 'Random Mocks',
    slug: 'random-mocks',
    title: 'Random Mocks',
    tagline: 'Topical quizzes and bilingual static-GK sets — quick targeted practice across vocabulary and general awareness.',
    tone: 'success',
  },
  {
    provider: 'Pundits',
    slug: 'pundits',
    title: 'Pundits',
    tagline: 'Full-length SSC CGL pre and mains mocks with detailed solutions, modeled on the real TCS exam pattern.',
    tone: 'warning',
  },
  {
    provider: 'The Solver',
    slug: 'the-solver',
    title: 'The Solver',
    tagline: 'Section-wise tests and full mocks with crisp bilingual explanations to sharpen speed and accuracy.',
    tone: 'danger',
  },
  {
    provider: '360 Mocks',
    slug: '360-mocks',
    title: '360 Mocks',
    tagline: 'Pro-level GK and current-affairs mocks — statement-based questions that build deep conceptual recall.',
    tone: 'info',
  },
  {
    provider: 'Static GK',
    slug: 'static-gk',
    title: 'Static GK',
    tagline: 'Focused static general-knowledge sets — art, culture, history, and geography facts that repeat in SSC.',
    tone: 'success',
  },
  {
    provider: 'Current Affairs PDF',
    slug: 'current-affairs-pdf',
    title: 'Current Affairs PDF',
    tagline: 'Monthly current-affairs magazines and GK compendiums in PDF form for offline reading and revision.',
    tone: 'neutral',
  },
  {
    provider: 'Others',
    slug: 'others',
    title: 'Others — Organized Collection',
    tagline: '579 newly organized mocks sorted by subject → topic — Quant, Reasoning, English, GK, and Computer, precisely classified by content.',
    tone: 'primary',
  },
];

/** Lookup by catalog provider string. */
export function providerMeta(provider: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.provider === provider);
}

/** Dashboard route for a provider catalog string. */
export function providerPath(provider: string): string {
  const meta = providerMeta(provider);
  return meta ? `/provider/${meta.slug}` : '/';
}
