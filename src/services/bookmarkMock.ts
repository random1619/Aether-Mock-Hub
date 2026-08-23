/* BOOKMARK MOCK — synthetic exam generator for saved/bookmarked questions.
   Generates a full examination from the user's bookmarked questions with
   variable timing (e.g. 1.2 min/question standard pace, 0.8 min/question rapid pace,
   2.0 min/question deep pace, or custom duration). Runs seamlessly inside the
   TCS exam engine under a bookmark-mock/* pseudo path. */

import type { ExamMeta, Question, SavedQuestionRecord } from '@/types';
import type { ParsedExam } from '@/services/mockParser';
import { getAllSavedQuestions, BOOKMARK_MOCK_PATH_PREFIX } from '@/services/attemptStore';

export const DEFAULT_MINUTES_PER_QUESTION = 1.2;

export interface BookmarkMockConfig {
  scope?: 'all' | 'filtered' | 'subject' | 'provider';
  subject?: string;
  provider?: string;
  /** Specific question IDs (from SavedQuestionRecord.id) if launched from a filtered/selected set */
  questionIds?: string[];
  /** Subset count (e.g. pick top N or random N) */
  questionCount?: number;
  /** Variable timing: minutes per question (e.g. 1.2, 0.8, 2.0) */
  minutesPerQuestion?: number;
  /** Variable timing: explicit custom total duration in minutes */
  customDurationMinutes?: number;
  /** Whether to randomize/shuffle question order */
  shuffle?: boolean;
  /** Whether to group questions into subject-based sections */
  groupBySubject?: boolean;
  /** Custom display title for the mock test */
  title?: string;
}

export function isBookmarkMockPath(path: string | null | undefined): boolean {
  return !!path && path.startsWith(BOOKMARK_MOCK_PATH_PREFIX);
}

/** Encode a BookmarkMockConfig into a URL-safe synthetic exam path. */
export function encodeBookmarkMockPath(config: BookmarkMockConfig): string {
  const json = JSON.stringify(config);
  const b64 = btoa(encodeURIComponent(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${BOOKMARK_MOCK_PATH_PREFIX}cfg:${b64}`;
}

/** Decode a BookmarkMockConfig from a synthetic exam path. */
export function decodeBookmarkMockConfig(path: string): BookmarkMockConfig {
  const prefix = `${BOOKMARK_MOCK_PATH_PREFIX}cfg:`;
  if (path.startsWith(prefix)) {
    try {
      const b64 = path.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64));
      return JSON.parse(json);
    } catch (e) {
      console.warn('[bookmarkMock] failed to decode config from path, falling back to defaults', e);
    }
  }
  return { scope: 'all' };
}

/** Helper to compute variable timing duration in minutes given question count and pacing. */
export function calculateBookmarkMockDuration(
  questionCount: number,
  minutesPerQuestion = DEFAULT_MINUTES_PER_QUESTION,
  customDurationMinutes?: number,
): number {
  if (customDurationMinutes && customDurationMinutes > 0) {
    return Math.max(1, Math.round(customDurationMinutes));
  }
  if (questionCount <= 0) return 5;
  return Math.max(1, Math.ceil(questionCount * minutesPerQuestion));
}

/** Build a runnable exam from the bookmarked questions according to the config. */
export async function buildBookmarkMockExam(
  pathOrConfig: string | BookmarkMockConfig,
): Promise<ParsedExam> {
  const config: BookmarkMockConfig =
    typeof pathOrConfig === 'string' ? decodeBookmarkMockConfig(pathOrConfig) : pathOrConfig;

  const allSaved = getAllSavedQuestions();
  if (!allSaved.length) {
    throw new Error('No bookmarked questions available — bookmark questions during any exam to practice them here.');
  }

  // Filter pool according to config
  let pool: SavedQuestionRecord[] = [...allSaved];

  if (config.questionIds && config.questionIds.length > 0) {
    const idSet = new Set(config.questionIds);
    pool = pool.filter((item) => idSet.has(item.id));
  } else if (config.scope === 'subject' && config.subject) {
    pool = pool.filter((item) => (item as any).subject === config.subject || item.examName.toLowerCase().includes(config.subject!.toLowerCase()));
  } else if (config.scope === 'provider' && config.provider) {
    pool = pool.filter((item) => item.provider === config.provider);
  }

  if (!pool.length) {
    throw new Error('No bookmarked questions matched the chosen filter.');
  }

  // Shuffle if requested
  if (config.shuffle) {
    pool = [...pool].sort(() => Math.random() - 0.5);
  }

  // Subset count
  if (config.questionCount && config.questionCount > 0 && config.questionCount < pool.length) {
    pool = pool.slice(0, config.questionCount);
  }

  // Convert SavedQuestionRecord to Question objects
  const questions: Question[] = pool.map((item) => ({
    question: item.question,
    comp: item.comp,
    options: [...item.options],
    correct_option_id: item.correct_option_id,
    solution: item.solution,
    marks: item.marks ?? 2,
    section: (item as any).subject || item.provider || 'Bookmarks',
    series_name: item.examName,
  }));

  // Calculate variable timing
  const durationMinutes = calculateBookmarkMockDuration(
    questions.length,
    config.minutesPerQuestion ?? DEFAULT_MINUTES_PER_QUESTION,
    config.customDurationMinutes,
  );

  // Group into sections if requested and multi-subject
  let sections: Array<{ name: string; start: number; end: number; durationMinutes: number }> = [
    { name: 'Bookmarks Practice', start: 0, end: questions.length - 1, durationMinutes },
  ];
  if (config.groupBySubject) {
    const subjectMap = new Map<string, Question[]>();
    pool.forEach((item, idx) => {
      const subj = (item as any).subject || item.provider || 'General';
      const list = subjectMap.get(subj) || [];
      list.push(questions[idx]);
      subjectMap.set(subj, list);
    });

    if (subjectMap.size > 1) {
      const reorderedQuestions: Question[] = [];
      const derivedSections: Array<{ name: string; start: number; end: number; durationMinutes: number }> = [];
      let cursor = 0;

      subjectMap.forEach((qList, subj) => {
        const start = cursor;
        const end = start + qList.length - 1;
        const secDuration = Math.max(1, Math.round((qList.length / questions.length) * durationMinutes));
        derivedSections.push({
          name: subj,
          start,
          end,
          durationMinutes: secDuration,
        });
        reorderedQuestions.push(...qList);
        cursor = end + 1;
      });

      questions.length = 0;
      questions.push(...reorderedQuestions);
      sections = derivedSections;
    }
  }

  const finalConfig: BookmarkMockConfig = {
    ...config,
    questionIds: config.questionIds || pool.map((item) => item.id),
  };

  const generatedPath =
    typeof pathOrConfig === 'string'
      ? pathOrConfig
      : encodeBookmarkMockPath(finalConfig);

  const examTitle =
    config.title ||
    `Bookmark Mock (${questions.length} Question${questions.length === 1 ? '' : 's'})`;

  const meta: ExamMeta = {
    path: generatedPath,
    name: examTitle,
    provider: config.provider || 'Bookmarks',
    subject: config.subject || 'Saved Questions',
    durationMinutes,
    sections,
    hasSectionalTimer: false,
  };

  return { meta, questions, warnings: [] };
}
