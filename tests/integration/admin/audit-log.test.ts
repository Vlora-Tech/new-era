import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The audit log route, exercised through the handler itself.
 *
 * Only the session guard is stubbed. The Zod schema, the service and the
 * database are real, because every property worth asserting here belongs to the
 * whole pipeline: "a student cannot read the trail", "a Riyadh date window means
 * Riyadh days", "paging never drops a row", and — the one this screen exists for
 * — "there is no way to change what the trail says".
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
    // The real rule rather than a pass-through: "a student is refused" is one of
    // the things this file exists to prove, and the trail names every
    // administrator by address.
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
const createdAuditIds: string[] = [];

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorEmail: string | null;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
};

type Envelope = {
  ok: boolean;
  data?: { rows?: AuditRow[]; total?: number; page?: number; perPage?: number; pageCount?: number };
  error?: { code: string; message: string };
};

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const email = `admin-audit-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

/**
 * A trail row, written straight to the table.
 *
 * The write path belongs to every other administration suite — a product test
 * proves `product.created` lands. What matters here is only what the reading
 * screen does with rows that already exist, so they are created directly and
 * with the exact timestamps each case needs.
 */
async function writeRow(entry: {
  action: string;
  targetType: string;
  targetId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: unknown;
  createdAt?: Date;
}) {
  const row = await prisma.auditLog.create({
    data: {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      metadata: (entry.metadata ?? undefined) as never,
      requestId: randomUUID(),
      ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
    },
    select: { id: true },
  });
  createdAuditIds.push(row.id);
  return row;
}

async function listAuditLog(search: string) {
  const { GET } = await import('@/app/api/admin/audit-log/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/audit-log${search}`));
  return { response, payload: (await response.json()) as Envelope };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating the table: Vitest runs files in
 * parallel workers against one database, and every other admin suite writes real
 * audit rows while this one runs. A `TRUNCATE audit_logs` here would delete
 * another file's evidence mid-assertion.
 */
afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('GET /api/admin/audit-log', () => {
  it('lists newest first, with a tiebreak that keeps the order defined', async () => {
    const admin = await signInAs('ADMIN');
    const sameInstant = new Date('2026-07-01T10:00:00.000Z');

    await writeRow({
      action: 'product.created',
      targetType: 'Product',
      targetId: randomUUID(),
      actorId: admin.id,
      actorEmail: admin.email,
      createdAt: sameInstant,
    });
    await writeRow({
      action: 'product.published',
      targetType: 'Product',
      targetId: randomUUID(),
      actorId: admin.id,
      actorEmail: admin.email,
      createdAt: sameInstant,
    });
    await writeRow({
      action: 'product.updated',
      targetType: 'Product',
      targetId: randomUUID(),
      actorId: admin.id,
      actorEmail: admin.email,
      createdAt: new Date('2026-07-02T10:00:00.000Z'),
    });

    const { response, payload } = await listAuditLog(`?q=${encodeURIComponent(admin.email)}`);

    expect(response.status).toBe(200);
    expect(payload.data?.total).toBe(3);
    expect(payload.data?.rows?.[0]?.action).toBe('product.updated');

    // The two rows written in the same instant still come back in a defined
    // order — ids are uuid(7) and therefore time-ordered — so neither can appear
    // on two pages while the other appears on none.
    const tied = payload.data?.rows?.slice(1).map((row) => row.action);
    expect(tied).toEqual(['product.published', 'product.created']);
  });

  it('filters by a single action, and by the coarse group that contains it', async () => {
    const admin = await signInAs('ADMIN');
    const actor = { actorId: admin.id, actorEmail: admin.email };

    await writeRow({ action: 'lesson.created', targetType: 'Lesson', ...actor });
    await writeRow({ action: 'module.published', targetType: 'CourseModule', ...actor });
    await writeRow({ action: 'lesson_quiz.created', targetType: 'LessonQuiz', ...actor });
    await writeRow({ action: 'order.cancelled', targetType: 'Order', ...actor });

    const scope = `q=${encodeURIComponent(admin.email)}`;

    const single = await listAuditLog(`?${scope}&action=lesson.created`);
    expect(single.payload.data?.total).toBe(1);

    // The course group covers `course.*`, `module.*`, `lesson.*` and
    // `lesson_quiz.*` — where an administrator would look for them, rather than
    // wherever the first dot-separated segment happens to fall. The order row is
    // excluded, and `lesson_quiz.created` is *included* despite `lesson.` being
    // a prefix of neither.
    const group = await listAuditLog(`?${scope}&actionGroup=course`);
    expect(group.payload.data?.total).toBe(3);
    expect(group.payload.data?.rows?.map((row) => row.action).sort()).toEqual([
      'lesson.created',
      'lesson_quiz.created',
      'module.published',
    ]);
  });

  it('filters by target type, and finds a target id exactly', async () => {
    const admin = await signInAs('ADMIN');
    const actor = { actorId: admin.id, actorEmail: admin.email };
    const productId = randomUUID();

    await writeRow({
      action: 'product.updated',
      targetType: 'Product',
      targetId: productId,
      ...actor,
    });
    await writeRow({
      action: 'question.published',
      targetType: 'Question',
      targetId: randomUUID(),
      ...actor,
    });

    const byType = await listAuditLog(`?q=${encodeURIComponent(admin.email)}&targetType=Question`);
    expect(byType.payload.data?.total).toBe(1);
    expect(byType.payload.data?.rows?.[0]?.targetType).toBe('Question');

    // The search box answers two questions: part of an actor's address, or a
    // target id in full. Pasting an id finds every action taken against it.
    const byTarget = await listAuditLog(`?q=${productId}`);
    expect(byTarget.payload.data?.total).toBe(1);
    expect(byTarget.payload.data?.rows?.[0]?.targetId).toBe(productId);
  });

  it('reads a date window as Riyadh days rather than UTC days', async () => {
    const admin = await signInAs('ADMIN');
    const actor = { actorId: admin.id, actorEmail: admin.email };

    // 22:00 UTC on the sixteenth is 01:00 Riyadh on the seventeenth.
    await writeRow({
      action: 'setting.updated',
      targetType: 'SiteSetting',
      targetId: 'contact.email',
      createdAt: new Date('2026-08-16T22:00:00.000Z'),
      ...actor,
    });
    // 21:30 UTC on the seventeenth is 00:30 Riyadh on the eighteenth.
    await writeRow({
      action: 'setting.updated',
      targetType: 'SiteSetting',
      targetId: 'contact.phone',
      createdAt: new Date('2026-08-17T21:30:00.000Z'),
      ...actor,
    });

    const { payload } = await listAuditLog(
      `?q=${encodeURIComponent(admin.email)}&from=2026-08-17&to=2026-08-17`,
    );

    // Read as UTC days this window would return the second row and drop the
    // first — an off-by-three-hours answer on the screen whose whole job is to
    // say exactly when something happened.
    expect(payload.data?.total).toBe(1);
    expect(payload.data?.rows?.[0]?.targetId).toBe('contact.email');
  });

  it('returns the stored metadata untouched, redaction marker included', async () => {
    const admin = await signInAs('ADMIN');
    const targetId = randomUUID();

    await writeRow({
      action: 'student.updated',
      targetType: 'User',
      targetId,
      actorId: admin.id,
      actorEmail: admin.email,
      metadata: {
        before: { name: 'اسم قديم', passwordHash: '[redacted]' },
        after: { name: 'اسم جديد', passwordHash: '[redacted]' },
      },
    });

    const { payload } = await listAuditLog(`?q=${targetId}`);
    const metadata = payload.data?.rows?.[0]?.metadata as {
      before: Record<string, string>;
      after: Record<string, string>;
    };

    expect(metadata.before.name).toBe('اسم قديم');
    expect(metadata.after.name).toBe('اسم جديد');
    // The sanitiser replaced the value at write time; the reader shows the
    // marker rather than pretending the field was absent.
    expect(metadata.after.passwordHash).toBe('[redacted]');
  });

  it('pages without repeating or losing a row', async () => {
    const admin = await signInAs('ADMIN');
    const actor = { actorId: admin.id, actorEmail: admin.email };

    for (let index = 0; index < 25; index += 1) {
      await writeRow({
        action: 'media.uploaded',
        targetType: 'MediaAsset',
        targetId: randomUUID(),
        createdAt: new Date('2026-06-01T08:00:00.000Z'),
        ...actor,
      });
    }

    const scope = `q=${encodeURIComponent(admin.email)}&perPage=10`;
    const first = await listAuditLog(`?${scope}&page=1`);
    const second = await listAuditLog(`?${scope}&page=2`);
    const third = await listAuditLog(`?${scope}&page=3`);

    expect(first.payload.data?.total).toBe(25);
    expect(first.payload.data?.pageCount).toBe(3);

    const seen = [
      ...(first.payload.data?.rows ?? []),
      ...(second.payload.data?.rows ?? []),
      ...(third.payload.data?.rows ?? []),
    ].map((row) => row.id);

    // All twenty-five rows share one timestamp, which is exactly the case an
    // unstable sort gets wrong.
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');

    const { response, payload } = await listAuditLog(
      '?page=abc&perPage=99999&targetType=nonsense&actionGroup=nope&from=2026-02-31',
    );

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(50);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await listAuditLog('');
    expect(response.status).toBe(403);
  });

  it('answers a signed-out request with 401', async () => {
    const { response } = await listAuditLog('');
    expect(response.status).toBe(401);
  });
});

describe('the audit trail is append-only', () => {
  /**
   * The point of the whole screen.
   *
   * `AuditLog` rows are written by `writeAuditLog` inside the transaction of the
   * change they describe, and nothing may edit or remove one afterwards. This
   * asserts the HTTP surface, which is where a future "let an administrator
   * clear the log" would arrive: if a verb appears here, this test fails before
   * anybody has to notice the endpoint in review.
   */
  it('exposes no verb other than GET', async () => {
    const routeModule = await import('@/app/api/admin/audit-log/route');
    const verbs = ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    for (const verb of verbs) {
      expect(routeModule).not.toHaveProperty(verb);
    }
    expect(routeModule).toHaveProperty('GET');
  });

  /**
   * And the read service offers nothing to call from a server action either.
   * The guard above only covers the route; this one covers the module a future
   * screen would import.
   */
  it('exposes no write function on the query service', async () => {
    const service = await import('@/services/audit/audit-query.service');
    const exported = Object.keys(service);

    expect(exported).toEqual(['listAuditLog']);
  });
});
