/* SECTION ANALYTICS — per-section performance aggregation.
   Every persisted Attempt carries `sections[]` (name/start/end index
   ranges) plus a `perQuestion[]` snapshot (idx, isCorrect, isSkipped,
   timeSec). Mapping each answered question onto its section by index
   range yields accuracy + speed per section ACROSS the whole attempt
   history — no mock re-parsing, works offline from stored data. This
   powers the Weak-Section Heatmap: "where am I actually losing marks". */
import type { AetherDB, Attempt } from '@/types';

export interface SectionStat {
  /** Section name (e.g. "Quantitative Aptitude", "General Awareness"). */
  name: string;
  /** Questions answered (correct + incorrect); skipped excluded from accuracy. */
  answered: number;
  correct: number;
  incorrect: number;
  skipped: number;
  /** 0–100 accuracy over answered questions; null when nothing answered. */
  accuracy: number | null;
  /** Mean seconds per question (incl. skipped), null when no timing captured. */
  avgTimeSec: number | null;
  /** Distinct exams this section was seen in (confidence in the stat). */
  exams: number;
}

/** Resolve which section a question index belongs to, given an attempt's
    section ranges. Falls back to the exam's single/implicit section when the
    index is outside every range (defensive — a malformed snapshot shouldn't
    drop the question from the totals). */
function sectionForIndex(attempt: Attempt, idx: number): string {
  const secs = attempt.sections;
  if (!secs || secs.length === 0) return 'General';
  for (const s of secs) {
    if (idx >= s.start && idx <= s.end) return s.name.trim() || 'General';
  }
  return 'General';
}

interface Accum {
  answered: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeSum: number;
  timeCount: number;
  exams: Set<string>;
}

/**
 * Aggregate per-section stats across the entire attempt history.
 * Latest attempt per exam is what counts (re-attempts supersede), matching
 * how the rest of Analytics reads `arr[arr.length - 1]`.
 */
export function computeSectionStats(db: AetherDB): SectionStat[] {
  const bySection = new Map<string, Accum>();

  Object.entries(db.attempts).forEach(([path, arr]) => {
    const attempt = arr?.[arr.length - 1];
    if (!attempt || !Array.isArray(attempt.perQuestion)) return;

    attempt.perQuestion.forEach((pq) => {
      const name = sectionForIndex(attempt, pq.idx);
      let acc = bySection.get(name);
      if (!acc) {
        acc = {
          answered: 0,
          correct: 0,
          incorrect: 0,
          skipped: 0,
          timeSum: 0,
          timeCount: 0,
          exams: new Set(),
        };
        bySection.set(name, acc);
      }
      acc.exams.add(path);
      if (pq.isCorrect) {
        acc.correct++;
        acc.answered++;
      } else if (pq.isIncorrect) {
        acc.incorrect++;
        acc.answered++;
      } else {
        acc.skipped++;
      }
      if (typeof pq.timeSec === 'number' && pq.timeSec > 0) {
        acc.timeSum += pq.timeSec;
        acc.timeCount++;
      }
    });
  });

  const out: SectionStat[] = [];
  bySection.forEach((a, name) => {
    out.push({
      name,
      answered: a.answered,
      correct: a.correct,
      incorrect: a.incorrect,
      skipped: a.skipped,
      accuracy: a.answered > 0 ? Math.round((a.correct / a.answered) * 100) : null,
      avgTimeSec: a.timeCount > 0 ? Math.round(a.timeSum / a.timeCount) : null,
      exams: a.exams.size,
    });
  });

  /* Weakest first — the heatmap is a "fix this next" list. Sections with no
     answered questions (accuracy null) sink to the bottom. */
  return out.sort((x, y) => {
    if (x.accuracy === null && y.accuracy === null) return y.answered - x.answered;
    if (x.accuracy === null) return 1;
    if (y.accuracy === null) return -1;
    return x.accuracy - y.accuracy;
  });
}
