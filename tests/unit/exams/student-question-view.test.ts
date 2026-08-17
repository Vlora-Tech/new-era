import { describe, expect, it } from 'vitest';

import {
  STUDENT_QUESTION_SELECT,
  toStudentQuestionView,
  type StudentQuestionRow,
} from '@/services/exams/attempt-snapshot.service';

/**
 * The non-disclosure boundary, asserted at its narrowest point.
 *
 * Two independent guarantees are checked here:
 *
 *   1. `STUDENT_QUESTION_SELECT` does not ask PostgreSQL for the answer key or
 *      the explanation. That is the guarantee that survives a careless edit to
 *      the view function, because the data is never fetched in the first place.
 *   2. `toStudentQuestionView` emits only the fields it declares, even when it
 *      is handed a row that carries extra properties.
 */
const CORRECT_KEY = 'option-b';
const EXPLANATION_TEXT = 'لأن الإجابة الصحيحة هي الخيار الثاني';
const HINT_TEXT = 'فكّر في العامل المشترك';

function row(overrides: Partial<StudentQuestionRow> = {}): StudentQuestionRow {
  return {
    id: 'attempt-question-1',
    position: 1,
    domain: 'ARITHMETIC',
    subskill: 'الكسور',
    difficulty: 'MEDIUM',
    contentSnapshot: {
      stem: { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'نص السؤال' }] }] },
      options: [
        { key: 'option-a', content: { blocks: [] } },
        { key: CORRECT_KEY, content: { blocks: [] } },
      ],
      stimulus: null,
      estimatedSeconds: 60,
    },
    hintSnapshot: {
      blocks: [{ type: 'paragraph', children: [{ type: 'text', text: HINT_TEXT }] }],
    },
    answer: null,
    ...overrides,
  } as StudentQuestionRow;
}

describe('STUDENT_QUESTION_SELECT', () => {
  it('never asks the database for the answer key or the explanation', () => {
    const fields = Object.keys(STUDENT_QUESTION_SELECT);
    expect(fields).not.toContain('correctOptionKey');
    expect(fields).not.toContain('explanationSnapshot');
  });

  it('does not read correctness from the answer row either', () => {
    const answerFields = Object.keys(STUDENT_QUESTION_SELECT.answer.select);
    expect(answerFields).not.toContain('isCorrect');
  });
});

describe('toStudentQuestionView', () => {
  it('emits no field that could identify the correct option', () => {
    const view = toStudentQuestionView(row(), { includeHint: false });
    const serialised = JSON.stringify(view);

    expect(serialised).not.toContain('correctOptionKey');
    expect(serialised).not.toContain('explanation');
    expect(serialised).not.toContain('isCorrect');
    expect(serialised).not.toContain(EXPLANATION_TEXT);
    // The option keys themselves must still be present — the student has to be
    // able to choose one — so the absence being asserted is of the *marker*,
    // not of the key.
    expect(serialised).toContain(CORRECT_KEY);
  });

  it('withholds the hint unless the attempt policy allows it', () => {
    const withoutHint = toStudentQuestionView(row(), { includeHint: false });
    expect(withoutHint.hint).toBeNull();
    expect(JSON.stringify(withoutHint)).not.toContain(HINT_TEXT);

    const withHint = toStudentQuestionView(row(), { includeHint: true });
    expect(JSON.stringify(withHint)).toContain(HINT_TEXT);
  });

  it('drops properties that were not asked for, even when the row carries them', () => {
    const contaminated = row({
      // A future select, or a hand-written query, could hand this function more
      // than it should have. Building the result field by field is what stops
      // that becoming a leak.
      ...({
        correctOptionKey: CORRECT_KEY,
        explanationSnapshot: { text: EXPLANATION_TEXT },
      } as Partial<StudentQuestionRow>),
    });

    const view = toStudentQuestionView(contaminated, { includeHint: false });
    expect(Object.keys(view).sort()).toEqual(
      ['answer', 'content', 'difficulty', 'domain', 'hint', 'id', 'position', 'subskill'].sort(),
    );
    expect(JSON.stringify(view)).not.toContain(EXPLANATION_TEXT);
  });

  it('reports an unanswered question as an empty answer rather than omitting it', () => {
    const view = toStudentQuestionView(row(), { includeHint: false });
    expect(view.answer).toEqual({
      selectedOptionKey: null,
      flagged: false,
      saveVersion: 0,
      savedAt: null,
    });
  });
});
