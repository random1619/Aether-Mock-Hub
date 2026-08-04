/* STATIC GK ADAPTER
   Schema is canonical (question/options/correct_option_id/solution),
   but some files bake the question number into the stem —
   "<p>1.<span> The ancient harvest festival…" — which double-numbers
   against the engine's own question badge. Cosmetic only: the answer
   keys are already 0-based and correct. Strip the leading ordinal. */
import type { Question } from '@/types';
import type { ProviderParser } from '../types';

/** Leading "N." / "N)" list marker. Tolerant of wrapping tags before AND
    after the number ("<p>1.<span> …"), since generators interleave markup
    with the baked-in ordinal. */
const STEM_ORDINAL = /^(\s*(?:<[^>]+>\s*)*)\d+\s*[.)](?:\s*<[^>]+>)*\s+/;

function stripStemNumber(q: Question): Question {
  if (!STEM_ORDINAL.test(q.question)) return q;
  return { ...q, question: q.question.replace(STEM_ORDINAL, '$1') };
}

export const staticGkParser: ProviderParser = {
  id: 'staticgk',
  match: (path) => /(^|\/)providers\/StaticGK\//i.test(path),
  postProcess: (questions) => questions.map(stripStemNumber),
};
