/* CGL PATTERN & SECTION TIMING SERVICE
   Defines SSC CGL Tier 1 & Tier 2 exam specifications, sectional durations,
   module groupings, and section lock rules. */

import type { ExamMeta, ExamPattern, ExamSection, Question } from '@/types';

export interface PatternConfig {
  pattern: ExamPattern;
  sections: ExamSection[];
  totalDurationMinutes: number;
  hasSectionalTimer: boolean;
  description: string;
}

/** Normalized keywords for section recognition */
const REASONING_KEYWORDS = ['reasoning', 'intelligence', 'gi', 'general intelligence'];
const GA_KEYWORDS = ['general awareness', 'general knowledge', 'gk', 'ga', 'current affairs', 'general science'];
const MATH_KEYWORDS = ['quantitative', 'quant', 'math', 'mathematics', 'numerical', 'maths'];
const ENGLISH_KEYWORDS = ['english', 'comprehension', 'verbal', 'english language'];
const COMPUTER_KEYWORDS = ['computer', 'cpt', 'computer knowledge', 'computer proficiency'];

function matchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Detects exam pattern (SSC CGL Tier 1, CGL Tier 2, or generic sectional)
 * and configures accurate sectional durations and module groupings.
 */
export function detectAndConfigurePattern(
  meta: ExamMeta,
  questions: Question[],
): PatternConfig {
  const pathAndTitle = `${meta.path} ${meta.name}`.toLowerCase();
  const rawSections = meta.sections.length > 0 ? meta.sections : [{ name: 'General', start: 0, end: questions.length - 1 }];
  const secCount = rawSections.length;
  const qCount = questions.length;

  // ── 1. SSC CGL Tier 2 Pattern Detection ──
  const isTier2Explicit =
    /\b(tier\s*[-_]?\s*2|tier\s*[-_]?\s*ii|mains|paper\s*[-_]?\s*1|session\s*[-_]?\s*1)\b/i.test(pathAndTitle);
  const hasComputerSec = rawSections.some((s) => matchesAny(s.name, COMPUTER_KEYWORDS));
  const isTier2Questions = qCount >= 120 && secCount >= 3;

  if (isTier2Explicit || hasComputerSec || (isTier2Questions && secCount >= 4)) {
    return configureTier2Pattern(rawSections, meta);
  }

  // ── 2. SSC CGL Tier 1 Pattern Detection ──
  // Tier 1 standard: 4 sections (Reasoning, GA, Quant, English), 25 questions each, 15 min each = 60 mins.
  const isTier1Explicit =
    /\b(tier\s*[-_]?\s*1|tier\s*[-_]?\s*i|pre|prelims|cgl|ssc)\b/i.test(pathAndTitle);
  const isFourStandardSections =
    secCount === 4 ||
    (rawSections.some((s) => matchesAny(s.name, REASONING_KEYWORDS)) &&
      rawSections.some((s) => matchesAny(s.name, MATH_KEYWORDS)));

  if ((isTier1Explicit && secCount >= 2) || (secCount === 4 && qCount >= 80 && qCount <= 110) || isFourStandardSections) {
    return configureTier1Pattern(rawSections, meta);
  }

  // ── 3. Generic Sectional Mock (multi-section) ──
  if (secCount > 1) {
    return configureGenericSectionalPattern(rawSections, meta);
  }

  // ── 4. Standard Single-Section Mock ──
  // SSC precise: 25Q → 15 mins (Tier 1 sectional), 30Q → 18 mins, etc. 0.6 min per Q, floored to 15 min blocks
  const qDur = qCount === 25 ? 15 : qCount <= 30 ? 15 : qCount <= 50 ? 30 : 60;
  const dur = meta.durationMinutes > 0 ? meta.durationMinutes : qDur;
  // Single-section with 25Q is still a timed sectional mini-mock (15 min)
  const isSingle25 = qCount === 25 && secCount === 1;
  return {
    pattern: 'standard',
    sections: rawSections.map((s) => ({
      ...s,
      durationMinutes: dur,
      groupId: 'sec-0',
      groupName: s.name,
    })),
    totalDurationMinutes: dur,
    hasSectionalTimer: isSingle25 ? true : false,
    description: isSingle25 ? `SSC Sectional — 25 Questions (15 mins)` : `Standard Mock Test (${dur} mins)`,
  };
}

/**
 * Configure SSC CGL Tier 1 Pattern:
 * 4 sections, 15 minutes each (Total 60 minutes).
 * Each section has a dedicated 15-minute countdown and is locked once completed.
 */
function configureTier1Pattern(sections: ExamSection[], meta: ExamMeta): PatternConfig {
  const sectionDuration = 15; // 15 mins per section
  const enrichedSections: ExamSection[] = sections.map((s, idx) => ({
    ...s,
    durationMinutes: sectionDuration,
    groupId: `group-tier1-${idx}`,
    groupName: `Section ${idx + 1}: ${s.name} (15 mins)`,
  }));

  const totalDuration = sectionDuration * sections.length;

  return {
    pattern: 'cgl_tier1',
    sections: enrichedSections,
    totalDurationMinutes: totalDuration > 0 ? totalDuration : (meta.durationMinutes || 60),
    hasSectionalTimer: true,
    description: `SSC CGL Tier 1 Pattern — ${sections.length} Sections (15 mins each, Sectional Locks)`,
  };
}

/**
 * Configure SSC CGL Tier 2 Pattern:
 * Session I (2 Hours 15 Minutes = 135 mins):
 * - Section I (60 mins): Math + Reasoning (freely switchable within Section I)
 * - Section II (60 mins): English + General Awareness (freely switchable within Section II)
 * - Section III (15 mins): Computer Knowledge Test (15 mins)
 */
function configureTier2Pattern(sections: ExamSection[], meta: ExamMeta): PatternConfig {
  const enriched: ExamSection[] = sections.map((s, idx) => {
    if (matchesAny(s.name, COMPUTER_KEYWORDS)) {
      return {
        ...s,
        durationMinutes: 15,
        groupId: 'group-tier2-sec3',
        groupName: 'Section III: Computer Knowledge (15 mins)',
      };
    }
    if (matchesAny(s.name, ENGLISH_KEYWORDS) || matchesAny(s.name, GA_KEYWORDS)) {
      return {
        ...s,
        durationMinutes: 60,
        groupId: 'group-tier2-sec2',
        groupName: 'Section II: English Language & GA (60 mins)',
      };
    }
    if (matchesAny(s.name, MATH_KEYWORDS) || matchesAny(s.name, REASONING_KEYWORDS)) {
      return {
        ...s,
        durationMinutes: 60,
        groupId: 'group-tier2-sec1',
        groupName: 'Section I: Mathematical Abilities & Reasoning (60 mins)',
      };
    }

    // Fallback assignment by index position
    if (idx < 2) {
      return {
        ...s,
        durationMinutes: 60,
        groupId: 'group-tier2-sec1',
        groupName: 'Section I (60 mins)',
      };
    } else if (idx < 4) {
      return {
        ...s,
        durationMinutes: 60,
        groupId: 'group-tier2-sec2',
        groupName: 'Section II (60 mins)',
      };
    } else {
      return {
        ...s,
        durationMinutes: 15,
        groupId: 'group-tier2-sec3',
        groupName: 'Section III (15 mins)',
      };
    }
  });

  // Calculate distinct group durations
  const seenGroups = new Set<string>();
  let totalMinutes = 0;
  for (const s of enriched) {
    const gid = s.groupId || s.name;
    if (!seenGroups.has(gid)) {
      seenGroups.add(gid);
      totalMinutes += s.durationMinutes || 60;
    }
  }

  return {
    pattern: 'cgl_tier2',
    sections: enriched,
    totalDurationMinutes: totalMinutes > 0 ? totalMinutes : (meta.durationMinutes || 135),
    hasSectionalTimer: true,
    description: 'SSC CGL Tier 2 Pattern — Section I (60m) + Section II (60m) + Section III (15m)',
  };
}

/**
 * Generic multi-section configuration: divides duration or gives 15 mins per section.
 */
function configureGenericSectionalPattern(sections: ExamSection[], meta: ExamMeta): PatternConfig {
  const hasExplicit = sections.some((s) => typeof s.durationMinutes === 'number' && s.durationMinutes > 0);
  const defaultTotal = meta.durationMinutes > 0 ? meta.durationMinutes : sections.length * 15;
  const defaultPerSec = Math.max(1, Math.round(defaultTotal / sections.length));

  const enriched: ExamSection[] = sections.map((s, idx) => {
    const secDur = typeof s.durationMinutes === 'number' && s.durationMinutes > 0 ? s.durationMinutes : defaultPerSec;
    return {
      ...s,
      durationMinutes: secDur,
      groupId: s.groupId || `group-sec-${idx}`,
      groupName: s.groupName || `Section ${idx + 1}: ${s.name} (${secDur} mins)`,
    };
  });

  const total = hasExplicit
    ? enriched.reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
    : defaultTotal;

  return {
    pattern: 'sectional',
    sections: enriched,
    totalDurationMinutes: total,
    hasSectionalTimer: true,
    description: `Sectional Timed Exam — ${sections.length} Sections`,
  };
}

/**
 * Check if a section is accessible given the current exam state:
 * - If `isSubmitted`: ALL sections are accessible (unlocked).
 * - If `!hasSectionalTimer`: ALL sections are accessible (composite mode).
 * - If `lockedSections.has(targetSecIdx)`: LOCKED (already submitted/expired).
 * - If `targetSecIdx === currentSecIdx`: ACCESSIBLE.
 * - If target and current share the same `groupId`: ACCESSIBLE (e.g. CGL Tier 2 intra-group).
 * - If target is a future section not yet reached: LOCKED.
 */
export function canAccessSection(
  targetSecIdx: number,
  currentSecIdx: number,
  lockedSections: Set<number>,
  hasSectionalTimer: boolean,
  isSubmitted: boolean,
  sections: ExamSection[],
): boolean {
  // Rule: When submitted, ALL sections unlock!
  if (isSubmitted) return true;
  // Rule: In non-sectional/composite mode, everything is open
  if (!hasSectionalTimer) return true;
  // Rule: Any section explicitly locked cannot be visited
  if (lockedSections.has(targetSecIdx)) return false;
  // Rule: Current active section is accessible
  if (targetSecIdx === currentSecIdx) return true;

  const currentSec = sections[currentSecIdx];
  const targetSec = sections[targetSecIdx];
  if (!currentSec || !targetSec) return false;

  // Rule: Modules in the same group (e.g. Tier 2 Math & Reasoning) can be switched between
  if (currentSec.groupId && targetSec.groupId && currentSec.groupId === targetSec.groupId) {
    return true;
  }

  // Future or other sections are locked until current section/group is submitted
  return false;
}

/**
 * Get the next section index that belongs to a NEW section group / session
 * (or simply the next section).
 */
export function getNextSectionIndex(currentSecIdx: number, sections: ExamSection[]): number | null {
  if (currentSecIdx + 1 < sections.length) {
    return currentSecIdx + 1;
  }
  return null;
}

/**
 * Returns all section indices belonging to the same section group.
 */
export function getSectionGroupIndices(secIdx: number, sections: ExamSection[]): number[] {
  const target = sections[secIdx];
  if (!target) return [secIdx];
  if (!target.groupId) return [secIdx];

  const indices: number[] = [];
  sections.forEach((s, i) => {
    if (s.groupId === target.groupId) indices.push(i);
  });
  return indices;
}

/** Returns the question-index bounds for a section group (min start → max end). */
export function getGroupBounds(secIdx: number, sections: ExamSection[]): { start: number; end: number } {
  const indices = getSectionGroupIndices(secIdx, sections);
  let start = Infinity;
  let end = -Infinity;
  for (const i of indices) {
    const s = sections[i];
    if (s.start < start) start = s.start;
    if (s.end > end) end = s.end;
  }
  return { start, end };
}
