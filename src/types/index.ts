/* AETHER v2 — SHARED TYPES
   The contract between legacy mock data, the parser, the exam
   engine, and persistence. Mirrors the aether-db (v2) schema so
   existing user progress stays compatible. */

/** A single exam question (normalized across all providers). */
export interface Question {
  /** Rich (sanitized) HTML for the question stem; may contain eqt/hqt bilingual spans + KaTeX. */
  question: string;
  /** Optional comprehension/passage HTML shown above the question. */
  comp?: string;
  /** Array of option HTML strings. */
  options: string[];
  /** Index into options[] of the correct answer. */
  correct_option_id: number;
  /** Rich HTML solution/explanation. */
  solution?: string;
  /** Marks awarded for a correct answer (default 2). */
  marks?: number;
  /** Section name this question belongs to (drives sectional mode). */
  section?: string;
  /** Optional series/origin label. */
  series_name?: string;
}

export type ExamPattern = 'cgl_tier1' | 'cgl_tier2' | 'sectional' | 'standard';

/** Metadata describing a whole exam. */
export interface ExamMeta {
  /** Canonical path key (relative, matches mocks-data + attempt keys). */
  path: string;
  /** Display title. */
  name: string;
  provider?: string;
  subject?: string;
  category?: string;
  /** Total duration in minutes (from <meta name="exam-duration">, default 60). */
  durationMinutes: number;
  /** Derived ordered sections (grouped by question.section, in first-seen order). */
  sections: ExamSection[];
  /** Detected or explicit exam pattern (e.g. CGL Tier 2, CGL Tier 1, Sectional). */
  pattern?: ExamPattern;
  /** Whether sectional timing and section locks should be enabled by default. */
  hasSectionalTimer?: boolean;
}

export interface ExamSection {
  name: string;
  /** First question index (inclusive). */
  start: number;
  /** Last question index (inclusive). */
  end: number;
  /** Duration in minutes for this specific section (when sectional timing applies). */
  durationMinutes?: number;
  /** Section Group ID for multi-module sections (e.g. CGL Tier 2 Session 1 groups). */
  groupId?: string;
  /** Display label for the section group (e.g. 'Section I (Math & Reasoning)'). */
  groupName?: string;
}

/** An entry in the browsable mock catalog (from mocks-data.js). */
export interface MockEntry {
  path: string;
  name: string;
  provider: string;
  category: string;
  subject: string;
  topic?: string;
  subtopic?: string;
  organizedPath?: string;
  totalQuestions?: number;
  format?: string;
  // Organized hierarchy (new precise classification)
  hierarchy?: string; // e.g. "English/Vocabulary/Synonyms - A"
}

/* Persistence (aether-db v2) */
export interface SectionSnapshot {
  name: string;
  start: number;
  end: number;
}

export interface Attempt {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /** 0–100 integer. */
  accuracy: number;
  sections: SectionSnapshot[];
  /** Seconds spent per question index. */
  questionTimes?: Record<number, number>;
  submittedAt: string; // ISO
  attemptNumber: number;
  /** How many times the user exited fullscreen during the test (violation count). */
  fsExits?: number;
  /** How many times the tab/window lost focus during the test (violation count). */
  tabSwitches?: number;
  /** True when the system wall clock jumped mid-exam (possible timer tampering). */
  clockTampered?: boolean;
  /** True when answer options were shuffled for this attempt. */
  optionsShuffled?: boolean;
  /** Self-integrity hash of the score fields (detects localStorage score edits). */
  integrity?: string;
  /** Per-question snapshot for analytics + "review this attempt again". */
  perQuestion?: PerQuestionRecord[];
  /** Friendly provider display name (e.g. "Oliveboard", "360 Mocks"). */
  provider?: string;
}

export interface PerQuestionRecord {
  idx: number;
  /** What the user actually picked (undefined = unanswered). */
  chosen?: number;
  correctOption: number;
  /** True when user picked the right answer. */
  isCorrect: boolean;
  /** True when user picked the wrong answer. */
  isIncorrect: boolean;
  /** True when user left it blank. */
  isSkipped: boolean;
  /** True when the user flagged for review during the active phase. */
  flagged: boolean;
  /** Seconds spent on this question, across all visits. */
  timeSec: number;
}

export interface BookmarkFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  isSystem?: boolean;
}

export interface SavedQuestionRecord {
  id: string;                // unique stable id
  examPath: string;          // canonical path of the source exam
  examName: string;          // denormalised display title
  provider?: string;
  questionIdx: number;       // 0-based index inside the exam
  savedAt: string;           // ISO
  /** Snapshot of the question itself — so the saved item stands alone. */
  question: string;
  comp?: string;
  options: string[];
  correct_option_id: number;
  solution?: string;
  marks?: number;
  /** Latest interaction snapshot (last attempt that touched this question). */
  lastChosen?: number;
  lastOutcome?: 'correct' | 'incorrect' | 'skipped';
  lastFlagged?: boolean;
  /** Number of times this question has been revisited in saved view. */
  timesReviewed?: number;
  /** Category / Folder association */
  folderId?: string;
  folderIds?: string[];
  /** Custom tag labels (e.g. ['#geometry', '#tricky']) */
  tags?: string[];
  /** Personal study notes / tips on this question */
  notes?: string;
  /** Priority rating */
  priority?: 'high' | 'medium' | 'low';
  /** Fast star bookmark */
  isStarred?: boolean;
}

export interface AetherDB {
  version: number;
  settings: {
    theme: 'dark' | 'light' | 'netflix' | 'onepiece';
    sectionalTimer?: string;
    portalTheme?: string;
    /** Study planner: questions to answer per day to keep the streak alive. */
    dailyGoalQuestions?: number;
  };
  attempts: Record<string, Attempt[]>;
  completed: Record<string, boolean>;
  /** Catalog paths saved to this profile's My List. */
  myList: string[];
  savedQuestions: Record<string, SavedQuestionRecord[]>;
  bookmarkFolders?: BookmarkFolder[];
  stats: Stats;
}

export interface ProviderStats {
  attempted: number;
  totalAcc: number;
  avgAccuracy: number;
}

export interface Stats {
  totalAttempted: number;
  avgAccuracy: number;
  bestScore: { path: string; score: number; maxScore: number; accuracy: number } | null;
  streakDays: number;
  lastActiveDate: string | null;
  byProvider: Record<string, ProviderStats>;
  bySubject: Record<string, ProviderStats>;
}

/* Exam runtime state */
export type ExamPhase = 'welcome' | 'active' | 'submitted';

/** Language view for bilingual (code-mixed) content.
   'en' shows only English, 'hi' shows only Hindi — both necessarily drop the
   opposite script. 'both' renders the source verbatim so NO word is ever lost;
   it is the default because the majority of mocks are code-mixed (an English
   grammar solution quotes the English word inside a Hindi explanation, and a
   Hindi question embeds Latin math/variables), so filtering to a single script
   always deletes legitimate content. */
export type LangView = 'en' | 'hi' | 'both';
