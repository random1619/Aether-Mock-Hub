import { describe, it, expect } from 'vitest';
import {
  detectAndConfigurePattern,
  canAccessSection,
  getSectionGroupIndices,
} from './cglPattern';
import type { ExamMeta, Question } from '@/types';

function makeMockQuestion(section: string): Question {
  return {
    question: 'Sample Question',
    options: ['A', 'B', 'C', 'D'],
    correct_option_id: 0,
    section,
  };
}

describe('cglPattern Service', () => {
  describe('Tier 1 Pattern Detection', () => {
    it('detects SSC CGL Tier 1 mock with 4 sections and assigns 15 mins each', () => {
      const meta: ExamMeta = {
        path: 'providers/Oliveboard/SSC_CGL_Tier1_Mock01.html',
        name: 'SSC CGL Tier 1 Full Mock 01',
        durationMinutes: 60,
        sections: [
          { name: 'General Intelligence and Reasoning', start: 0, end: 24 },
          { name: 'General Awareness', start: 25, end: 49 },
          { name: 'Quantitative Aptitude', start: 50, end: 74 },
          { name: 'English Comprehension', start: 75, end: 99 },
        ],
      };
      const questions: Question[] = [
        ...Array.from({ length: 25 }, () => makeMockQuestion('General Intelligence and Reasoning')),
        ...Array.from({ length: 25 }, () => makeMockQuestion('General Awareness')),
        ...Array.from({ length: 25 }, () => makeMockQuestion('Quantitative Aptitude')),
        ...Array.from({ length: 25 }, () => makeMockQuestion('English Comprehension')),
      ];

      const config = detectAndConfigurePattern(meta, questions);
      expect(config.pattern).toBe('cgl_tier1');
      expect(config.hasSectionalTimer).toBe(true);
      expect(config.sections).toHaveLength(4);
      expect(config.sections[0].durationMinutes).toBe(15);
      expect(config.sections[1].durationMinutes).toBe(15);
      expect(config.sections[2].durationMinutes).toBe(15);
      expect(config.sections[3].durationMinutes).toBe(15);
      expect(config.totalDurationMinutes).toBe(60);
    });
  });

  describe('Tier 2 Pattern Detection', () => {
    it('detects SSC CGL Tier 2 pattern with Math+Reasoning (60m), English+GA (60m), Computer (15m)', () => {
      const meta: ExamMeta = {
        path: 'providers/Mocks360/SSC_CGL_Tier2_Paper1.html',
        name: 'SSC CGL Tier 2 Paper 1 Full Mock',
        durationMinutes: 135,
        sections: [
          { name: 'Mathematical Abilities', start: 0, end: 29 },
          { name: 'Reasoning and General Intelligence', start: 30, end: 59 },
          { name: 'English Language and Comprehension', start: 60, end: 104 },
          { name: 'General Awareness', start: 105, end: 129 },
          { name: 'Computer Knowledge Test', start: 130, end: 149 },
        ],
      };
      const questions: Question[] = [
        ...Array.from({ length: 30 }, () => makeMockQuestion('Mathematical Abilities')),
        ...Array.from({ length: 30 }, () => makeMockQuestion('Reasoning and General Intelligence')),
        ...Array.from({ length: 45 }, () => makeMockQuestion('English Language and Comprehension')),
        ...Array.from({ length: 25 }, () => makeMockQuestion('General Awareness')),
        ...Array.from({ length: 20 }, () => makeMockQuestion('Computer Knowledge Test')),
      ];

      const config = detectAndConfigurePattern(meta, questions);
      expect(config.pattern).toBe('cgl_tier2');
      expect(config.hasSectionalTimer).toBe(true);
      expect(config.sections).toHaveLength(5);
      // Math + Reasoning share group-tier2-sec1 (60 mins)
      expect(config.sections[0].groupId).toBe('group-tier2-sec1');
      expect(config.sections[1].groupId).toBe('group-tier2-sec1');
      expect(config.sections[0].durationMinutes).toBe(60);

      // English + GA share group-tier2-sec2 (60 mins)
      expect(config.sections[2].groupId).toBe('group-tier2-sec2');
      expect(config.sections[3].groupId).toBe('group-tier2-sec2');
      expect(config.sections[2].durationMinutes).toBe(60);

      // Computer is group-tier2-sec3 (15 mins)
      expect(config.sections[4].groupId).toBe('group-tier2-sec3');
      expect(config.sections[4].durationMinutes).toBe(15);
      expect(config.totalDurationMinutes).toBe(135);
    });
  });

  describe('Section Lock & Access Rules (canAccessSection)', () => {
    const tier1Sections = [
      { name: 'Reasoning', start: 0, end: 24, durationMinutes: 15, groupId: 'g0' },
      { name: 'GA', start: 25, end: 49, durationMinutes: 15, groupId: 'g1' },
      { name: 'Quant', start: 50, end: 74, durationMinutes: 15, groupId: 'g2' },
      { name: 'English', start: 75, end: 99, durationMinutes: 15, groupId: 'g3' },
    ];

    it('allows access to active section during active exam', () => {
      const locked = new Set<number>();
      expect(canAccessSection(0, 0, locked, true, false, tier1Sections)).toBe(true);
    });

    it('blocks access to future sections during active exam in sectional mode', () => {
      const locked = new Set<number>();
      expect(canAccessSection(1, 0, locked, true, false, tier1Sections)).toBe(false);
      expect(canAccessSection(2, 0, locked, true, false, tier1Sections)).toBe(false);
    });

    it('blocks access to past locked sections during active exam', () => {
      const locked = new Set<number>([0]);
      // Candidate moved to section 1; section 0 is locked
      expect(canAccessSection(0, 1, locked, true, false, tier1Sections)).toBe(false);
      expect(canAccessSection(1, 1, locked, true, false, tier1Sections)).toBe(true);
    });

    it('allows intra-group navigation for Tier 2 modules (e.g. Math <-> Reasoning)', () => {
      const tier2Sections = [
        { name: 'Math', start: 0, end: 29, durationMinutes: 60, groupId: 'sec1' },
        { name: 'Reasoning', start: 30, end: 59, durationMinutes: 60, groupId: 'sec1' },
        { name: 'English', start: 60, end: 104, durationMinutes: 60, groupId: 'sec2' },
        { name: 'GA', start: 105, end: 129, durationMinutes: 60, groupId: 'sec2' },
      ];
      const locked = new Set<number>();
      // Active on Math (0), can switch to Reasoning (1) because same groupId
      expect(canAccessSection(1, 0, locked, true, false, tier2Sections)).toBe(true);
      expect(canAccessSection(0, 1, locked, true, false, tier2Sections)).toBe(true);
      // But cannot access English (2) yet
      expect(canAccessSection(2, 0, locked, true, false, tier2Sections)).toBe(false);
    });

    it('UNLOCKS ALL sections when exam is submitted (isSubmitted === true)', () => {
      const locked = new Set<number>([0, 1, 2]);
      // In submitted phase, all sections return true even if marked locked during active
      expect(canAccessSection(0, 3, locked, true, true, tier1Sections)).toBe(true);
      expect(canAccessSection(1, 3, locked, true, true, tier1Sections)).toBe(true);
      expect(canAccessSection(2, 3, locked, true, true, tier1Sections)).toBe(true);
      expect(canAccessSection(3, 3, locked, true, true, tier1Sections)).toBe(true);
    });
  });

  describe('getSectionGroupIndices', () => {
    it('returns all section indices in the same group', () => {
      const sections = [
        { name: 'Math', start: 0, end: 29, groupId: 'group1' },
        { name: 'Reasoning', start: 30, end: 59, groupId: 'group1' },
        { name: 'English', start: 60, end: 104, groupId: 'group2' },
      ];
      expect(getSectionGroupIndices(0, sections)).toEqual([0, 1]);
      expect(getSectionGroupIndices(1, sections)).toEqual([0, 1]);
      expect(getSectionGroupIndices(2, sections)).toEqual([2]);
    });
  });
});
