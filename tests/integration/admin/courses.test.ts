import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The course-builder administration routes, exercised through the handlers.
 *
 * Only the session guard is stubbed. The Zod schemas, the origin check, the
 * service, the audit writes and the database are all real, because every
 * property worth asserting here is a property of the whole request pipeline:
 * "an edit form cannot publish a lesson", "a reorder applies whole or not at
 * all", "a lesson somebody watched cannot be deleted", "a student gets 403".
 * Asserting any of those one layer below the route would prove nothing about the
 * route.
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

import { prisma } from '@/lib/db';

const ORIGIN = 'http://localhost:3000';

const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdQuestionIds: string[] = [];

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
  const email = `admin-courses-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

/**
 * A course product with its `Course` row, written straight to the tables.
 *
 * `createProduct` already owns that pairing and the catalogue suite proves it;
 * what matters here is only the tree hanging beneath the course, so the fixture
 * is created directly rather than pushed through a second screen's routes.
 */
async function createCourse() {
  const product = await prisma.product.create({
    data: {
      type: 'COURSE',
      slug: `admin-course-test-${randomUUID()}`.slice(0, 60),
      title: 'دورة اختبارية',
      shortDescription: 'وصف مختصر صالح لمنتج اختباري.',
      priceHalalas: 49_900,
      currency: 'SAR',
      status: 'DRAFT',
      course: { create: {} },
    },
    select: { id: true, course: { select: { id: true } } },
  });
  createdProductIds.push(product.id);
  return { productId: product.id, courseId: product.course!.id };
}

/** A published bank question, so a lesson quiz has something legal to reference. */
async function createPublishedQuestion() {
  const question = await prisma.question.create({
    data: {
      stem: { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'سؤال اختباري' }] }] },
      track: 'BOTH',
      domain: 'ARITHMETIC',
      difficulty: 'EASY',
      workflow: 'PUBLISHED',
      currentVersion: 1,
      authorOrLicensor: 'المنصة',
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  createdQuestionIds.push(question.id);
  return question.id;
}

async function createDraftQuestion() {
  const question = await prisma.question.create({
    data: {
      stem: { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'مسودة سؤال' }] }] },
      track: 'BOTH',
      domain: 'ALGEBRA',
      difficulty: 'MEDIUM',
      workflow: 'DRAFT',
      authorOrLicensor: 'المنصة',
    },
    select: { id: true },
  });
  createdQuestionIds.push(question.id);
  return question.id;
}

// ── Route wrappers ───────────────────────────────────────────────────────

async function postModule(courseId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/courses/[courseId]/modules/route');
  const response = await POST(jsonRequest(`/api/admin/courses/${courseId}/modules`, 'POST', body), {
    params: Promise.resolve({ courseId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function reorderModules(courseId: string, ids: string[]) {
  const { PATCH } = await import('@/app/api/admin/courses/[courseId]/modules/route');
  const response = await PATCH(
    jsonRequest(`/api/admin/courses/${courseId}/modules`, 'PATCH', { ids }),
    { params: Promise.resolve({ courseId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function patchModule(moduleId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/modules/[moduleId]/route');
  const response = await PATCH(jsonRequest(`/api/admin/modules/${moduleId}`, 'PATCH', body), {
    params: Promise.resolve({ moduleId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function deleteModuleRoute(moduleId: string) {
  const { DELETE } = await import('@/app/api/admin/modules/[moduleId]/route');
  const response = await DELETE(jsonRequest(`/api/admin/modules/${moduleId}`, 'DELETE'), {
    params: Promise.resolve({ moduleId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function postLesson(moduleId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/modules/[moduleId]/lessons/route');
  const response = await POST(jsonRequest(`/api/admin/modules/${moduleId}/lessons`, 'POST', body), {
    params: Promise.resolve({ moduleId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function reorderLessons(moduleId: string, ids: string[]) {
  const { PATCH } = await import('@/app/api/admin/modules/[moduleId]/lessons/route');
  const response = await PATCH(
    jsonRequest(`/api/admin/modules/${moduleId}/lessons`, 'PATCH', { ids }),
    { params: Promise.resolve({ moduleId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function patchLesson(lessonId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/lessons/[lessonId]/route');
  const response = await PATCH(jsonRequest(`/api/admin/lessons/${lessonId}`, 'PATCH', body), {
    params: Promise.resolve({ lessonId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function deleteLessonRoute(lessonId: string) {
  const { DELETE } = await import('@/app/api/admin/lessons/[lessonId]/route');
  const response = await DELETE(jsonRequest(`/api/admin/lessons/${lessonId}`, 'DELETE'), {
    params: Promise.resolve({ lessonId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function putQuiz(lessonId: string, body: unknown) {
  const { PUT } = await import('@/app/api/admin/lessons/[lessonId]/quiz/route');
  const response = await PUT(jsonRequest(`/api/admin/lessons/${lessonId}/quiz`, 'PUT', body), {
    params: Promise.resolve({ lessonId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

/** A valid lesson body. Overrides are applied on top. */
function lessonBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'درس اختباري',
    content: 'نص مرافق كافٍ للنشر.',
    videoAssetId: null,
    durationSec: 600,
    isPreview: false,
    completionThresholdPercent: null,
    ...overrides,
  };
}

/** A module with two lessons, the shape most of the assertions below need. */
async function seedModuleWithLessons(courseId: string, titles: string[]) {
  const created = await postModule(courseId, { title: 'وحدة اختبارية' });
  const moduleId = created.payload.data?.id as string;

  const lessonIds: string[] = [];
  for (const title of titles) {
    const lesson = await postLesson(moduleId, lessonBody({ title }));
    lessonIds.push(lesson.payload.data?.id as string);
  }

  return { moduleId, lessonIds };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE lessons` here would
 * delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  const modules = await prisma.courseModule.findMany({
    where: { course: { productId: { in: createdProductIds } } },
    select: { id: true },
  });
  const moduleIds = modules.map((module) => module.id);

  const lessons = await prisma.lesson.findMany({
    where: { moduleId: { in: moduleIds } },
    select: { id: true },
  });
  const lessonIds = lessons.map((lesson) => lesson.id);

  const quizzes = await prisma.lessonQuiz.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true },
  });
  const quizIds = quizzes.map((quiz) => quiz.id);

  await prisma.lessonQuizAnswer.deleteMany({ where: { attempt: { quizId: { in: quizIds } } } });
  await prisma.lessonQuizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
  await prisma.lessonQuizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
  await prisma.lessonQuiz.deleteMany({ where: { id: { in: quizIds } } });
  await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.playbackSession.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
  await prisma.courseModule.deleteMany({ where: { id: { in: moduleIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.course.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.questionOption.deleteMany({ where: { questionId: { in: createdQuestionIds } } });
  await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('POST /api/admin/courses/[courseId]/modules', () => {
  it('creates a draft module at the end of the ordering and audits it', async () => {
    const admin = await signInAs('ADMIN');
    const { courseId } = await createCourse();

    const first = await postModule(courseId, { title: 'الوحدة الأولى' });
    expect(first.response.status).toBe(201);

    const second = await postModule(courseId, { title: 'الوحدة الثانية' });
    const secondId = second.payload.data?.id as string;

    const stored = await prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, status: true, position: true },
    });

    // Never born published: the publication precondition below would otherwise
    // be optional.
    expect(stored.map((module) => module.status)).toEqual(['DRAFT', 'DRAFT']);
    expect(stored.map((module) => module.title)).toEqual(['الوحدة الأولى', 'الوحدة الثانية']);
    expect(stored[1]?.id).toBe(secondId);
    expect(stored[1]!.position).toBeGreaterThan(stored[0]!.position);

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'CourseModule', targetId: secondId, action: 'module.created' },
      select: { actorId: true, actorEmail: true },
    });
    expect(audit?.actorId).toBe(admin.id);
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(audit?.actorEmail).toBe(admin.email);
  });

  it('answers a signed-in student with 403 and writes nothing', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();

    await signInAs('STUDENT');
    const { response } = await postModule(courseId, { title: 'وحدة ممنوعة' });

    expect(response.status).toBe(403);
    expect(await prisma.courseModule.count({ where: { courseId } })).toBe(0);
  });

  it('rejects a cross-site request before anything is written', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();

    const { POST } = await import('@/app/api/admin/courses/[courseId]/modules/route');
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/courses/${courseId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify({ title: 'وحدة من موقع آخر' }),
      }),
      { params: Promise.resolve({ courseId }) },
    );

    expect(response.status).toBe(403);
    expect(await prisma.courseModule.count({ where: { courseId } })).toBe(0);
  });

  it('answers an unknown course with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const unknown = await postModule(randomUUID(), { title: 'وحدة يتيمة' });
    expect(unknown.response.status).toBe(404);

    const malformed = await postModule('not-a-uuid', { title: 'وحدة يتيمة' });
    expect(malformed.response.status).toBe(404);
    expect(malformed.payload.error?.code).toBe('course_not_found');
  });
});

describe('reordering', () => {
  it('applies a whole module ordering in one request', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();

    const ids: string[] = [];
    for (const title of ['أ', 'ب', 'ج']) {
      const created = await postModule(courseId, { title: `وحدة ${title}` });
      ids.push(created.payload.data?.id as string);
    }

    const reversed = [...ids].reverse();
    const { response } = await reorderModules(courseId, reversed);
    expect(response.status).toBe(200);

    const stored = await prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    expect(stored.map((module) => module.id)).toEqual(reversed);
    // Dense and gap-free, so the next insert at the end is always max + 1.
    expect(stored.map((module) => module.position)).toEqual([0, 1, 2]);

    // One row against the course, not one per module that moved.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Course', targetId: courseId, action: 'module.reordered' },
      }),
    ).toBe(1);
  });

  it('applies a whole lesson ordering and leaves the module alone', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, [
      'الدرس الأول',
      'الدرس الثاني',
      'الدرس الثالث',
    ]);

    const rotated = [lessonIds[2]!, lessonIds[0]!, lessonIds[1]!];
    const { response } = await reorderLessons(moduleId, rotated);
    expect(response.status).toBe(200);

    const stored = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    expect(stored.map((lesson) => lesson.id)).toEqual(rotated);
    expect(stored.map((lesson) => lesson.position)).toEqual([0, 1, 2]);

    expect(
      await prisma.auditLog.count({
        where: { targetType: 'CourseModule', targetId: moduleId, action: 'lesson.reordered' },
      }),
    ).toBe(1);
  });

  it('refuses a stale list rather than applying half of it', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, ['أول', 'ثانٍ']);

    const before = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    // A list that names only one of the two lessons: somebody added or removed a
    // row since the page was drawn.
    const { response, payload } = await reorderLessons(moduleId, [lessonIds[1]!]);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('reorder_stale');

    const after = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    expect(after).toEqual(before);
  });

  it('names the real mistake when a lesson belongs to another module', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const first = await seedModuleWithLessons(courseId, ['درس الوحدة الأولى']);
    const second = await seedModuleWithLessons(courseId, ['درس الوحدة الثانية']);

    const { response, payload } = await reorderLessons(first.moduleId, [second.lessonIds[0]!]);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('lesson_module_mismatch');
    expect(payload.error?.message).toBe('لا يمكن ترتيب درس داخل وحدة لا ينتمي إليها.');
  });

  it('rejects a list naming the same id twice', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, ['أ', 'ب']);

    const { response } = await reorderLessons(moduleId, [lessonIds[0]!, lessonIds[0]!]);
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/admin/lessons/[lessonId]', () => {
  it('saves an edit and cannot publish through it', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;

    const { response } = await patchLesson(lessonId, {
      intent: 'update',
      moduleId,
      // Stripped by the schema: the `update` variant has no `status` key, so an
      // edit form physically cannot publish.
      status: 'PUBLISHED',
      ...lessonBody({ title: 'عنوان محدَّث' }),
    });

    expect(response.status).toBe(200);
    const stored = await prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { title: true, status: true },
    });
    expect(stored.title).toBe('عنوان محدَّث');
    expect(stored.status).toBe('DRAFT');
  });

  it('moves a lesson to a sibling module and files it at the end', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const source = await seedModuleWithLessons(courseId, ['درس منقول']);
    const target = await seedModuleWithLessons(courseId, ['درس مقيم', 'درس آخر']);

    const { response } = await patchLesson(source.lessonIds[0]!, {
      intent: 'update',
      moduleId: target.moduleId,
      ...lessonBody({ title: 'درس منقول' }),
    });

    expect(response.status).toBe(200);
    const stored = await prisma.lesson.findMany({
      where: { moduleId: target.moduleId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    // Last, because its old index means nothing in a list it was never part of.
    expect(stored.at(-1)?.id).toBe(source.lessonIds[0]);
  });

  it('refuses to publish a lesson with neither a video nor any text', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const emptyModule = await postModule(courseId, { title: 'وحدة' });
    const moduleId = emptyModule.payload.data?.id as string;

    const created = await postLesson(moduleId, lessonBody({ content: null, durationSec: null }));
    const lessonId = created.payload.data?.id as string;

    const { response, payload } = await patchLesson(lessonId, {
      intent: 'transition',
      status: 'PUBLISHED',
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('lesson_incomplete');
    expect(
      (
        await prisma.lesson.findUniqueOrThrow({
          where: { id: lessonId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });

  it('publishes a lesson, and reports a repeat as no change', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;

    const first = await patchLesson(lessonId, { intent: 'transition', status: 'PUBLISHED' });
    expect(first.payload.data?.changed).toBe(true);

    const second = await patchLesson(lessonId, { intent: 'transition', status: 'PUBLISHED' });
    expect(second.payload.data?.changed).toBe(false);

    // Answered honestly rather than re-stamped: one decision, one row.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Lesson', targetId: lessonId, action: 'lesson.published' },
      }),
    ).toBe(1);
  });
});

describe('module publication', () => {
  it('refuses a module with no published lesson, and accepts one with', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, ['درس']);

    const refused = await patchModule(moduleId, { intent: 'transition', status: 'PUBLISHED' });
    expect(refused.response.status).toBe(409);
    expect(refused.payload.error?.code).toBe('module_incomplete');

    await patchLesson(lessonIds[0]!, { intent: 'transition', status: 'PUBLISHED' });

    const accepted = await patchModule(moduleId, { intent: 'transition', status: 'PUBLISHED' });
    expect(accepted.response.status).toBe(200);
    expect(
      (
        await prisma.courseModule.findUniqueOrThrow({
          where: { id: moduleId },
          select: { status: true },
        })
      ).status,
    ).toBe('PUBLISHED');
  });
});

describe('deletion safety', () => {
  it('refuses to delete a lesson a student has progress on, and suggests archiving', async () => {
    const admin = await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس مشاهَد']);
    const lessonId = lessonIds[0]!;

    await prisma.lessonProgress.create({
      data: { userId: admin.id, lessonId, watchedSec: 120, furthestPositionSec: 120 },
    });

    const { response, payload } = await deleteLessonRoute(lessonId);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('lesson_delete_blocked');
    expect(payload.error?.message).toContain('أرشفه');
    expect(await prisma.lesson.count({ where: { id: lessonId } })).toBe(1);
    // Nothing was recorded, because nothing happened.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Lesson', targetId: lessonId, action: 'lesson.deleted' },
      }),
    ).toBe(0);
  });

  it('refuses to delete a module whose descendant lesson has progress', async () => {
    const admin = await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { moduleId, lessonIds } = await seedModuleWithLessons(courseId, ['أول', 'ثانٍ']);

    await prisma.lessonProgress.create({
      data: { userId: admin.id, lessonId: lessonIds[1]!, watchedSec: 30, furthestPositionSec: 30 },
    });

    const { response, payload } = await deleteModuleRoute(moduleId);

    // A module delete cascades to its lessons, so it has to answer for every
    // descendant before it starts.
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('lesson_delete_blocked');
    expect(await prisma.courseModule.count({ where: { id: moduleId } })).toBe(1);
    expect(await prisma.lesson.count({ where: { moduleId } })).toBe(2);
  });

  it('deletes an untouched lesson along with its quiz', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس بلا تقدّم']);
    const lessonId = lessonIds[0]!;
    const questionId = await createPublishedQuestion();

    await putQuiz(lessonId, { questions: [{ questionId, points: 1 }] });

    const { response } = await deleteLessonRoute(lessonId);

    expect(response.status).toBe(200);
    expect(await prisma.lesson.count({ where: { id: lessonId } })).toBe(0);
    expect(await prisma.lessonQuiz.count({ where: { lessonId } })).toBe(0);
    // The trail outlives the row it describes.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Lesson', targetId: lessonId, action: 'lesson.deleted' },
      }),
    ).toBe(1);
  });

  it('answers a signed-in student with 403 and leaves the lesson in place', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);

    await signInAs('STUDENT');
    const { response } = await deleteLessonRoute(lessonIds[0]!);

    expect(response.status).toBe(403);
    expect(await prisma.lesson.count({ where: { id: lessonIds[0]! } })).toBe(1);
  });
});

describe('PUT /api/admin/lessons/[lessonId]/quiz', () => {
  it('creates a quiz, orders its questions and audits the creation', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس باختبار']);
    const lessonId = lessonIds[0]!;

    const firstQuestion = await createPublishedQuestion();
    const secondQuestion = await createPublishedQuestion();

    const { response, payload } = await putQuiz(lessonId, {
      feedbackMode: 'IMMEDIATE',
      maxAttempts: 3,
      questions: [
        { questionId: secondQuestion, points: 2 },
        { questionId: firstQuestion, points: 1 },
      ],
    });

    expect(response.status).toBe(201);
    const quizId = payload.data?.id as string;

    const stored = await prisma.lessonQuizQuestion.findMany({
      where: { quizId },
      orderBy: { position: 'asc' },
      select: { questionId: true, position: true, points: true },
    });
    expect(stored).toEqual([
      { questionId: secondQuestion, position: 0, points: 2 },
      { questionId: firstQuestion, position: 1, points: 1 },
    ]);

    expect(
      await prisma.auditLog.count({
        where: { targetType: 'LessonQuiz', targetId: quizId, action: 'lesson_quiz.created' },
      }),
    ).toBe(1);
  });

  it('refuses a question that is already in the quiz', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;
    const questionId = await createPublishedQuestion();

    const { response, payload } = await putQuiz(lessonId, {
      questions: [
        { questionId, points: 1 },
        { questionId, points: 2 },
      ],
    });

    // Caught before anything is written, so `@@unique([quizId, questionId])`
    // never has to surface as a 500 with the selection lost.
    expect(response.status).toBe(400);
    expect(payload.error?.details?.questions).toBe(
      'هذا السؤال مضاف بالفعل إلى هذا الاختبار القصير',
    );
    expect(await prisma.lessonQuiz.count({ where: { lessonId } })).toBe(0);
  });

  it('refuses a question that is not published, and writes no quiz', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;
    const draftQuestion = await createDraftQuestion();

    const { response, payload } = await putQuiz(lessonId, {
      questions: [{ questionId: draftQuestion, points: 1 }],
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('quiz_question_not_publishable');
    expect(await prisma.lessonQuiz.count({ where: { lessonId } })).toBe(0);
  });

  it('replaces the question set and records the membership change once', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;

    const kept = await createPublishedQuestion();
    const dropped = await createPublishedQuestion();
    const added = await createPublishedQuestion();

    const created = await putQuiz(lessonId, {
      questions: [
        { questionId: kept, points: 1 },
        { questionId: dropped, points: 1 },
      ],
    });
    const quizId = created.payload.data?.id as string;

    const { response } = await putQuiz(lessonId, {
      questions: [
        { questionId: kept, points: 1 },
        { questionId: added, points: 1 },
      ],
    });
    expect(response.status).toBe(200);

    const stored = await prisma.lessonQuizQuestion.findMany({
      where: { quizId },
      orderBy: { position: 'asc' },
      select: { questionId: true },
    });
    expect(stored.map((row) => row.questionId)).toEqual([kept, added]);

    // One action for both directions, with the direction in the metadata.
    const audit = await prisma.auditLog.findFirst({
      where: {
        targetType: 'LessonQuiz',
        targetId: quizId,
        action: 'lesson_quiz.questions_changed',
      },
      select: { metadata: true },
    });
    expect(audit?.metadata).toMatchObject({ added: [added], removed: [dropped] });
  });

  it('refuses to detach a quiz somebody has sat', async () => {
    const admin = await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const lessonId = lessonIds[0]!;
    const questionId = await createPublishedQuestion();

    const created = await putQuiz(lessonId, { questions: [{ questionId, points: 1 }] });
    const quizId = created.payload.data?.id as string;

    await prisma.lessonQuizAttempt.create({
      data: { quizId, userId: admin.id, attemptNumber: 1, totalCount: 1 },
    });

    const { DELETE } = await import('@/app/api/admin/lessons/[lessonId]/quiz/route');
    const response = await DELETE(jsonRequest(`/api/admin/lessons/${lessonId}/quiz`, 'DELETE'), {
      params: Promise.resolve({ lessonId }),
    });
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('quiz_delete_blocked');
    expect(await prisma.lessonQuiz.count({ where: { id: quizId } })).toBe(1);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();
    const { lessonIds } = await seedModuleWithLessons(courseId, ['درس']);
    const questionId = await createPublishedQuestion();

    await signInAs('STUDENT');
    const { response } = await putQuiz(lessonIds[0]!, {
      questions: [{ questionId, points: 1 }],
    });

    expect(response.status).toBe(403);
    expect(await prisma.lessonQuiz.count({ where: { lessonId: lessonIds[0]! } })).toBe(0);
  });
});

describe('PATCH /api/admin/courses/[courseId]', () => {
  it('saves the course settings without touching the product', async () => {
    await signInAs('ADMIN');
    const { courseId, productId } = await createCourse();

    const { PATCH } = await import('@/app/api/admin/courses/[courseId]/route');
    const response = await PATCH(
      jsonRequest(`/api/admin/courses/${courseId}`, 'PATCH', {
        category: 'كمي',
        level: 'تأسيسي',
        completionThresholdPercent: 75,
        // Stripped by the schema: the catalogue owns these, and a second writer
        // would make the two screens disagree.
        title: 'عنوان مسروق',
        priceHalalas: 1,
      }),
      { params: Promise.resolve({ courseId }) },
    );

    expect(response.status).toBe(200);

    const course = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { category: true, level: true, completionThresholdPercent: true },
    });
    expect(course).toEqual({
      category: 'كمي',
      level: 'تأسيسي',
      completionThresholdPercent: 75,
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { title: true, priceHalalas: true },
    });
    expect(product).toEqual({ title: 'دورة اختبارية', priceHalalas: 49_900 });
  });

  it('refuses a threshold outside 1–100', async () => {
    await signInAs('ADMIN');
    const { courseId } = await createCourse();

    const { PATCH } = await import('@/app/api/admin/courses/[courseId]/route');
    const response = await PATCH(
      jsonRequest(`/api/admin/courses/${courseId}`, 'PATCH', {
        category: null,
        level: null,
        completionThresholdPercent: 0,
      }),
      { params: Promise.resolve({ courseId }) },
    );

    expect(response.status).toBe(400);
    expect(
      (
        await prisma.course.findUniqueOrThrow({
          where: { id: courseId },
          select: { completionThresholdPercent: true },
        })
      ).completionThresholdPercent,
    ).toBe(90);
  });
});

describe('GET /api/admin/courses', () => {
  it('searches and filters on the server', async () => {
    await signInAs('ADMIN');
    const marker = randomUUID().slice(0, 8);

    const withLessons = await createCourse();
    await prisma.product.update({
      where: { id: withLessons.productId },
      data: { title: `دورة ${marker} بها دروس` },
    });
    await seedModuleWithLessons(withLessons.courseId, ['درس']);

    const empty = await createCourse();
    await prisma.product.update({
      where: { id: empty.productId },
      data: { title: `دورة ${marker} فارغة` },
    });

    const { GET } = await import('@/app/api/admin/courses/route');

    const all = (await (
      await GET(new Request(`${ORIGIN}/api/admin/courses?q=${marker}`))
    ).json()) as Envelope;
    expect(all.data?.total).toBe(2);

    const onlyWithLessons = (await (
      await GET(new Request(`${ORIGIN}/api/admin/courses?q=${marker}&hasLessons=true`))
    ).json()) as Envelope;
    expect(onlyWithLessons.data?.total).toBe(1);
    expect((onlyWithLessons.data?.rows as Array<{ id: string }>)[0]?.id).toBe(withLessons.courseId);
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { GET } = await import('@/app/api/admin/courses/route');

    const response = await GET(
      new Request(`${ORIGIN}/api/admin/courses?page=abc&productStatus=nonsense&perPage=99999`),
    );
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { GET } = await import('@/app/api/admin/courses/route');
    const response = await GET(new Request(`${ORIGIN}/api/admin/courses`));
    expect(response.status).toBe(403);
  });
});
