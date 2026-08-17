import type { QuestionWorkflow } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  QUESTION_TRANSITIONS,
  canTransitionQuestion,
  isQuestionMoveAllowed,
  isQuestionRepublication,
} from '@/services/questions/question-publish.service';

/**
 * The review workflow as a table, asserted pair by pair.
 *
 * The matrix is exhaustive on purpose. A transition table is the kind of thing
 * that acquires an extra edge during an unrelated change, and an extra edge here
 * means an unreviewed question can reach a student — which is not a defect
 * anybody notices from the outside until it has already happened.
 */
const ALL_STATES: QuestionWorkflow[] = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED'];

describe('question workflow state machine', () => {
  it('walks the forward review path', () => {
    expect(canTransitionQuestion('DRAFT', 'IN_REVIEW')).toBe(true);
    expect(canTransitionQuestion('IN_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionQuestion('APPROVED', 'PUBLISHED')).toBe(true);
    expect(canTransitionQuestion('PUBLISHED', 'RETIRED')).toBe(true);
  });

  it('allows the three backward edges that mean something', () => {
    // A reviewer asking for changes.
    expect(canTransitionQuestion('IN_REVIEW', 'DRAFT')).toBe(true);
    // An approved item that turned out to need more editing; the approval it
    // held no longer describes what the row says.
    expect(canTransitionQuestion('APPROVED', 'DRAFT')).toBe(true);
    // A withdrawn item being rewritten.
    expect(canTransitionQuestion('RETIRED', 'DRAFT')).toBe(true);
  });

  it('never lets a published question become a draft again', () => {
    // A published question is edited in place — the draft and the served
    // snapshot are different things. It leaves service by being retired, and
    // only from there can it return to the editor.
    expect(canTransitionQuestion('PUBLISHED', 'DRAFT')).toBe(false);
    expect(canTransitionQuestion('PUBLISHED', 'IN_REVIEW')).toBe(false);
    expect(canTransitionQuestion('PUBLISHED', 'APPROVED')).toBe(false);
  });

  it('never publishes without passing through approval', () => {
    expect(canTransitionQuestion('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransitionQuestion('IN_REVIEW', 'PUBLISHED')).toBe(false);
    expect(canTransitionQuestion('RETIRED', 'PUBLISHED')).toBe(false);
    expect(QUESTION_TRANSITIONS.APPROVED).toContain('PUBLISHED');
  });

  it('never retires anything that was not published', () => {
    for (const from of ALL_STATES) {
      expect(canTransitionQuestion(from, 'RETIRED')).toBe(from === 'PUBLISHED');
    }
  });

  it('lets a retired question return only to the editor', () => {
    expect(QUESTION_TRANSITIONS.RETIRED).toEqual(['DRAFT']);
  });

  it('does not report a state as a transition into itself', () => {
    for (const state of ALL_STATES) {
      expect(canTransitionQuestion(state, state)).toBe(false);
    }
  });

  it('rejects every pair the table does not list', () => {
    for (const from of ALL_STATES) {
      const allowed = new Set<QuestionWorkflow>(QUESTION_TRANSITIONS[from]);
      for (const to of ALL_STATES) {
        expect(canTransitionQuestion(from, to)).toBe(allowed.has(to));
      }
    }
  });
});

describe('re-publication', () => {
  it('is the only self-move the service accepts', () => {
    expect(isQuestionRepublication('PUBLISHED', 'PUBLISHED')).toBe(true);

    for (const state of ALL_STATES) {
      if (state === 'PUBLISHED') continue;
      expect(isQuestionRepublication(state, state)).toBe(false);
    }
  });

  it('is not a transition, so the table stays a description of the review path', () => {
    expect(canTransitionQuestion('PUBLISHED', 'PUBLISHED')).toBe(false);
    expect(QUESTION_TRANSITIONS.PUBLISHED).not.toContain('PUBLISHED');
  });

  it('is exactly what the accepted-move set adds to the table', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        expect(isQuestionMoveAllowed(from, to)).toBe(
          canTransitionQuestion(from, to) || (from === 'PUBLISHED' && to === 'PUBLISHED'),
        );
      }
    }
  });
});

describe('the table itself', () => {
  it('names every workflow state exactly once', () => {
    expect(Object.keys(QUESTION_TRANSITIONS).sort()).toEqual([...ALL_STATES].sort());
  });

  it('lists no target twice and no unknown target', () => {
    for (const from of ALL_STATES) {
      const targets = QUESTION_TRANSITIONS[from] as readonly QuestionWorkflow[];
      expect(new Set(targets).size).toBe(targets.length);
      for (const target of targets) expect(ALL_STATES).toContain(target);
    }
  });
});
