/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuestionForm } from '@/components/admin/question-form';

/**
 * What the question editor writes now that it no longer asks for a
 * classification.
 *
 * The section is commented out, not deleted, and the columns behind it are still
 * `NOT NULL` — so the interesting question is not what the screen shows but what
 * the form posts. Two answers, and the first is the one worth a test: a question
 * that already carries a real classification must keep it. React Hook Form
 * submits its value tree rather than only the fields that rendered, which is why
 * that works; if a future upgrade changes that, an editor opening a seeded
 * question and pressing save would silently reclassify it, and nothing else in
 * the suite would notice.
 *
 * Deleting this file is the right move when the classification section comes
 * back — at that point the fields are on screen and answer for themselves.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({ ok: true, data: { id: 'q1' } }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function postedBody(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0]!;
  return JSON.parse((init as { body: string }).body) as Record<string, unknown>;
}

describe('the question editor with its classification section hidden', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the classification a question was opened with', async () => {
    const fetchMock = stubFetch();

    render(
      <QuestionForm
        mode="edit"
        questionId="q1"
        stimuli={[]}
        initial={{
          stem: 'نص سؤال مصنَّف من قبل',
          options: [
            { content: 'خيار أول', isCorrect: true },
            { content: 'خيار ثانٍ', isCorrect: false },
          ],
          domain: 'GEOMETRY',
          difficulty: 'HARD',
          track: 'SCIENTIFIC',
          subskill: 'مساحات',
          explanation: null,
          hint: null,
          tags: ['قديم'],
          estimatedSeconds: 90,
          shuffleOptions: true,
          stimulusId: null,
          authorOrLicensor: 'المنصة',
          provenanceNote: null,
          rightsDeclaration: 'ORIGINAL',
        }}
      />,
    );

    // The controls are off the screen…
    expect(screen.queryByLabelText(/مستوى الصعوبة/)).toBeNull();
    expect(screen.queryByLabelText(/المسار/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /حفظ/ }));

    // …and every value they used to hold is still what gets written.
    expect(postedBody(fetchMock)).toMatchObject({
      domain: 'GEOMETRY',
      difficulty: 'HARD',
      track: 'SCIENTIFIC',
      subskill: 'مساحات',
      tags: ['قديم'],
      estimatedSeconds: 90,
    });
  });

  it('writes the placeholder classification for a new question', async () => {
    const fetchMock = stubFetch();

    render(<QuestionForm mode="create" stimuli={[]} />);

    await userEvent.type(screen.getByLabelText(/نص السؤال/), 'كم يساوي اثنان زائد اثنين؟');
    await userEvent.type(screen.getByLabelText('الخيار 1'), 'أربعة');
    await userEvent.type(screen.getByLabelText('الخيار 2'), 'خمسة');
    await userEvent.type(screen.getByLabelText(/الجهة المرخِّصة/), 'المنصة');
    await userEvent.selectOptions(screen.getByLabelText(/إقرار الحقوق/), 'ORIGINAL');

    await userEvent.click(screen.getByRole('button', { name: /حفظ/ }));

    // `HIDDEN_CLASSIFICATION_DEFAULTS` — a value the `NOT NULL` columns need, not
    // a claim about the question.
    expect(postedBody(fetchMock)).toMatchObject({
      domain: 'VERBAL_ANALOGY',
      difficulty: 'MEDIUM',
      track: 'BOTH',
    });
  });
});
