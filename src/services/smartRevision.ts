/* SMART REVISION — auto-generated "retry your wrong questions" exam.
   Reads per-question outcomes from attempt history, groups wrong
   questions by their source mock, fetches the actual Question objects
   (parseMock is cached), and assembles a synthetic exam that runs in
   the normal engine under a smart-revision/* pseudo path.

   Scoping: `smart-revision/all` = every mock, or
   `smart-revision/exam/<examPath>` = wrong questions of one mock only. */
import type { ExamMeta, PerQuestionRecord, Question } from '@/types';
import { parseMock, type ParsedExam } from '@/services/mockParser';
import { getDb, SMART_REVISION_PATH_PREFIX } from '@/services/attemptStore';

/** Roughly TCS pacing: ~72 seconds per question. */
const MINUTES_PER_QUESTION = 1.2;

export const REVISION_ALL_PATH = `${SMART_REVISION_PATH_PREFIX}all`;

export function isRevisionPath(path: string | null | undefined): boolean {
  return !!path && path.startsWith(SMART_REVISION_PATH_PREFIX);
}

/** Route path for a revision exam. Pass an examPath to scope to that mock. */
export function revisionPathFor(examPath?: string): string {
  return examPath
    ? `${SMART_REVISION_PATH_PREFIX}exam/${examPath}`
    : REVISION_ALL_PATH;
}

/** Inverse of revisionPathFor. Undefined = all mocks (or not a revision path). */
export function revisionScope(path: string): string | undefined {
  const prefix = `${SMART_REVISION_PATH_PREFIX}exam/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : undefined;
}

export interface WrongQuestionRef {
  examPath: string;
  /** 0-based question index inside the SOURCE mock. */
  idx: number;
}

/** Wrong questions across attempt history. A question stays "wrong" only
    while its LATEST outcome is incorrect — a later correct attempt graduates
    it out of the revision pool. Revision-exam attempts are never sources
    (their indexes don't map back to a real mock). */
export function collectWrongQuestionRefs(scopeExamPath?: string): WrongQuestionRef[] {
  const out: WrongQuestionRef[] = [];
  for (const [path, arr] of Object.entries(getDb().attempts)) {
    if (isRevisionPath(path)) continue;
    if (scopeExamPath && path !== scopeExamPath) continue;
    if (!Array.isArray(arr)) continue;
    // Attempts are chronological — later records overwrite earlier verdicts.
    const latest = new Map<number, PerQuestionRecord>();
    arr.forEach((a) => a.perQuestion?.forEach((r) => latest.set(r.idx, r)));
    latest.forEach((r, idx) => {
      if (r.isIncorrect) out.push({ examPath: path, idx });
    });
  }
  return out.sort((a, b) => a.examPath.localeCompare(b.examPath) || a.idx - b.idx);
}

export function countWrongQuestions(scopeExamPath?: string): number {
  return collectWrongQuestionRefs(scopeExamPath).length;
}

/** Build a runnable exam from the current wrong-question pool. Throws when
    the pool is empty or the source mocks can't be loaded. */
export async function buildRevisionExam(scopeExamPath?: string): Promise<ParsedExam> {
  const refs = collectWrongQuestionRefs(scopeExamPath);
  if (!refs.length) {
    throw new Error('No wrong questions to revise — take a mock first, then your misses will appear here.');
  }

  const byExam = new Map<string, number[]>();
  refs.forEach((r) => {
    const list = byExam.get(r.examPath) || [];
    list.push(r.idx);
    byExam.set(r.examPath, list);
  });

  const questions: Question[] = [];
  const sourceWarnings: string[] = [];
  for (const [examPath, idxs] of byExam) {
    try {
      const parsed = await parseMock(examPath);
      // Preserve source-mock parse warnings so the user sees if revision
      // questions came from a mock with known answer-key issues.
      if (parsed.warnings.length) {
        sourceWarnings.push(
          ...parsed.warnings.map((w) => `[${parsed.meta.name}] ${w}`),
        );
      }
      idxs.forEach((i) => {
        const q = parsed.questions[i];
        if (q) questions.push(q);
      });
    } catch {
      // Source mock moved/deleted — its questions drop out of the pool
      // rather than failing the whole revision exam.
    }
  }
  if (!questions.length) {
    throw new Error('The source mocks for your wrong questions are unavailable right now.');
  }

  const meta: ExamMeta = {
    path: revisionPathFor(scopeExamPath),
    name: scopeExamPath ? 'Smart Revision — This Mock' : 'Smart Revision — All Mocks',
    durationMinutes: Math.max(5, Math.ceil(questions.length * MINUTES_PER_QUESTION)),
    sections: [{ name: 'Revision', start: 0, end: questions.length - 1 }],
  };
  return { meta, questions, warnings: sourceWarnings };
}
