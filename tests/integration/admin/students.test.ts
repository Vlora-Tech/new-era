import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The student administration routes, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. The Zod schemas, the origin check, the
 * service, the audit writes and the database are all real, because every
 * property worth asserting here is a property of the whole request pipeline:
 * "a block retires every open session", "an administrator cannot block
 * themselves", "a student gets 403", "no response ever carries a password hash".
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

/**
 * An account, written straight to the table.
 *
 * `passwordHash` is a fixed non-hash string: nothing in this suite verifies a
 * password, and generating a real bcrypt hash per fixture would cost more than
 * every assertion here combined.
 */
async function createAccount(role: 'STUDENT' | 'ADMIN', overrides: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: `admin-students-${randomUUID()}@example.test`,
      name: 'حساب اختبار',
      passwordHash: 'not-a-real-hash',
      role,
      ...overrides,
    },
    select: { id: true, email: true, sessionVersion: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const user = await createAccount(role);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

async function getStudents(query = '') {
  const { GET } = await import('@/app/api/admin/students/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/students${query}`));
  return { response, payload: (await response.json()) as Envelope };
}

async function getStudent(studentId: string) {
  const { GET } = await import('@/app/api/admin/students/[studentId]/route');
  const response = await GET(jsonRequest(`/api/admin/students/${studentId}`, 'GET'), {
    params: Promise.resolve({ studentId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function blockStudent(studentId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/students/[studentId]/block/route');
  const response = await POST(jsonRequest(`/api/admin/students/${studentId}/block`, 'POST', body), {
    params: Promise.resolve({ studentId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function endSessions(studentId: string) {
  const { DELETE } = await import('@/app/api/admin/students/[studentId]/sessions/route');
  const response = await DELETE(
    jsonRequest(`/api/admin/students/${studentId}/sessions`, 'DELETE'),
    {
      params: Promise.resolve({ studentId }),
    },
  );
  return { response, payload: (await response.json()) as Envelope };
}

/**
 * Pay for the cold start here rather than inside the first `it`.
 *
 * A worker's first query carries the connection handshake and the query
 * engine's start-up, and the four route modules are transformed on first import.
 * On a cold machine that is several seconds, which against Vitest's 5 s *test*
 * budget turns a slow start into a failed assertion about student filtering —
 * a red suite that says nothing about the code. Hooks have their own, larger
 * budget, and this is genuinely set-up rather than part of any test.
 */
beforeAll(async () => {
  await prisma.$connect();
  await Promise.all([
    import('@/app/api/admin/students/route'),
    import('@/app/api/admin/students/[studentId]/route'),
    import('@/app/api/admin/students/[studentId]/block/route'),
    import('@/app/api/admin/students/[studentId]/sessions/route'),
  ]);
});

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE users` here would
 * delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { userId: { in: createdUserIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({
    where: { targetType: 'User', targetId: { in: createdUserIds } },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.consentRecord.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('GET /api/admin/students', () => {
  it('filters by account state and searches by address, on the server', async () => {
    await signInAs('ADMIN');
    const marker = randomUUID().slice(0, 8);

    const active = await createAccount('STUDENT', {
      email: `list-active-${marker}@example.test`,
      name: `طالب نشط ${marker}`,
    });
    await createAccount('STUDENT', {
      email: `list-blocked-${marker}@example.test`,
      name: `طالب موقوف ${marker}`,
      isBlocked: true,
      blockedReason: 'سبب اختباري',
      blockedAt: new Date(),
    });

    const all = await getStudents(`?q=${marker}`);
    expect(all.payload.data?.total).toBe(2);

    const onlyActive = await getStudents(`?q=${marker}&state=active`);
    expect(onlyActive.payload.data?.total).toBe(1);
    expect((onlyActive.payload.data?.rows as Array<{ id: string }>)[0]?.id).toBe(active.id);

    // An address pasted from a support message finds its own row.
    const byEmail = await getStudents(`?q=list-blocked-${marker}@example.test`);
    expect(byEmail.payload.data?.total).toBe(1);
  });

  it('never puts a password hash in the list payload', async () => {
    await signInAs('ADMIN');
    const marker = randomUUID().slice(0, 8);
    await createAccount('STUDENT', { email: `hash-check-${marker}@example.test` });

    const { payload } = await getStudents(`?q=${marker}`);
    const row = (payload.data?.rows as Array<Record<string, unknown>>)[0];

    expect(row).toBeDefined();
    // Asserted on the serialised body rather than on the row object: a column
    // added to the select later would show up here even if nobody updated a
    // property list in a test.
    expect(JSON.stringify(payload)).not.toContain('passwordHash');
    expect(row?.passwordHash).toBeUndefined();
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getStudents(
      '?page=abc&state=nonsense&perPage=99999&registeredFrom=2026-02-31',
    );

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await getStudents();
    expect(response.status).toBe(403);
  });
});

describe('GET /api/admin/students/[studentId]', () => {
  it('returns the record with its consents, and no password hash', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    await prisma.consentRecord.create({
      data: {
        userId: student.id,
        termsVersion: '2026-01-01',
        privacyVersion: '2026-01-01',
        acceptedAt: new Date(),
      },
    });

    const { response, payload } = await getStudent(student.id);

    expect(response.status).toBe(200);
    expect(payload.data?.email).toBe(student.email);
    expect((payload.data?.consents as unknown[]).length).toBe(1);
    expect(JSON.stringify(payload)).not.toContain('passwordHash');
    expect(JSON.stringify(payload)).not.toContain('not-a-real-hash');
  });

  it('answers a malformed id with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getStudent('not-a-uuid');
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('student_not_found');
  });

  it('answers an unknown account with 404', async () => {
    await signInAs('ADMIN');
    const { response } = await getStudent(randomUUID());
    expect(response.status).toBe(404);
  });
});

describe('POST /api/admin/students/[studentId]/block', () => {
  it('blocks the account, retires every open session, and audits it once', async () => {
    const admin = await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const { response } = await blockStudent(student.id, {
      blocked: true,
      reason: 'مشاركة الحساب مع أكثر من شخص',
    });

    expect(response.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { isBlocked: true, blockedReason: true, blockedAt: true, sessionVersion: true },
    });

    expect(stored.isBlocked).toBe(true);
    expect(stored.blockedReason).toBe('مشاركة الحساب مع أكثر من شخص');
    expect(stored.blockedAt).not.toBeNull();
    /*
     * The property this whole screen exists for. Without the bump, a blocked
     * student stays signed in on every device they already have open until the
     * cookie expires — `getCurrentUser` compares the token's `sv` against this
     * number, and only a change here retires the tokens.
     */
    expect(stored.sessionVersion).toBe(student.sessionVersion + 1);

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'User', targetId: student.id, action: 'student.blocked' },
      select: { actorId: true, actorEmail: true, metadata: true },
    });
    expect(audit?.actorId).toBe(admin.id);
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(audit?.actorEmail).toBe(admin.email);

    // One decision, one row. Blocking bumps `sessionVersion` as a consequence;
    // also writing `student.sessions_revoked` would read as two decisions.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'User', targetId: student.id, action: 'student.sessions_revoked' },
      }),
    ).toBe(0);
  });

  it('refuses a block with no reason, and changes nothing', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const { response, payload } = await blockStudent(student.id, { blocked: true });

    expect(response.status).toBe(400);
    expect(payload.error?.details?.reason).toBeTruthy();
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { isBlocked: true, sessionVersion: true },
    });
    expect(stored).toEqual({ isBlocked: false, sessionVersion: student.sessionVersion });
  });

  it('refuses to block the administrator making the request', async () => {
    const admin = await signInAs('ADMIN');

    const { response, payload } = await blockStudent(admin.id, {
      blocked: true,
      reason: 'محاولة إيقاف الذات',
    });

    // A locked-out administrator cannot unlock themselves, and the platform
    // could be left with no usable administrator at all.
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('student_block_self');
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: admin.id },
          select: { isBlocked: true },
        })
      ).isBlocked,
    ).toBe(false);
  });

  it('refuses to block another administrator', async () => {
    await signInAs('ADMIN');
    const other = await createAccount('ADMIN');

    const { response, payload } = await blockStudent(other.id, {
      blocked: true,
      reason: 'محاولة إيقاف مدير آخر',
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('student_block_admin');
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: other.id },
          select: { isBlocked: true },
        })
      ).isBlocked,
    ).toBe(false);
  });

  it('refuses to block an account that is already blocked, and writes no second row', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    await blockStudent(student.id, { blocked: true, reason: 'السبب الأول' });

    const { response, payload } = await blockStudent(student.id, {
      blocked: true,
      reason: 'السبب الثاني',
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('student_already_blocked');
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { blockedReason: true, sessionVersion: true },
    });
    // The original reason and the original session generation both survive: a
    // second block would otherwise silently overwrite why the first happened.
    expect(stored.blockedReason).toBe('السبب الأول');
    expect(stored.sessionVersion).toBe(student.sessionVersion + 1);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'User', targetId: student.id, action: 'student.blocked' },
      }),
    ).toBe(1);
  });

  it('lifts a block without restoring the sessions it retired', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    await blockStudent(student.id, { blocked: true, reason: 'سبب اختباري' });

    const { response } = await blockStudent(student.id, { blocked: false });

    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { isBlocked: true, blockedReason: true, blockedAt: true, sessionVersion: true },
    });

    expect(stored.isBlocked).toBe(false);
    // Cleared together: a lifted block that kept its reason reads as one still
    // in force.
    expect(stored.blockedReason).toBeNull();
    expect(stored.blockedAt).toBeNull();
    // Monotonic. Decrementing would resurrect the very sessions the block ended,
    // including the one on the device that caused it.
    expect(stored.sessionVersion).toBe(student.sessionVersion + 1);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'User', targetId: student.id, action: 'student.unblocked' },
      }),
    ).toBe(1);
  });

  it('refuses to unblock an account that is not blocked', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const { response, payload } = await blockStudent(student.id, { blocked: false });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('student_not_blocked');
  });

  it('leaves orders, access and progress exactly as they were', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const product = await prisma.product.create({
      data: {
        type: 'COURSE',
        slug: `students-block-${randomUUID()}`.slice(0, 60),
        title: 'دورة اختبارية',
        shortDescription: 'وصف مختصر صالح لمنتج اختباري.',
        priceHalalas: 49_900,
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    createdProductIds.push(product.id);

    const entitlement = await prisma.entitlement.create({
      data: { userId: student.id, productId: product.id, status: 'ACTIVE', grantedAt: new Date() },
      select: { id: true },
    });

    await blockStudent(student.id, { blocked: true, reason: 'سبب اختباري' });

    // Blocking is not refunding and not revoking; the confirmation text promises
    // exactly that, and this is the assertion that keeps the promise true.
    expect(
      (
        await prisma.entitlement.findUniqueOrThrow({
          where: { id: entitlement.id },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
  });

  it('answers a signed-in student with 403 and blocks nobody', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    await signInAs('STUDENT');
    const { response } = await blockStudent(student.id, { blocked: true, reason: 'محاولة' });

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
          select: { isBlocked: true },
        })
      ).isBlocked,
    ).toBe(false);
  });

  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const { POST } = await import('@/app/api/admin/students/[studentId]/block/route');
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/students/${student.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify({ blocked: true, reason: 'من موقع آخر' }),
      }),
      { params: Promise.resolve({ studentId: student.id }) },
    );

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
          select: { isBlocked: true },
        })
      ).isBlocked,
    ).toBe(false);
  });
});

describe('DELETE /api/admin/students/[studentId]/sessions', () => {
  it('retires every session without blocking the account', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    const { response } = await endSessions(student.id);

    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      select: { isBlocked: true, sessionVersion: true },
    });

    expect(stored.sessionVersion).toBe(student.sessionVersion + 1);
    // The whole difference from blocking: the account can sign back in.
    expect(stored.isBlocked).toBe(false);

    expect(
      await prisma.auditLog.count({
        where: { targetType: 'User', targetId: student.id, action: 'student.sessions_revoked' },
      }),
    ).toBe(1);
  });

  it('refuses to end the requesting administrator’s own sessions', async () => {
    const admin = await signInAs('ADMIN');

    const { response, payload } = await endSessions(admin.id);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('student_sign_out_self');
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: admin.id },
          select: { sessionVersion: true },
        })
      ).sessionVersion,
    ).toBe(admin.sessionVersion);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');

    await signInAs('STUDENT');
    const { response } = await endSessions(student.id);

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
          select: { sessionVersion: true },
        })
      ).sessionVersion,
    ).toBe(student.sessionVersion);
  });
});
