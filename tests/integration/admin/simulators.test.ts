import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The exam simulator administration routes, exercised through the handlers.
 *
 * Only the session guard is stubbed. The Zod schemas, the origin check, the
 * services, the audit writes and the database are all real, because every
 * property worth asserting here belongs to the whole request pipeline:
 * "a published version cannot be edited", "a version nobody published cannot be
 * activated", "a blueprint the bank cannot fill cannot be published". Asserting
 * any of those a layer below the route would prove nothing about the route.
 *
 * The last of those is the reason this file exists. `attempt-selection.service`
 * already refuses to generate a paper it cannot fill — but it refuses at the
 * moment a student presses "ابدأ". These tests are about catching it while it is
 * still an administrator's problem.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: '',
    name: 'مسؤول',
    role: 'ADMIN' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      return session.user;
    },
    // Deliberately the real rule rather than a pass-through: "a student is
    // refused" is one of the things this file exists to prove.
    requireAdmin: async () => {
      if (!session.user.id) throw new actual.HttpError(401, 'unauthorized', 'unauthorized');
      if (session.user.role !== 'ADMIN') {
        throw new actual.HttpError(403, 'forbidden', 'forbidden');
      }
      return session.user;
    },
  };
});

import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';

import { releaseFixtureQuestions } from '../question-cleanup';

const ORIGIN = 'http://localhost:3000';

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdQuestionIds: string[] = [];
const createdVersionIds: string[] = [];

type Envelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, string> };
};

function jsonRequest(path: string, method: string, body?: unknown) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const email = `admin-simulators-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

/**
 * A simulator product, written straight to the tables.
 *
 * The catalogue route belongs to the products suite; what matters here is only
 * that a simulator with a track exists, so the rows are created directly rather
 * than pushed through a second screen's handler.
 */
async function createSimulator(track: 'SCIENTIFIC' | 'THEORETICAL' | 'BOTH' = 'BOTH') {
  const product = await prisma.product.create({
    data: {
      type: 'EXAM_SIMULATOR',
      slug: `sim-test-${randomUUID()}`.slice(0, 60),
      title: 'محاكي اختباري',
      shortDescription: 'وصف مختصر صالح لمحاكٍ اختباري.',
      priceHalalas: 49_900,
      currency: 'SAR',
      status: 'DRAFT',
      examSimulator: { create: { track } },
    },
    select: { id: true, examSimulator: { select: { id: true } } },
  });
  createdProductIds.push(product.id);
  return { productId: product.id, simulatorId: product.examSimulator!.id };
}

/**
 * A question that is eligible for selection.
 *
 * `currentVersion > 0` and a workflow that is not `RETIRED` is the whole
 * eligibility rule the exam engine applies, so the fixtures set exactly that
 * rather than going through the publish path — this file is about simulators,
 * and the question bank's own suite proves the publish path.
 */
async function createPublishedQuestion(input: {
  domain: 'READING_COMPREHENSION' | 'GEOMETRY' | 'ALGEBRA';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  /**
   * A per-test marker, and it is load-bearing. The database is seeded with 264
   * real questions and Vitest runs files in parallel against it, so a rule
   * narrowed only by domain and difficulty would draw from whatever else happens
   * to be published — and "the bank is three questions short" would then depend
   * on the seed rather than on the fixture.
   */
  subskill: string;
  track?: 'SCIENTIFIC' | 'THEORETICAL' | 'BOTH';
}) {
  const stem = { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'نص سؤال' }] }] };

  // One transaction, because a blueprint section draws from the whole bank: a
  // question committed as `PUBLISHED` before its snapshot exists is a question
  // another worker can draw and then fail to deliver.
  const question = await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        stem,
        domain: input.domain,
        difficulty: input.difficulty,
        subskill: input.subskill,
        track: input.track ?? 'BOTH',
        workflow: 'PUBLISHED',
        currentVersion: 1,
        authorOrLicensor: 'نيو إيرا',
        rightsDeclaration: 'ORIGINAL',
        options: {
          create: [
            { content: stem, position: 1, isCorrect: true },
            { content: stem, position: 2, isCorrect: false },
          ],
        },
      },
      select: { id: true, options: { orderBy: { position: 'asc' }, select: { id: true } } },
    });

    // The frozen snapshot, which `currentVersion: 1` above is a promise that one
    // exists. It used to be skipped here: nothing in this file delivers an
    // attempt, and a blueprint rule scoped to this fixture's subskill was the
    // only thing that could draw these rows. A blueprint section now draws from
    // the whole bank, so a question published without its snapshot is a landmine
    // for every other suite in the run — it is selected, then fails
    // `prepareAttemptQuestions` with a `SnapshotIntegrityError`.
    await tx.questionVersion.create({
      data: {
        questionId: created.id,
        version: 1,
        snapshot: {
          stem,
          options: created.options.map((option, index) => ({
            key: option.id,
            content: stem,
            position: index + 1,
          })),
          correctOptionKey: created.options[0]!.id,
          explanation: null,
          hint: null,
          classification: {
            domain: input.domain,
            subskill: input.subskill,
            difficulty: input.difficulty,
            track: input.track ?? 'BOTH',
          },
        },
      },
    });

    return created;
  });

  createdQuestionIds.push(question.id);
  return { id: question.id };
}

// ── Route helpers ────────────────────────────────────────────────────────

async function postVersion(simulatorId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/simulators/[simulatorId]/versions/route');
  const response = await POST(
    jsonRequest(`/api/admin/simulators/${simulatorId}/versions`, 'POST', body),
    { params: Promise.resolve({ simulatorId }) },
  );
  const payload = (await response.json()) as Envelope;
  if (typeof payload.data?.id === 'string') createdVersionIds.push(payload.data.id);
  return { response, payload };
}

async function patchVersion(versionId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/exam-versions/[versionId]/route');
  const response = await PATCH(
    jsonRequest(`/api/admin/exam-versions/${versionId}`, 'PATCH', body),
    { params: Promise.resolve({ versionId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function deleteVersion(versionId: string) {
  const { DELETE } = await import('@/app/api/admin/exam-versions/[versionId]/route');
  const response = await DELETE(jsonRequest(`/api/admin/exam-versions/${versionId}`, 'DELETE'), {
    params: Promise.resolve({ versionId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function versionAction(versionId: string, action: string) {
  const { POST } = await import('@/app/api/admin/exam-versions/[versionId]/status/route');
  const response = await POST(
    jsonRequest(`/api/admin/exam-versions/${versionId}/status`, 'POST', { action }),
    { params: Promise.resolve({ versionId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function postSection(versionId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/exam-versions/[versionId]/sections/route');
  const response = await POST(
    jsonRequest(`/api/admin/exam-versions/${versionId}/sections`, 'POST', body),
    { params: Promise.resolve({ versionId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function reorderSections(versionId: string, ids: string[]) {
  const { PATCH } = await import('@/app/api/admin/exam-versions/[versionId]/sections/route');
  const response = await PATCH(
    jsonRequest(`/api/admin/exam-versions/${versionId}/sections`, 'PATCH', { ids }),
    { params: Promise.resolve({ versionId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function postRule(sectionId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/exam-sections/[sectionId]/rules/route');
  const response = await POST(
    jsonRequest(`/api/admin/exam-sections/${sectionId}/rules`, 'POST', body),
    { params: Promise.resolve({ sectionId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function patchSection(sectionId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/exam-sections/[sectionId]/route');
  const response = await PATCH(
    jsonRequest(`/api/admin/exam-sections/${sectionId}`, 'PATCH', body),
    {
      params: Promise.resolve({ sectionId }),
    },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function patchSimulator(simulatorId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/simulators/[simulatorId]/route');
  const response = await PATCH(jsonRequest(`/api/admin/simulators/${simulatorId}`, 'PATCH', body), {
    params: Promise.resolve({ simulatorId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

/** A version body that is valid on its own, before any sections exist. */
function versionBody(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'blank',
    selectionMode: 'BLUEPRINT',
    totalQuestions: 10,
    totalDurationSec: 600,
    resultDisclaimer: 'هذه نتيجة تدريبية وليست درجة رسمية.',
    changeSummary: null,
    sourceLabel: null,
    sourceUrl: null,
    sourceRetrievedAt: null,
    sourceNote: null,
    ...overrides,
  };
}

function sectionBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'القسم الأول',
    durationSec: 600,
    questionCount: 10,
    calculatorEnabled: false,
    scratchpadEnabled: true,
    allowReviewWithinSection: true,
    lockOnAdvance: true,
    pauseEnabled: false,
    ...overrides,
  };
}

type VersionPayload = {
  id: string;
  status: string;
  versionNumber: number;
  sections: Array<{ id: string; title: string; position: number; rules: Array<{ id: string }> }>;
};

/**
 * Build a draft that would publish cleanly: one section, one rule, and enough
 * questions in the bank to satisfy it. Individual tests then break one thing.
 */
async function buildPublishableVersion(options: { bankSize: number; required: number }) {
  const { simulatorId } = await createSimulator('BOTH');
  const subskill = `مهارة-اختبار-${randomUUID().slice(0, 8)}`;

  for (let i = 0; i < options.bankSize; i += 1) {
    await createPublishedQuestion({ domain: 'GEOMETRY', difficulty: 'HARD', subskill });
  }

  const created = await postVersion(
    simulatorId,
    versionBody({ totalQuestions: options.required, totalDurationSec: 600 }),
  );
  const versionId = created.payload.data?.id as string;

  const withSection = await postSection(
    versionId,
    sectionBody({ questionCount: options.required, durationSec: 600 }),
  );
  const section = (withSection.payload.data as unknown as VersionPayload).sections[0]!;

  await postRule(section.id, {
    domain: 'GEOMETRY',
    subskill,
    difficulty: 'HARD',
    track: null,
    percentage: 100,
    questionCount: null,
  });

  return { simulatorId, versionId, sectionId: section.id, subskill };
}

/**
 * A `FIXED` draft: sections whose questions are named outright rather than drawn
 * from a blueprint.
 *
 * The bank is created one question larger than the pinned list so a test can
 * attach a spare to a second section without widening the fixture.
 */
async function buildFixedVersion(options: { sections?: number; perSection: number }) {
  const sectionCount = options.sections ?? 1;
  const { simulatorId } = await createSimulator('BOTH');
  const subskill = `مهارة-ثابتة-${randomUUID().slice(0, 8)}`;

  const questionIds: string[] = [];
  for (let i = 0; i < sectionCount * options.perSection + 1; i += 1) {
    const question = await createPublishedQuestion({
      domain: 'ALGEBRA',
      difficulty: 'MEDIUM',
      subskill,
    });
    questionIds.push(question.id);
  }

  const created = await postVersion(
    simulatorId,
    versionBody({
      selectionMode: 'FIXED',
      totalQuestions: sectionCount * options.perSection,
      totalDurationSec: sectionCount * 600,
    }),
  );
  const versionId = created.payload.data?.id as string;

  let detail = created.payload.data as unknown as VersionPayload;
  for (let index = 0; index < sectionCount; index += 1) {
    const withSection = await postSection(
      versionId,
      sectionBody({
        title: `القسم ${index + 1}`,
        questionCount: options.perSection,
        durationSec: 600,
      }),
    );
    detail = withSection.payload.data as unknown as VersionPayload;
  }

  const sectionIds = [...detail.sections]
    .sort((a, b) => a.position - b.position)
    .map((section) => section.id);

  let cursor = 0;
  for (const sectionId of sectionIds) {
    for (let index = 0; index < options.perSection; index += 1) {
      await patchSection(sectionId, {
        op: 'questions',
        action: 'add',
        questionId: questionIds[cursor]!,
      });
      cursor += 1;
    }
  }

  return { simulatorId, versionId, sectionIds, questionIds, spareQuestionId: questionIds.at(-1)! };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE exam_versions` here
 * would delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  const simulators = await prisma.examSimulator.findMany({
    where: { productId: { in: createdProductIds } },
    select: { id: true },
  });
  const simulatorIds = simulators.map((row) => row.id);

  const versions = await prisma.examVersion.findMany({
    where: { simulatorId: { in: simulatorIds } },
    select: { id: true },
  });
  const versionIds = [...new Set([...versions.map((row) => row.id), ...createdVersionIds])];

  const sections = await prisma.examSection.findMany({
    where: { examVersionId: { in: versionIds } },
    select: { id: true },
  });
  const sectionIds = sections.map((row) => row.id);

  await prisma.examBlueprintRule.deleteMany({ where: { examSectionId: { in: sectionIds } } });
  await prisma.examSectionQuestion.deleteMany({ where: { examSectionId: { in: sectionIds } } });
  await prisma.examSection.deleteMany({ where: { id: { in: sectionIds } } });
  // The pointer has to be dropped before the row it points at can go.
  await prisma.examSimulator.updateMany({
    where: { id: { in: simulatorIds } },
    data: { activeExamVersionId: null },
  });
  await prisma.examVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.examSimulator.deleteMany({ where: { id: { in: simulatorIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await releaseFixtureQuestions(createdQuestionIds);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('POST /api/admin/simulators/[simulatorId]/versions', () => {
  it('creates a draft numbered after the last one, and audits it', async () => {
    const admin = await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    const first = await postVersion(simulatorId, versionBody());
    expect(first.response.status).toBe(201);
    expect(first.payload.data?.status).toBe('DRAFT');
    expect(first.payload.data?.versionNumber).toBe(1);

    const second = await postVersion(simulatorId, versionBody());
    expect(second.payload.data?.versionNumber).toBe(2);

    const audit = await prisma.auditLog.findFirst({
      where: {
        targetType: 'ExamVersion',
        targetId: first.payload.data?.id as string,
        action: 'exam_version.created',
      },
      select: { actorId: true, actorEmail: true },
    });
    expect(audit?.actorId).toBe(admin.id);
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(audit?.actorEmail).toBe(admin.email);
  });

  it('ignores a status the client tried to set', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    const { payload } = await postVersion(
      simulatorId,
      versionBody({
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        versionNumber: 99,
      }),
    );

    const stored = await prisma.examVersion.findUniqueOrThrow({
      where: { id: payload.data?.id as string },
      select: { status: true, publishedAt: true, versionNumber: true },
    });
    expect(stored).toEqual({ status: 'DRAFT', publishedAt: null, versionNumber: 1 });
  });

  /**
   * The headline behaviour of the whole screen: a published exam is changed by
   * copying it, never by editing it.
   */
  it('clones a published version into a new draft, with its sections and rules', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 6,
      required: 4,
    });

    const published = await versionAction(versionId, 'publish');
    expect(published.response.status).toBe(200);
    expect((published.payload.data as { version: { status: string } }).version.status).toBe(
      'PUBLISHED',
    );

    const clone = await postVersion(simulatorId, {
      mode: 'clone',
      sourceVersionId: versionId,
      changeSummary: 'إصدار معدّل من المنشور.',
    });

    expect(clone.response.status).toBe(201);
    const cloned = clone.payload.data as unknown as VersionPayload;
    expect(cloned.status).toBe('DRAFT');
    // MAX + 1 for this simulator, honouring @@unique([simulatorId, versionNumber]).
    expect(cloned.versionNumber).toBe(2);
    expect(cloned.sections).toHaveLength(1);
    expect(cloned.sections[0]!.rules).toHaveLength(1);

    // The original is untouched — that is the whole reason the clone exists.
    const source = await prisma.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: { status: true, _count: { select: { sections: true } } },
    });
    expect(source.status).toBe('PUBLISHED');
    expect(source._count.sections).toBe(1);

    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'ExamVersion',
          targetId: cloned.id,
          action: 'exam_version.duplicated',
        },
      }),
    ).toBe(1);
  });

  it('refuses to clone a version belonging to another simulator', async () => {
    await signInAs('ADMIN');
    const other = await createSimulator();
    const foreign = await postVersion(other.simulatorId, versionBody());

    const { simulatorId } = await createSimulator();
    const { response, payload } = await postVersion(simulatorId, {
      mode: 'clone',
      sourceVersionId: foreign.payload.data?.id,
      changeSummary: null,
    });

    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('exam_version_not_found');
    expect(await prisma.examVersion.count({ where: { simulatorId } })).toBe(0);
  });

  it('answers a signed-in student with 403 and writes nothing', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    await signInAs('STUDENT');
    const { response } = await postVersion(simulatorId, versionBody());

    expect(response.status).toBe(403);
    expect(await prisma.examVersion.count({ where: { simulatorId } })).toBe(0);
  });

  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    const { POST } = await import('@/app/api/admin/simulators/[simulatorId]/versions/route');
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/simulators/${simulatorId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify(versionBody()),
      }),
      { params: Promise.resolve({ simulatorId }) },
    );

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/admin/exam-versions/[versionId]', () => {
  /**
   * The invariant the rest of the exam engine depends on: `ExamAttempt` pins the
   * version it was generated from, and two students who both sat "version 1"
   * must have sat the same exam.
   */
  it('refuses to edit a published version and changes nothing', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 6, required: 4 });
    await versionAction(versionId, 'publish');

    const { response, payload } = await patchVersion(
      versionId,
      versionBody({ mode: undefined, totalQuestions: 99, totalDurationSec: 99 }),
    );

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('exam_version_frozen');
    expect(payload.error?.message).toContain('نسخة');

    const stored = await prisma.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: { totalQuestions: true, totalDurationSec: true },
    });
    expect(stored).toEqual({ totalQuestions: 4, totalDurationSec: 600 });
  });

  it('refuses to add a section to a published version', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 6, required: 4 });
    await versionAction(versionId, 'publish');

    const { response, payload } = await postSection(versionId, sectionBody({ title: 'قسم جديد' }));

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('exam_version_frozen');
    expect(await prisma.examSection.count({ where: { examVersionId: versionId } })).toBe(1);
  });

  it('saves an edit to a draft', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();
    const created = await postVersion(simulatorId, versionBody());
    const versionId = created.payload.data?.id as string;

    const { response, payload } = await patchVersion(
      versionId,
      versionBody({ mode: undefined, totalQuestions: 25, changeSummary: 'ملخّص' }),
    );

    expect(response.status).toBe(200);
    expect(payload.data?.totalQuestions).toBe(25);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.updated' },
      }),
    ).toBe(1);
  });
});

describe('POST /api/admin/exam-versions/[versionId]/status', () => {
  it('refuses to publish a version with no result disclaimer', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();
    const created = await postVersion(simulatorId, versionBody({ resultDisclaimer: '' }));
    const versionId = created.payload.data?.id as string;

    const { response, payload } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('disclaimer_required');
    expect(
      (
        await prisma.examVersion.findUniqueOrThrow({
          where: { id: versionId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });

  it('refuses to publish a version with no sections', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();
    const created = await postVersion(simulatorId, versionBody());

    const { response, payload } = await versionAction(
      created.payload.data?.id as string,
      'publish',
    );

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('sections_required');
  });

  it('refuses to publish when the totals disagree with the sections', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();
    const created = await postVersion(simulatorId, versionBody({ totalQuestions: 10 }));
    const versionId = created.payload.data?.id as string;

    // Six questions in the section against ten declared on the version.
    await postSection(versionId, sectionBody({ questionCount: 6, durationSec: 600 }));

    const { response, payload } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('question_count_mismatch');
  });

  /**
   * The failure this screen exists to prevent: rules that are arithmetically
   * perfect and impossible against the bank. Without this check the refusal
   * arrives when a student presses "ابدأ".
   */
  it('refuses to publish a version the bank cannot satisfy, naming the shortfall', async () => {
    await signInAs('ADMIN');

    // A section draws from the whole bank, so the demand has to exceed the whole
    // bank — this file's fixtures, the other workers', and anything left over.
    // `questionCountSchema` caps a section at 500, so a test database holding
    // 500 eligible questions cannot express a shortage at all; that is a stale
    // database rather than a passing test, and it says so.
    const eligible = await prisma.question.count({
      where: { currentVersion: { gt: 0 }, workflow: { not: 'RETIRED' } },
    });
    // Ask for the largest section the schema allows rather than "one more than
    // the bank": other workers publish questions while this runs, so the widest
    // possible margin is the only stable one.
    const required = 500;
    if (eligible >= required) {
      throw new Error(
        `The test bank holds ${eligible} eligible questions and a section caps at ${required}, ` +
          'so no version can out-ask it. Run `npm run db:reset-test`.',
      );
    }

    const { versionId } = await buildPublishableVersion({ bankSize: 1, required });

    const { response, payload } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('question_shortage');
    // The numbers, not just "تعذّر النشر": what was asked for, what the bank
    // holds, and the difference.
    expect(payload.error?.message).toContain(COPY.adminSimulators.blueprint.coverage.bankSizeLabel);
    expect(payload.error?.message).toContain(
      COPY.adminSimulators.blueprint.coverage.shortfallLabel,
    );

    expect(
      (
        await prisma.examVersion.findUniqueOrThrow({
          where: { id: versionId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });

  it('publishes once the bank can satisfy the blueprint, and audits it', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 8, required: 5 });

    const { response, payload } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(200);
    expect((payload.data as { changed: boolean }).changed).toBe(true);

    const stored = await prisma.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: { status: true, publishedAt: true },
    });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.publishedAt).not.toBeNull();

    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.published' },
      }),
    ).toBe(1);
  });

  it('reports a repeated publication as no change instead of claiming a second one', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 8, required: 5 });

    await versionAction(versionId, 'publish');
    const { payload } = await versionAction(versionId, 'publish');

    expect((payload.data as { changed: boolean }).changed).toBe(false);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.published' },
      }),
    ).toBe(1);
  });

  /** Publication and activation are two decisions; only the first has happened. */
  it('refuses to activate a version that was never published', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 6,
      required: 4,
    });

    const { response, payload } = await versionAction(versionId, 'activate');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('activate_requires_published');
    expect(
      (
        await prisma.examSimulator.findUniqueOrThrow({
          where: { id: simulatorId },
          select: { activeExamVersionId: true },
        })
      ).activeExamVersionId,
    ).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.activated' },
      }),
    ).toBe(0);
  });

  it('activates a published version and records it as its own decision', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 8,
      required: 5,
    });
    await versionAction(versionId, 'publish');

    const { response, payload } = await versionAction(versionId, 'activate');

    expect(response.status).toBe(200);
    expect((payload.data as { changed: boolean }).changed).toBe(true);
    expect(
      (
        await prisma.examSimulator.findUniqueOrThrow({
          where: { id: simulatorId },
          select: { activeExamVersionId: true },
        })
      ).activeExamVersionId,
    ).toBe(versionId);

    // Publishing and activating leave two rows, because two things were decided.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.activated' },
      }),
    ).toBe(1);
  });

  it('refuses to retire the active version, and points at deactivating first', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 8, required: 5 });
    await versionAction(versionId, 'publish');
    await versionAction(versionId, 'activate');

    const { response, payload } = await versionAction(versionId, 'retire');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('retire_blocked_by_active');
    expect(
      (
        await prisma.examVersion.findUniqueOrThrow({
          where: { id: versionId },
          select: { status: true },
        })
      ).status,
    ).toBe('PUBLISHED');
  });

  /**
   * "Deactivate" on a version that is not the active one must be a no-op. The
   * dangerous alternative is clearing the pointer regardless, which would switch
   * off whichever *other* version the simulator was actually serving.
   */
  it('leaves another version active when a non-active one is deactivated', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 8,
      required: 5,
    });
    await versionAction(versionId, 'publish');
    await versionAction(versionId, 'activate');

    const other = await postVersion(simulatorId, versionBody());
    const otherId = other.payload.data?.id as string;

    const { payload } = await versionAction(otherId, 'deactivate');

    expect((payload.data as { changed: boolean }).changed).toBe(false);
    expect(
      (
        await prisma.examSimulator.findUniqueOrThrow({
          where: { id: simulatorId },
          select: { activeExamVersionId: true },
        })
      ).activeExamVersionId,
    ).toBe(versionId);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 8, required: 5 });

    await signInAs('STUDENT');
    const { response } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.examVersion.findUniqueOrThrow({
          where: { id: versionId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });
});

describe('PATCH /api/admin/simulators/[simulatorId]', () => {
  it('refuses to activate a version from another simulator through the settings form', async () => {
    await signInAs('ADMIN');
    const foreign = await buildPublishableVersion({ bankSize: 8, required: 5 });
    await versionAction(foreign.versionId, 'publish');

    const { simulatorId } = await createSimulator();
    const { response, payload } = await patchSimulator(simulatorId, {
      track: 'BOTH',
      fullSimulationEnabled: true,
      trainingModeEnabled: false,
      introVideoAssetId: null,
      activeExamVersionId: foreign.versionId,
    });

    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('exam_version_not_found');
    expect(
      (
        await prisma.examSimulator.findUniqueOrThrow({
          where: { id: simulatorId },
          select: { activeExamVersionId: true },
        })
      ).activeExamVersionId,
    ).toBeNull();
  });

  it('refuses a simulator with neither attempt mode enabled', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    const { response, payload } = await patchSimulator(simulatorId, {
      track: 'BOTH',
      fullSimulationEnabled: false,
      trainingModeEnabled: false,
      introVideoAssetId: null,
      activeExamVersionId: null,
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('simulator_modes_all_disabled');
  });

  /**
   * A `PATCH` that names three fields must change three fields.
   *
   * The schema used to `.default(null)` the optional keys, so a body of
   * `{"track":"BOTH"}` parsed into a *deactivation* of the live exam version,
   * a cleared intro video and training mode switched off — three pieces of live
   * state destroyed by a request that mentioned none of them, plus an
   * `exam_version.deactivated` audit row recording a decision nobody took.
   */
  it('leaves an omitted field alone instead of clearing it', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 8,
      required: 5,
    });
    await versionAction(versionId, 'publish');
    await patchSimulator(simulatorId, {
      track: 'BOTH',
      fullSimulationEnabled: true,
      trainingModeEnabled: true,
      introVideoAssetId: null,
      activeExamVersionId: versionId,
    });

    // A partial body: legitimate for a PATCH, and the shape any non-form caller
    // would send.
    const { response } = await patchSimulator(simulatorId, { track: 'BOTH' });
    expect(response.status).toBe(200);

    const after = await prisma.examSimulator.findUniqueOrThrow({
      where: { id: simulatorId },
      select: { activeExamVersionId: true, trainingModeEnabled: true },
    });
    expect(after.activeExamVersionId).toBe(versionId);
    expect(after.trainingModeEnabled).toBe(true);

    // And no phantom decision in the trail.
    expect(
      await prisma.auditLog.count({
        where: { targetId: versionId, action: 'exam_version.deactivated' },
      }),
    ).toBe(0);
  });

  /**
   * The track freeze used to key on the attempt count alone, which is zero for
   * every simulator that has not launched yet — precisely the moment an
   * administrator narrows the track. Narrowing it invalidates the coverage
   * report the active version was published against: every rule that named no
   * track of its own inherits the simulator's, so the eligible pool shrinks and
   * the first student gets a shortage while the screen still shows the version
   * as published, active and covered.
   */
  it('refuses a track change while a version is active, even with no attempts', async () => {
    await signInAs('ADMIN');
    const { simulatorId, versionId } = await buildPublishableVersion({
      bankSize: 8,
      required: 5,
    });
    await versionAction(versionId, 'publish');
    await patchSimulator(simulatorId, { track: 'BOTH', activeExamVersionId: versionId });

    expect(await prisma.examAttempt.count({ where: { simulatorId } })).toBe(0);

    const narrowed = await patchSimulator(simulatorId, { track: 'SCIENTIFIC' });
    expect(narrowed.response.status).toBe(409);
    expect(narrowed.payload.error?.code).toBe('simulator_track_frozen_while_active');
    expect(
      (
        await prisma.examSimulator.findUniqueOrThrow({
          where: { id: simulatorId },
          select: { track: true },
        })
      ).track,
    ).toBe('BOTH');

    // Deactivating and retracking in one save is still allowed: the next
    // activation re-checks coverage against the new track.
    const released = await patchSimulator(simulatorId, {
      track: 'SCIENTIFIC',
      activeExamVersionId: null,
    });
    expect(released.response.status).toBe(200);
    const after = await prisma.examSimulator.findUniqueOrThrow({
      where: { id: simulatorId },
      select: { track: true, activeExamVersionId: true },
    });
    expect(after).toEqual({ track: 'SCIENTIFIC', activeExamVersionId: null });
  });
});

describe('DELETE /api/admin/exam-versions/[versionId]', () => {
  it('deletes an untouched draft along with its sections and rules', async () => {
    await signInAs('ADMIN');
    const { versionId, sectionId } = await buildPublishableVersion({ bankSize: 6, required: 4 });

    const { response } = await deleteVersion(versionId);

    expect(response.status).toBe(200);
    expect(await prisma.examVersion.count({ where: { id: versionId } })).toBe(0);
    expect(await prisma.examSection.count({ where: { id: sectionId } })).toBe(0);
    // The trail outlives the row it describes.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'ExamVersion', targetId: versionId, action: 'exam_version.deleted' },
      }),
    ).toBe(1);
  });

  it('refuses to delete a published version and suggests retiring it', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildPublishableVersion({ bankSize: 8, required: 5 });
    await versionAction(versionId, 'publish');

    const { response, payload } = await deleteVersion(versionId);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('exam_version_delete_blocked');
    expect(await prisma.examVersion.count({ where: { id: versionId } })).toBe(1);
  });
});

describe('sections and blueprint rules', () => {
  it('refuses a rule that sets both a percentage and an explicit count', async () => {
    await signInAs('ADMIN');
    const { sectionId } = await buildPublishableVersion({ bankSize: 6, required: 4 });

    const { response, payload } = await postRule(sectionId, {
      domain: 'ALGEBRA',
      subskill: null,
      difficulty: null,
      track: null,
      percentage: 40,
      questionCount: 2,
    });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('rule_share_conflict');
  });

  it('refuses percentages that add to more than a hundred', async () => {
    await signInAs('ADMIN');
    const { sectionId } = await buildPublishableVersion({ bankSize: 6, required: 4 });

    // The fixture already holds a 100% rule.
    const { response, payload } = await postRule(sectionId, {
      domain: 'ALGEBRA',
      subskill: null,
      difficulty: null,
      track: null,
      percentage: 10,
      questionCount: null,
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('percentage_sum_invalid');
  });

  it('reorders sections as a whole list and refuses a stale one', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();
    const created = await postVersion(simulatorId, versionBody());
    const versionId = created.payload.data?.id as string;

    await postSection(versionId, sectionBody({ title: 'الأول' }));
    const second = await postSection(versionId, sectionBody({ title: 'الثاني' }));
    const sections = (second.payload.data as unknown as VersionPayload).sections;

    const reordered = await reorderSections(versionId, [sections[1]!.id, sections[0]!.id]);
    expect(reordered.response.status).toBe(200);
    expect((reordered.payload.data as unknown as VersionPayload).sections[0]!.title).toBe('الثاني');

    // One row against the container, not one per section that moved.
    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'ExamVersion',
          targetId: versionId,
          action: 'exam_section.reordered',
        },
      }),
    ).toBe(1);

    const stale = await reorderSections(versionId, [sections[0]!.id]);
    expect(stale.response.status).toBe(409);
    expect(stale.payload.error?.code).toBe('reorder_stale');
  });

  it('answers a malformed version id with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await patchVersion(
      'not-a-uuid',
      versionBody({ mode: undefined }),
    );

    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('exam_version_not_found');
  });
});

describe('GET /api/admin/simulators', () => {
  it('filters on the server and degrades a malformed query to page one', async () => {
    await signInAs('ADMIN');
    const { GET } = await import('@/app/api/admin/simulators/route');

    const response = await GET(
      new Request(`${ORIGIN}/api/admin/simulators?page=abc&track=nonsense&perPage=99999`),
    );
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { GET } = await import('@/app/api/admin/simulators/route');
    const response = await GET(new Request(`${ORIGIN}/api/admin/simulators`));
    expect(response.status).toBe(403);
  });
});

/**
 * Publishing a `FIXED` version.
 *
 * The mode used to be accepted by every precondition and implemented by none of
 * them: `assertVersionPublishable` returned early for `FIXED` — skipping the
 * coverage report entirely — and the engine ran the blueprint allocator anyway,
 * so a version that published cleanly refused every student who pressed ابدأ.
 * The engine now has a fixed path; these are the checks that stop a version
 * reaching it in a state it cannot honour.
 */
describe('publishing a FIXED exam version', () => {
  it('publishes a complete fixed list', async () => {
    await signInAs('ADMIN');
    const { versionId } = await buildFixedVersion({ perSection: 3 });

    const { response, payload } = await versionAction(versionId, 'publish');

    expect(response.status).toBe(200);
    expect((payload.data as { version: { status: string } }).version.status).toBe('PUBLISHED');
  });

  it('refuses a section holding fewer questions than it declares', async () => {
    await signInAs('ADMIN');
    const { versionId, sectionIds, questionIds } = await buildFixedVersion({ perSection: 3 });

    await patchSection(sectionIds[0]!, {
      op: 'questions',
      action: 'remove',
      questionId: questionIds[0]!,
    });

    const { response, payload } = await versionAction(versionId, 'publish');
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('fixed_questions_required');
  });

  /**
   * A draft can sit for weeks, and the bank moves underneath it. Without this
   * check the version publishes as healthy and then fails for every student —
   * exactly the failure the publication preconditions exist to catch while it is
   * still an administrator's problem.
   */
  it('refuses when a pinned question has been retired since it was attached', async () => {
    await signInAs('ADMIN');
    const { versionId, questionIds } = await buildFixedVersion({ perSection: 3 });

    await prisma.question.update({
      where: { id: questionIds[1]! },
      data: { workflow: 'RETIRED' },
    });

    const { response, payload } = await versionAction(versionId, 'publish');
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('fixed_questions_not_published');
    expect(
      (
        await prisma.examVersion.findUniqueOrThrow({
          where: { id: versionId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });

  /**
   * `@@unique([examSectionId, questionId])` prevents a repeat inside one section
   * and says nothing about two. A question pinned into sections 1 and 2 would be
   * delivered twice in one paper — a shorter exam than the version describes.
   */
  it('refuses the same question pinned into two sections', async () => {
    await signInAs('ADMIN');
    const { versionId, sectionIds, questionIds } = await buildFixedVersion({
      sections: 2,
      perSection: 2,
    });

    // Swap one of section 2's questions for one of section 1's.
    await patchSection(sectionIds[1]!, {
      op: 'questions',
      action: 'remove',
      questionId: questionIds[2]!,
    });
    await patchSection(sectionIds[1]!, {
      op: 'questions',
      action: 'add',
      questionId: questionIds[0]!,
    });

    const { response, payload } = await versionAction(versionId, 'publish');
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('fixed_questions_duplicated');
  });
});

/**
 * `nextVersionNumber` is an aggregate and takes no row lock, so two creations
 * racing on one simulator both read the same maximum and both try to insert it.
 * The loser used to escape `@@unique([simulatorId, versionNumber])` as an
 * unexplained 500. Whether the race lands on any given run is not something a
 * test can guarantee — what it can guarantee is that neither outcome is a fault.
 */
describe('concurrent version creation', () => {
  it('never answers a version-number collision with a server error', async () => {
    await signInAs('ADMIN');
    const { simulatorId } = await createSimulator();

    const results = await Promise.all([
      postVersion(simulatorId, versionBody()),
      postVersion(simulatorId, versionBody()),
      postVersion(simulatorId, versionBody()),
    ]);

    for (const { response, payload } of results) {
      expect([201, 409]).toContain(response.status);
      if (response.status === 409) {
        expect(payload.error?.code).toBe('exam_version_number_conflict');
      }
    }

    // Whatever survived, the numbering is still unique — the constraint did its
    // job and nothing wrote a duplicate.
    const numbers = (
      await prisma.examVersion.findMany({
        where: { simulatorId },
        select: { versionNumber: true },
      })
    ).map((row) => row.versionNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
