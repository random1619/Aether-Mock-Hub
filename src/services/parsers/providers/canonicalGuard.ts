/* CANONICAL GUARD FACTORY
   Several vendors (Oliveboard, Pundits, TheSolver) already ship the
   exact canonical schema the shared pipeline produces — clean
   `question/options/correct_option_id(0-based)/solution`. They need
   no fixup today. These adapters exist purely as TRIPWIRES: each
   validates the shape it was audited against and records a warning
   the moment the vendor's generator drifts (a new key base, a renamed
   field, an unexpected option count), so a silent schema change can
   never mis-score a mock unnoticed.

   Random Mocks uses the legacy `q/opts/ans/sol/tag` schema that the
   shared `canonicalizeRaw` already maps — its guard asserts the
   post-mapping invariants instead. */
import type { ProviderParser } from '../types';

export interface GuardSpec {
  id: string;
  /** Folder segment the catalog path is matched against. */
  folder: string;
  /** Expected number of options per question, or null to skip the check. */
  expectedOptions?: number | null;
}

/**
 * Build a validating-only adapter. Returns questions unchanged; appends a
 * human-readable warning for each invariant that no longer holds.
 */
export function canonicalGuard(spec: GuardSpec): ProviderParser {
  const folderRe = new RegExp(`(^|/)providers/${spec.folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'i');
  return {
    id: spec.id,
    match: (path) => folderRe.test(path),
    postProcess: (questions, warnings) => {
      let empty = 0;
      let wrongOptCount = 0;
      questions.forEach((q, i) => {
        if (!q.question || !q.question.trim()) empty++;
        // When there are no options, *any* key is out of range but the real
        // problem is the missing options array — flag that instead of a
        // misleading "out of range" for the key.
        if (q.options.length === 0) {
          warnings.push(
            `${spec.id}: Q${i + 1} has no options (correct_option_id is ${q.correct_option_id})`,
          );
        } else if (
          !Number.isInteger(q.correct_option_id) ||
          q.correct_option_id < 0 ||
          q.correct_option_id >= q.options.length
        ) {
          warnings.push(
            `${spec.id}: Q${i + 1} correct_option_id ${q.correct_option_id} out of range (${q.options.length} options)`,
          );
        }
        if (spec.expectedOptions != null && q.options.length !== spec.expectedOptions) {
          wrongOptCount++;
        }
      });
      if (empty) warnings.push(`${spec.id}: ${empty} question(s) have an empty stem`);
      if (wrongOptCount && spec.expectedOptions != null) {
        warnings.push(
          `${spec.id}: ${wrongOptCount} question(s) deviate from expected ${spec.expectedOptions} options`,
        );
      }
      return questions;
    },
  };
}
