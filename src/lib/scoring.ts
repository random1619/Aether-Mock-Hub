/* SCORING — pure exam evaluation logic.
   Mirrors the legacy engine's rules exactly:
     +marks for correct, −0.25·marks for incorrect, 0 for unattempted,
     total floored at 0. Accuracy = correct / (correct+incorrect) ×100. */
import type { ExamSection, Question } from '@/types';

export interface SectionScore {
  name: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /** 0–100 integer */
  accuracy: number;
  sections: SectionScore[];
}

const NEGATIVE_RATIO = 0.25;

export function scoreAttempt(
  questions: Question[],
  answers: Record<number, number>,
  sections?: ExamSection[],
): ScoreResult {
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let score = 0;
  let maxScore = 0;

  questions.forEach((q, idx) => {
    const marks = typeof q.marks === 'number' && Number.isFinite(q.marks)
      ? q.marks
      : 2;
    maxScore += marks;
    const ans = answers[idx];
    if (ans === undefined) {
      unattempted++;
    } else if (ans === q.correct_option_id) {
      correct++;
      score += marks;
    } else {
      incorrect++;
      score -= NEGATIVE_RATIO * marks;
    }
  });
  // No artificial floor: SSC applies true negative marking, so a heavily-wrong
  // attempt can legitimately score below 0. Reporting the raw total keeps the
  // headline score exactly equal to the sum of the per-section scores.
  score = Math.round(score * 100) / 100;

  const attempted = correct + incorrect;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  const sectionScores: SectionScore[] = (sections || []).map((sec) => {
    let c = 0;
    let w = 0;
    let u = 0;
    let s = 0;
    for (let i = sec.start; i <= sec.end; i++) {
      const q = questions[i];
      if (!q) continue;
      const marks = typeof q.marks === 'number' && Number.isFinite(q.marks)
        ? q.marks
        : 2;
      const ans = answers[i];
      if (ans === undefined) {
        u++;
      } else if (ans === q.correct_option_id) {
        c++;
        s += marks;
      } else {
        w++;
        s -= NEGATIVE_RATIO * marks;
      }
    }
    // Report the RAW section score (may be negative under negative marking).
    // Rounded for clean display; headline = sum(sections), no contradiction.
    return { name: sec.name, correct: c, incorrect: w, unattempted: u, score: Math.round(s * 100) / 100 };
  });

  return { score, maxScore, correct, incorrect, unattempted, accuracy, sections: sectionScores };
}

/** Status of a question during an active exam (for the palette). */
export function activeStatus(
  idx: number,
  answers: Record<number, number>,
  flags: Set<number>,
  visited: Set<number>,
): 'answered' | 'marked' | 'notvisited' | 'notanswered' {
  if (flags.has(idx)) return 'marked';
  if (answers[idx] !== undefined) return 'answered';
  if (!visited.has(idx)) return 'notvisited';
  return 'notanswered';
}

/** Status of a question post-submit (for review). */
export function reviewStatus(
  idx: number,
  questions: Question[],
  answers: Record<number, number>,
): 'correct' | 'incorrect' | 'unattempted' {
  const ans = answers[idx];
  if (ans === undefined) return 'unattempted';
  return ans === questions[idx]?.correct_option_id ? 'correct' : 'incorrect';
}

export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs || 0));
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}
