import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The question bank endpoints, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. The origin check, the Zod schemas, the
 * services, the transactions and the database are all real, because the
 * properties under test are properties of the whole pipeline: "an edit cannot
 * publish", "a published snapshot does not move when the question is edited",
 * "a served question is never deleted". Asserting those against a mocked service
 * would assert nothing.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: 'question-admin@example.test',
    name: 'مدير الأسئلة',
    role: 'ADMIN' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => session.user,
    requireAdmin: async () => session.user,
  };
});

import { prisma } from '@/lib/db';
import { prepareAttemptQuestions } from '@/services/exams/attempt-snapshot.service';
import type {
  QuestionDetail,
  QuestionListResult,
} from '@/services/questions/question-admin.service';

const ORIGIN = 'http://localhost:3000';

/** Scopes every row this file creates, so parallel workers never collide. */
const RUN = randomUUID().slice(0, 8);
const MARKER = `بنك-اختبار-${RUN}`;

const createdQuestionIds: string[] = [];

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string> };
};

function mutation(path: string, body?: unknown, method = 'POST', origin = ORIGIN) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function read(path: string) {
  return new Request(`${ORIGIN}${path}`, { headers: { Accept: 'application/json' } });
}

async function envelope<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    stem: `نص السؤال ${MARKER}`,
    options: [
      { content: 'الخيار الصحيح', isCorrect: true },
      { content: 'خيار مشتت أول', isCorrect: false },
      { content: 'خيار مشتت ثانٍ', isCorrect: false },
    ],
    domain: 'ARITHMETIC',
    difficulty: 'MEDIUM',
    track: 'BOTH',
    subskill: MARKER,
    explanation: 'شرح الوصول إلى الإجابة.',
    hint: null,
    tags: [MARKER],
    estimatedSeconds: 60,
    shuffleOptions: true,
    stimulusId: null,
    authorOrLicensor: 'نيو إيرا',
    provenanceNote: 'محتوى تجريبي من إعداد المنصة.',
    rightsDeclaration: 'ORIGINAL',
    ...overrides,
  };
}

/** POST a question and remember it for teardown. */
async function createQuestion(overrides: Record<string, unknown> = {}): Promise<string> {
  const { POST } = await import('@/app/api/admin/questions/route');
  const response = await POST(mutation('/api/admin/questions', body(overrides)));
  const result = await envelope<{ id: string }>(response);

  expect(response.status).toBe(201);
  const id = result.data!.id;
  createdQuestionIds.push(id);
  return id;
}

async function move(questionId: string, to: string, note?: string) {
  const { POST } = await import('@/app/api/admin/questions/[questionId]/workflow/route');
  return POST(mutation(`/api/admin/questions/${questionId}/workflow`, { to, note }), {
    params: Promise.resolve({ questionId }),
  });
}

async function detail(questionId: string) {
  const { GET } = await import('@/app/api/admin/questions/[questionId]/route');
  const response = await GET(read(`/api/admin/questions/${questionId}`), {
    params: Promise.resolve({ questionId }),
  });
  return { response, payload: await envelope<QuestionDetail>(response) };
}

/** Take a question all the way to PUBLISHED and report the frozen version. */
async function publish(questionId: string) {
  await move(questionId, 'IN_REVIEW');
  await move(questionId, 'APPROVED', 'المحتوى والتصنيف سليمان.');
  const response = await move(questionId, 'PUBLISHED');
  expect(response.status).toBe(200);
  return envelope<{ currentVersion: number; published: boolean }>(response);
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      email: `question-admin-${randomUUID()}@example.test`,
      name: 'مدير الأسئلة',
      passwordHash: 'not-a-real-hash',
      role: 'ADMIN',
    },
    select: { id: true, email: true },
  });
  session.user = { ...session.user, id: admin.id, email: admin.email };
});

afterAll(async () => {
  // Deepest edge first: a frozen version is `Restrict` against its question, so
  // it has to go before the question can. Nothing here ever reached an attempt.
  await prisma.auditLog.deleteMany({ where: { targetId: { in: createdQuestionIds } } });
  await prisma.questionVersion.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.questionOption.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: session.user.id } });
  await prisma.user.deleteMany({ where: { id: session.user.id } });
});

describe('POST /api/admin/questions', () => {
  it('creates a draft and ignores anything the client says about publication', async () => {
    const id = await createQuestion({
      // None of these exist on `createQuestionSchema`, so they are not refused —
      // they are simply never read. That is the point of stripping by omission.
      workflow: 'PUBLISHED',
      currentVersion: 9,
      publishedAt: new Date().toISOString(),
      reviewedById: session.user.id,
    });

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: {
        workflow: true,
        currentVersion: true,
        publishedAt: true,
        reviewedById: true,
        createdById: true,
        stem: true,
        options: { orderBy: { position: 'asc' }, select: { position: true, isCorrect: true } },
      },
    });

    expect(stored.workflow).toBe('DRAFT');
    expect(stored.currentVersion).toBe(0);
    expect(stored.publishedAt).toBeNull();
    expect(stored.reviewedById).toBeNull();
    // The author comes from the session, never from the body.
    expect(stored.createdById).toBe(session.user.id);

    // Positions are the array index, assigned server-side.
    expect(stored.options.map((option) => option.position)).toEqual([1, 2, 3]);
    expect(stored.options.filter((option) => option.isCorrect)).toHaveLength(1);

    // Plain Arabic in, a structured document out — matching `lib/exam/content`.
    expect(stored.stem).toMatchObject({
      blocks: [{ type: 'paragraph', children: [{ type: 'text', text: `نص السؤال ${MARKER}` }] }],
    });
  });

  it('splits a blank line into two paragraphs', async () => {
    const id = await createQuestion({ stem: 'الفقرة الأولى.\n\nالفقرة الثانية.' });
    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { stem: true },
    });

    expect((stored.stem as { blocks: unknown[] }).blocks).toHaveLength(2);
  });

  it('refuses two correct answers as a field message rather than a unique violation', async () => {
    const { POST } = await import('@/app/api/admin/questions/route');
    const response = await POST(
      mutation(
        '/api/admin/questions',
        body({
          options: [
            { content: 'خيار', isCorrect: true },
            { content: 'خيار آخر', isCorrect: true },
          ],
        }),
      ),
    );

    expect(response.status).toBe(400);
    const payload = await envelope<never>(response);
    expect(payload.error?.code).toBe('validation_error');
    // The partial unique index would have answered a 500 with the editor's work
    // lost; the schema answers with the rule, in Arabic.
    expect(JSON.stringify(payload.error?.details)).toContain('إجابة صحيحة واحدة');
  });

  it('refuses a question with no rights declaration', async () => {
    const { POST } = await import('@/app/api/admin/questions/route');
    const response = await POST(
      mutation('/api/admin/questions', body({ rightsDeclaration: null, authorOrLicensor: '' })),
    );

    expect(response.status).toBe(400);
    expect((await envelope<never>(response)).error?.code).toBe('validation_error');
  });

  it('refuses a cross-origin request', async () => {
    const { POST } = await import('@/app/api/admin/questions/route');
    const response = await POST(
      mutation('/api/admin/questions', body(), 'POST', 'https://evil.example'),
    );

    expect(response.status).toBe(403);
    expect((await envelope<never>(response)).error?.code).toBe('cross_origin');
  });
});

describe('POST /api/admin/questions/[questionId]/workflow', () => {
  it('refuses to publish a question nobody approved, and says which is missing', async () => {
    const id = await createQuestion();
    const response = await move(id, 'PUBLISHED');

    expect(response.status).toBe(409);
    expect((await envelope<never>(response)).error?.code).toBe('review_required');

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { workflow: true, currentVersion: true },
    });
    expect(stored.workflow).toBe('DRAFT');
    expect(stored.currentVersion).toBe(0);
  });

  it('refuses a move the state machine does not permit', async () => {
    const id = await createQuestion();
    const response = await move(id, 'RETIRED');

    expect(response.status).toBe(409);
    expect((await envelope<never>(response)).error?.code).toBe('invalid_transition');
  });

  it('stamps the reviewer on approval and keeps the note', async () => {
    const id = await createQuestion();
    await move(id, 'IN_REVIEW');
    await move(id, 'APPROVED', 'راجعت التصنيف وبيانات الحقوق.');

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { workflow: true, reviewedById: true, reviewedAt: true, reviewNote: true },
    });

    expect(stored.workflow).toBe('APPROVED');
    expect(stored.reviewedById).toBe(session.user.id);
    expect(stored.reviewedAt).not.toBeNull();
    expect(stored.reviewNote).toBe('راجعت التصنيف وبيانات الحقوق.');
  });

  it('freezes a version the exam engine can actually serve', async () => {
    const id = await createQuestion();
    const result = await publish(id);

    expect(result.data?.published).toBe(true);
    expect(result.data?.currentVersion).toBe(1);

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: {
        workflow: true,
        currentVersion: true,
        publishedAt: true,
        domain: true,
        subskill: true,
        difficulty: true,
        options: { orderBy: { position: 'asc' }, select: { id: true, isCorrect: true } },
      },
    });
    expect(stored.workflow).toBe('PUBLISHED');
    expect(stored.currentVersion).toBe(1);
    expect(stored.publishedAt).not.toBeNull();

    const version = await prisma.questionVersion.findUniqueOrThrow({
      where: { questionId_version: { questionId: id, version: 1 } },
      select: { snapshot: true, createdById: true },
    });
    const snapshot = version.snapshot as {
      correctOptionKey: string;
      options: Array<{ key: string; position: number }>;
      classification: { domain: string };
      stimulus: unknown;
    };

    expect(version.createdById).toBe(session.user.id);
    expect(snapshot.options.map((option) => option.key)).toEqual(
      stored.options.map((option) => option.id),
    );
    expect(snapshot.correctOptionKey).toBe(stored.options.find((option) => option.isCorrect)!.id);
    expect(snapshot.classification.domain).toBe('ARITHMETIC');
    expect(snapshot.stimulus).toBeNull();

    // The real check: the delivery path parses it. `prepareAttemptQuestions`
    // refuses a version without a stem, without two options, or with a correct
    // key that names none of them, so this asserts servability rather than shape.
    const prepared = await prepareAttemptQuestions(prisma, {
      sourceQuestions: [
        {
          questionId: id,
          questionVersion: 1,
          domain: stored.domain,
          subskill: stored.subskill,
          difficulty: stored.difficulty,
        },
      ],
      seed: 7,
      sectionPosition: 1,
    });

    expect(prepared).toHaveLength(1);
    expect(prepared[0]!.correctOptionKey).toBe(snapshot.correctOptionKey);
    expect(prepared[0]!.contentSnapshot.options).toHaveLength(3);
  });

  it('puts a published question into the eligible pool and takes it out again on retirement', async () => {
    const id = await createQuestion();
    await publish(id);

    const eligible = async () =>
      prisma.question.count({
        where: { id, currentVersion: { gt: 0 }, workflow: { not: 'RETIRED' } },
      });

    expect(await eligible()).toBe(1);

    const retired = await move(id, 'RETIRED');
    expect(retired.status).toBe(200);
    expect(await eligible()).toBe(0);

    // Retiring is not deleting: the frozen version survives, because an attempt
    // built from it still has to be readable.
    expect(await prisma.questionVersion.count({ where: { questionId: id } })).toBe(1);
  });

  it('restores a retired question to the editor without returning it to service', async () => {
    const id = await createQuestion();
    await publish(id);
    await move(id, 'RETIRED');

    const restored = await move(id, 'DRAFT');
    expect(restored.status).toBe(200);

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { workflow: true, currentVersion: true, retiredAt: true },
    });

    expect(stored.workflow).toBe('DRAFT');
    expect(stored.retiredAt).toBeNull();
    // The pool is `currentVersion > 0 AND workflow != RETIRED`. Leaving the
    // counter alone would have put the withdrawn snapshot back in front of
    // students the instant the workflow column moved off RETIRED.
    expect(stored.currentVersion).toBe(0);
    expect(
      await prisma.question.count({
        where: { id, currentVersion: { gt: 0 }, workflow: { not: 'RETIRED' } },
      }),
    ).toBe(0);

    // The history is still there, so a re-publication cannot reuse version 1.
    expect(await prisma.questionVersion.count({ where: { questionId: id } })).toBe(1);
    await move(id, 'IN_REVIEW');
    await move(id, 'APPROVED');
    const republished = await move(id, 'PUBLISHED');
    expect(republished.status).toBe(200);
    expect((await envelope<{ currentVersion: number }>(republished)).data?.currentVersion).toBe(2);
  });
});

describe('PATCH /api/admin/questions/[questionId]', () => {
  it('cannot publish, and cannot move the version a student is being served', async () => {
    const id = await createQuestion();
    await publish(id);

    const { PATCH } = await import('@/app/api/admin/questions/[questionId]/route');
    const response = await PATCH(
      mutation(
        `/api/admin/questions/${id}`,
        body({
          stem: 'نص معدَّل بعد النشر',
          workflow: 'RETIRED',
          currentVersion: 99,
          options: [
            { content: 'إجابة مختلفة تمامًا', isCorrect: true },
            { content: 'مشتت جديد', isCorrect: false },
          ],
        }),
        'PATCH',
      ),
      { params: Promise.resolve({ questionId: id }) },
    );
    expect(response.status).toBe(200);

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: {
        workflow: true,
        currentVersion: true,
        domain: true,
        subskill: true,
        difficulty: true,
      },
    });
    // The edit changed the draft and nothing else.
    expect(stored.workflow).toBe('PUBLISHED');
    expect(stored.currentVersion).toBe(1);

    // And the frozen version — the thing an attempt copies — did not move.
    const prepared = await prepareAttemptQuestions(prisma, {
      sourceQuestions: [
        {
          questionId: id,
          questionVersion: 1,
          domain: stored.domain,
          subskill: stored.subskill,
          difficulty: stored.difficulty,
        },
      ],
      seed: 7,
      sectionPosition: 1,
    });

    const servedStem = prepared[0]!.contentSnapshot.stem.blocks
      .flatMap((block) => block.children)
      .map((child) => (child.type === 'math' ? child.tex : child.text))
      .join('');
    expect(servedStem).toBe(`نص السؤال ${MARKER}`);
    expect(prepared[0]!.contentSnapshot.options).toHaveLength(3);
  });

  it('cuts a new version on re-publication, leaving the old one intact', async () => {
    const id = await createQuestion();
    await publish(id);

    const { PATCH } = await import('@/app/api/admin/questions/[questionId]/route');
    await PATCH(
      mutation(`/api/admin/questions/${id}`, body({ stem: 'نص النسخة الثانية' }), 'PATCH'),
      { params: Promise.resolve({ questionId: id }) },
    );

    const republished = await move(id, 'PUBLISHED');
    expect(republished.status).toBe(200);
    expect((await envelope<{ currentVersion: number }>(republished)).data?.currentVersion).toBe(2);

    const versions = await prisma.questionVersion.findMany({
      where: { questionId: id },
      orderBy: { version: 'asc' },
      select: { version: true, snapshot: true },
    });
    expect(versions.map((version) => version.version)).toEqual([1, 2]);
    expect(JSON.stringify(versions[0]!.snapshot)).toContain(`نص السؤال ${MARKER}`);
    expect(JSON.stringify(versions[1]!.snapshot)).toContain('نص النسخة الثانية');
  });

  it('answers 404 for a question that does not exist', async () => {
    const { PATCH } = await import('@/app/api/admin/questions/[questionId]/route');
    const missing = randomUUID();
    const response = await PATCH(mutation(`/api/admin/questions/${missing}`, body(), 'PATCH'), {
      params: Promise.resolve({ questionId: missing }),
    });

    expect(response.status).toBe(404);
    expect((await envelope<never>(response)).error?.code).toBe('question_not_found');
  });
});

describe('DELETE /api/admin/questions/[questionId]', () => {
  it('refuses to delete anything that has ever been served, and retires instead', async () => {
    const id = await createQuestion();
    await publish(id);

    const { DELETE } = await import('@/app/api/admin/questions/[questionId]/route');
    const response = await DELETE(mutation(`/api/admin/questions/${id}`, undefined, 'DELETE'), {
      params: Promise.resolve({ questionId: id }),
    });

    expect(response.status).toBe(409);
    expect((await envelope<never>(response)).error?.code).toBe('delete_blocked_in_use');
    expect(await prisma.question.count({ where: { id } })).toBe(1);
  });

  it('separates a permanent refusal from a temporary one', async () => {
    const { DELETE } = await import('@/app/api/admin/questions/[questionId]/route');

    // In review: nothing points at it, so the refusal is about where it is in
    // the workflow. Returning it to the editor makes it deletable again, which
    // is why the screen must not claim it is used elsewhere.
    const inReview = await createQuestion();
    await move(inReview, 'IN_REVIEW');
    expect((await detail(inReview)).payload.data?.deleteBlock).toBe('not_a_draft');

    const refused = await DELETE(
      mutation(`/api/admin/questions/${inReview}`, undefined, 'DELETE'),
      { params: Promise.resolve({ questionId: inReview }) },
    );
    expect(refused.status).toBe(409);
    expect((await envelope<never>(refused)).error?.code).toBe('delete_blocked_not_a_draft');

    // Published: a frozen version exists, so the refusal is permanent.
    const published = await createQuestion();
    await publish(published);
    expect((await detail(published)).payload.data?.deleteBlock).toBe('in_use');
  });

  it('removes a draft that was never published and that nothing points at', async () => {
    const id = await createQuestion();

    const before = await detail(id);
    expect(before.payload.data?.deleteBlock).toBe('none');

    const { DELETE } = await import('@/app/api/admin/questions/[questionId]/route');
    const response = await DELETE(mutation(`/api/admin/questions/${id}`, undefined, 'DELETE'), {
      params: Promise.resolve({ questionId: id }),
    });

    expect(response.status).toBe(200);
    expect(await prisma.question.count({ where: { id } })).toBe(0);
    // Options cascade; the trail does not.
    expect(await prisma.questionOption.count({ where: { questionId: id } })).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { targetId: id, action: 'question.deleted' } }),
    ).toBe(1);
  });
});

describe('GET /api/admin/questions', () => {
  it('filters, searches and pages in the database', async () => {
    const id = await createQuestion({ difficulty: 'HARD', domain: 'ALGEBRA' });
    await createQuestion({ difficulty: 'EASY', domain: 'GEOMETRY' });

    const { GET } = await import('@/app/api/admin/questions/route');

    const filtered = await envelope<QuestionListResult>(
      await GET(read(`/api/admin/questions?q=${encodeURIComponent(MARKER)}&domain=ALGEBRA`)),
    );
    expect(filtered.data!.items.map((item) => item.id)).toContain(id);
    for (const item of filtered.data!.items) expect(item.domain).toBe('ALGEBRA');

    // The stem is a JSON document; the search has to reach inside it.
    const searched = await envelope<QuestionListResult>(
      await GET(read(`/api/admin/questions?q=${encodeURIComponent(`نص السؤال ${MARKER}`)}`)),
    );
    expect(searched.data!.total).toBeGreaterThan(0);

    // A wildcard is a character to search for, not a pattern to run. Unescaped,
    // `MARKER%` and `MARKER_` would both match every row `MARKER` matches, and a
    // filtered list would quietly stop being filtered.
    expect(searched.data!.total).toBeGreaterThan(0);
    for (const wildcard of [`${MARKER}%`, `${MARKER}_`]) {
      const escaped = await envelope<QuestionListResult>(
        await GET(read(`/api/admin/questions?q=${encodeURIComponent(wildcard)}`)),
      );
      expect(escaped.data!.total).toBe(0);
    }

    // A hand-edited query string degrades to the default view rather than 400.
    const nonsense = await GET(read('/api/admin/questions?page=-4&perPage=99999&domain=NOPE'));
    expect(nonsense.status).toBe(200);
    const degraded = await envelope<QuestionListResult>(nonsense);
    expect(degraded.data!.page).toBe(1);
    expect(degraded.data!.perPage).toBe(25);
  });

  it('paginates without losing or repeating a row', async () => {
    const marker = `صفحات-${randomUUID().slice(0, 8)}`;
    for (let index = 0; index < 3; index += 1) {
      await createQuestion({ tags: [marker], subskill: marker });
    }

    const { GET } = await import('@/app/api/admin/questions/route');
    const first = await envelope<QuestionListResult>(
      await GET(read(`/api/admin/questions?q=${encodeURIComponent(marker)}&perPage=10&page=1`)),
    );
    const second = await envelope<QuestionListResult>(
      await GET(read(`/api/admin/questions?q=${encodeURIComponent(marker)}&perPage=10&page=2`)),
    );

    expect(first.data!.total).toBe(3);
    expect(first.data!.items).toHaveLength(3);
    expect(first.data!.pageCount).toBe(1);
    // Past the end is an empty page, not a wrapped one.
    expect(second.data!.items).toHaveLength(0);
    expect(second.data!.total).toBe(3);
  });
});

describe('GET /api/admin/questions/[questionId]', () => {
  it('gives an editor the answer key that no student-facing path can reach', async () => {
    const id = await createQuestion();
    const { payload, response } = await detail(id);

    expect(response.status).toBe(200);
    const question = payload.data!;
    expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    // The documents come back as the plain text the editor typed.
    expect(question.stem).toBe(`نص السؤال ${MARKER}`);
    expect(question.explanation).toBe('شرح الوصول إلى الإجابة.');
    expect(question.workflow).toBe('DRAFT');
  });

  it('records one audit row per mutation, attributed and inside the transaction', async () => {
    const id = await createQuestion();
    await publish(id);

    const trail = await prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, actorId: true, actorEmail: true, targetType: true, metadata: true },
    });

    expect(trail.map((row) => row.action)).toEqual([
      'question.created',
      'question.workflow_changed',
      'question.workflow_changed',
      'question.published',
    ]);
    for (const row of trail) {
      expect(row.targetType).toBe('Question');
      expect(row.actorId).toBe(session.user.id);
      expect(row.actorEmail).toBe(session.user.email);
    }
    expect(trail.at(-1)!.metadata).toMatchObject({ from: 'APPROVED', to: 'PUBLISHED', version: 1 });
  });
});
