/* PROVIDER PARSER CONTRACT
   Each vendor (Mocks360, Oliveboard, Pundits, …) ships data with
   its own quirks. An adapter overrides ONLY the pipeline stage
   where its provider deviates — fetching, script extraction,
   sanitization, and section building stay shared in mockParser. */
import type { Question } from '@/types';

export interface ProviderParser {
  /** Stable adapter id (surfaced in warnings for traceability). */
  id: string;
  /**
   * Authoritative provider detection from the catalog path.
   * Catalog paths always start `providers/<Folder>/`, so match on
   * the folder segment — never on content sniffing.
   */
  match(path: string): boolean;
  /**
   * Raw-object fixup applied to the decoded JSON question BEFORE field
   * mapping + validation. Use this when the vendor's answer key / option
   * encoding would be destroyed by the standard validation (e.g. a 1-based
   * key the validator clamps to option A). Runs on the raw record; must
   * preserve the question count.
   */
  preprocessRaw?(raw: Record<string, unknown>[]): Record<string, unknown>[];
  /**
   * Provider-wide fixup applied AFTER field mapping + sanitization
   * and BEFORE section building. Must not add/remove questions.
   * Record human-readable notes in `warnings`.
   */
  postProcess?(questions: Question[], warnings: string[]): Question[];
  /**
   * OPTIONAL: extra per-field sanitization layered on top of the shared
   * DOMPurify pass. Runs on every question/option/solution/comp string during
   * field mapping. Use for provider-specific cosmetic cleanup the global
   * sanitize config doesn't (or shouldn't globally) do — e.g. stripping a
   * vendor's ChatGPT-export residue attributes at the source so the guarantee
   * doesn't depend on a FORBID_ATTR entry staying in the global config.
   * Must be pure and idempotent; must not remove real content (words/layout).
   */
  sanitizeHtml?(html: string): string;
}