import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The entitlement administration routes, exercised through the handlers.
 *
 * Only the session guard is stubbed. The schemas, the origin check, the shared
 * `entitlement.ts` helpers, the audit writes and the database are all real,
 * because the properties worth asserting are properties of the whole pipeline:
 * "a second grant does not duplicate the history", "a reactivation is recorded
 * as a reactivation and not as a fresh grant", "revoking cannot happen without a
 * reason", "the history is append-only".
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

async function createAccount(role: 'STUDENT' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email: `admin-entitlements-${randomUUID()}@example.test`,
      name: 'حساب اختبار',
      passwordHash: 'not-a-real-hash',
      role,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const user = await createAccount(role);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

async function createProduct(overrides: Record<string, unknown> = {}) {
  const product = await prisma.product.create({
    data: {
      type: 'COURSE',
      slug: `entitlements-test-${randomUUID()}`.slice(0, 60),
      title: 'دورة اختبارية',
      shortDescription: 'وصف مختصر صالح لمنتج اختباري.',
      priceHalalas: 49_900,
      status: 'PUBLISHED',
      ...overrides,
    },
    select: { id: true, title: true },
  });
  createdProductIds.push(product.id);
  return product;
}

async function grant(body: unknown) {
  const { POST } = await import('@/app/api/admin/entitlements/route');
  const response = await POST(jsonRequest('/api/admin/entitlements', 'POST', body));
  return { response, payload: (await response.json()) as Envelope };
}

async function changeStatus(entitlementId: string, body: unknown) {
  const { POST } = await import('@/app/api/admin/entitlements/[entitlementId]/status/route');
  const response = await POST(
    jsonRequest(`/api/admin/entitlements/${entitlementId}/status`, 'POST', body),
    { params: Promise.resolve({ entitlementId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function getEntitlement(entitlementId: string) {
  const { GET } = await import('@/app/api/admin/entitlements/[entitlementId]/route');
  const response = await GET(jsonRequest(`/api/admin/entitlements/${entitlementId}`, 'GET'), {
    params: Promise.resolve({ entitlementId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function listEntitlements(query = '') {
  const { GET } = await import('@/app/api/admin/entitlements/route');
  const response = await GET(new Request(`${ORIGIN}/api/admin/entitlements${query}`));
  return { response, payload: (await response.json()) as Envelope };
}

/** The whole event log for one entitlement, oldest first. */
async function historyOf(entitlementId: string) {
  return prisma.entitlementEvent.findMany({
    where: { entitlementId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { type: true, reason: true, actorUserId: true, orderId: true },
  });
}

/**
 * Pay for the cold start here rather than inside the first `it`.
 *
 * A worker's first query carries the connection handshake and the query
 * engine's start-up, and the route modules are transformed on first import. On a
 * cold machine that is several seconds, which against Vitest's 5 s *test* budget
 * turns a slow start into a failed assertion about granting access — a red suite
 * that says nothing about the code. Hooks have their own, larger budget, and
 * this is genuinely set-up rather than part of any test.
 */
beforeAll(async () => {
  await prisma.$connect();
  await Promise.all([
    import('@/app/api/admin/entitlements/route'),
    import('@/app/api/admin/entitlements/[entitlementId]/route'),
    import('@/app/api/admin/entitlements/[entitlementId]/status/route'),
  ]);
});

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE entitlements` here
 * would delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { productId: { in: createdProductIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({
    where: { targetType: 'User', targetId: { in: createdUserIds } },
  });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('POST /api/admin/entitlements', () => {
  it('grants access, records the reason in the history, and audits it', async () => {
    const admin = await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    const { response, payload } = await grant({
      email: student.email,
      productId: product.id,
      reason: 'تعويض عن عطل في المقاطع',
    });

    expect(response.status).toBe(201);
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true, status: true, sourceOrderId: true },
    });
    expect(stored.status).toBe('ACTIVE');
    // A manual grant is not a purchase: no order exists, and none is invented.
    expect(stored.sourceOrderId).toBeNull();

    const history = await historyOf(stored.id);
    expect(history).toEqual([
      {
        type: 'GRANTED',
        reason: 'تعويض عن عطل في المقاطع',
        actorUserId: admin.id,
        orderId: null,
      },
    ]);

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'Entitlement', targetId: stored.id, action: 'entitlement.granted' },
      select: { actorId: true, actorEmail: true },
    });
    expect(audit?.actorId).toBe(admin.id);
    expect(audit?.actorEmail).toBe(admin.email);
  });

  it('creates no order and takes no money', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    await grant({ email: student.email, productId: product.id, reason: 'وصول تجريبي' });

    // Access and money are separate ledgers. A grant that quietly wrote an order
    // would put unpaid revenue into every report the platform produces.
    expect(await prisma.order.count({ where: { userId: student.id } })).toBe(0);
  });

  it('reports a repeated grant as no change instead of duplicating the history', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    await grant({ email: student.email, productId: product.id, reason: 'المنح الأول' });
    const { response, payload } = await grant({
      email: student.email,
      productId: product.id,
      reason: 'المنح الثاني',
    });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toBe(false);

    const stored = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true },
    });
    // The unique `(userId, productId)` constraint means this could have been a
    // 500; it is a sentence instead, and the append-only log gains nothing that
    // would afterwards be impossible to tidy up.
    expect(await historyOf(stored.id)).toHaveLength(1);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Entitlement', targetId: stored.id },
      }),
    ).toBe(1);
  });

  it('records a grant over a revoked row as a reactivation, not a fresh grant', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    await grant({ email: student.email, productId: product.id, reason: 'المنح الأصلي' });
    const stored = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true },
    });
    await changeStatus(stored.id, { status: 'REVOKED', reason: 'سحب اختباري' });

    const { payload } = await grant({
      email: student.email,
      productId: product.id,
      reason: 'إعادة بعد مراجعة',
    });

    expect(payload.data?.changed).toBe(true);
    const history = await historyOf(stored.id);
    expect(history.map((event) => event.type)).toEqual(['GRANTED', 'REVOKED', 'REACTIVATED']);

    // The audit action follows the event. Filing this as `entitlement.granted`
    // would erase the single most interesting fact about the row: that access
    // had already been withdrawn once.
    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'Entitlement',
          targetId: stored.id,
          action: 'entitlement.reactivated',
        },
      }),
    ).toBe(1);
  });

  it('refuses a grant with no reason, and writes nothing', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    const { response, payload } = await grant({ email: student.email, productId: product.id });

    expect(response.status).toBe(400);
    expect(payload.error?.details?.reason).toBeTruthy();
    expect(await prisma.entitlement.count({ where: { productId: product.id } })).toBe(0);
  });

  it('refuses an address that belongs to no account', async () => {
    await signInAs('ADMIN');
    const product = await createProduct();

    const { response, payload } = await grant({
      email: `nobody-${randomUUID()}@example.test`,
      productId: product.id,
      reason: 'محاولة منح لحساب غير موجود',
    });

    // This endpoint grants access; it does not register people.
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('student_not_found');
    expect(await prisma.entitlement.count({ where: { productId: product.id } })).toBe(0);
  });

  it('refuses to grant a product entitlement to an administrator', async () => {
    await signInAs('ADMIN');
    const other = await createAccount('ADMIN');
    const product = await createProduct();

    const { response, payload } = await grant({
      email: other.email,
      productId: product.id,
      reason: 'محاولة منح لمدير',
    });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('entitlement_admin_recipient');
    expect(await prisma.entitlement.count({ where: { userId: other.id } })).toBe(0);
  });

  it('answers a signed-in student with 403 and grants nothing', async () => {
    await signInAs('ADMIN');
    const target = await createAccount('STUDENT');
    const product = await createProduct();

    await signInAs('STUDENT');
    const { response } = await grant({
      email: target.email,
      productId: product.id,
      reason: 'محاولة من حساب طالب',
    });

    expect(response.status).toBe(403);
    expect(await prisma.entitlement.count({ where: { productId: product.id } })).toBe(0);
  });

  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    const { POST } = await import('@/app/api/admin/entitlements/route');
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/entitlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify({
          email: student.email,
          productId: product.id,
          reason: 'من موقع آخر',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.entitlement.count({ where: { productId: product.id } })).toBe(0);
  });
});

describe('POST /api/admin/entitlements/[entitlementId]/status', () => {
  /** A granted entitlement, ready to be revoked. */
  async function granted() {
    const student = await createAccount('STUDENT');
    const product = await createProduct();
    await grant({ email: student.email, productId: product.id, reason: 'منح تمهيدي' });
    const row = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true },
    });
    return { student, product, entitlementId: row.id };
  }

  it('revokes access, appends the reason, and audits the decision', async () => {
    const admin = await signInAs('ADMIN');
    const { entitlementId } = await granted();

    const { response, payload } = await changeStatus(entitlementId, {
      status: 'REVOKED',
      reason: 'استرداد كامل مؤكَّد من مزوّد الدفع',
    });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.entitlement.findUniqueOrThrow({
      where: { id: entitlementId },
      select: { status: true, revokedAt: true },
    });
    expect(stored.status).toBe('REVOKED');
    expect(stored.revokedAt).not.toBeNull();

    const history = await historyOf(entitlementId);
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({
      type: 'REVOKED',
      reason: 'استرداد كامل مؤكَّد من مزوّد الدفع',
      actorUserId: admin.id,
      orderId: null,
    });

    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'Entitlement',
          targetId: entitlementId,
          action: 'entitlement.revoked',
        },
      }),
    ).toBe(1);
  });

  it('refuses a transition with no reason, and changes nothing', async () => {
    await signInAs('ADMIN');
    const { entitlementId } = await granted();

    const { response, payload } = await changeStatus(entitlementId, { status: 'REVOKED' });

    expect(response.status).toBe(400);
    expect(payload.error?.details?.reason).toBeTruthy();
    // `EntitlementEvent.reason` is nullable in the schema because a purchase does
    // not need one; a manual action does, and this is where that is enforced.
    expect(
      (
        await prisma.entitlement.findUniqueOrThrow({
          where: { id: entitlementId },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
    expect(await historyOf(entitlementId)).toHaveLength(1);
  });

  it('reports a repeated revocation as no change instead of a second event', async () => {
    await signInAs('ADMIN');
    const { entitlementId } = await granted();
    await changeStatus(entitlementId, { status: 'REVOKED', reason: 'السحب الأول' });

    const { payload } = await changeStatus(entitlementId, {
      status: 'REVOKED',
      reason: 'السحب الثاني',
    });

    expect(payload.data?.changed).toBe(false);
    expect(await historyOf(entitlementId)).toHaveLength(2);
    expect(
      await prisma.auditLog.count({
        where: {
          targetType: 'Entitlement',
          targetId: entitlementId,
          action: 'entitlement.revoked',
        },
      }),
    ).toBe(1);
  });

  it('reactivates without rewriting the withdrawal it followed', async () => {
    await signInAs('ADMIN');
    const { entitlementId } = await granted();
    await changeStatus(entitlementId, { status: 'REVOKED', reason: 'سحب اختباري' });

    const { response, payload } = await changeStatus(entitlementId, {
      status: 'ACTIVE',
      reason: 'إعادة بعد مراجعة الشكوى',
    });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.entitlement.findUniqueOrThrow({
      where: { id: entitlementId },
      select: { status: true, revokedAt: true },
    });
    expect(stored.status).toBe('ACTIVE');
    expect(stored.revokedAt).toBeNull();

    // Three rows, in order. The point of an append-only history is that the
    // withdrawal is still visible after the access came back.
    const history = await historyOf(entitlementId);
    expect(history.map((event) => event.type)).toEqual(['GRANTED', 'REVOKED', 'REACTIVATED']);
    expect(history[1]?.reason).toBe('سحب اختباري');
    expect(history[2]?.reason).toBe('إعادة بعد مراجعة الشكوى');
  });

  it('answers an unknown entitlement with 404, and a malformed id likewise', async () => {
    await signInAs('ADMIN');

    const unknown = await changeStatus(randomUUID(), { status: 'REVOKED', reason: 'محاولة' });
    expect(unknown.response.status).toBe(404);

    const malformed = await changeStatus('not-a-uuid', { status: 'REVOKED', reason: 'محاولة' });
    expect(malformed.response.status).toBe(404);
    expect(malformed.payload.error?.code).toBe('entitlement_not_found');
  });

  it('answers a signed-in student with 403 and leaves access in place', async () => {
    await signInAs('ADMIN');
    const { entitlementId } = await granted();

    await signInAs('STUDENT');
    const { response } = await changeStatus(entitlementId, {
      status: 'REVOKED',
      reason: 'محاولة من حساب طالب',
    });

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.entitlement.findUniqueOrThrow({
          where: { id: entitlementId },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
  });
});

describe('GET /api/admin/entitlements', () => {
  it('filters by status and product, and searches by student address', async () => {
    await signInAs('ADMIN');
    const marker = randomUUID().slice(0, 8);

    const first = await createAccount('STUDENT');
    const second = await createAccount('STUDENT');
    const product = await createProduct({ title: `منتج ${marker}` });
    const other = await createProduct({ title: `منتج آخر ${marker}` });

    await grant({ email: first.email, productId: product.id, reason: 'منح أول' });
    await grant({ email: second.email, productId: other.id, reason: 'منح ثانٍ' });

    const secondRow = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: second.id, productId: other.id } },
      select: { id: true },
    });
    await changeStatus(secondRow.id, { status: 'REVOKED', reason: 'سحب اختباري' });

    const all = await listEntitlements(`?q=${marker}`);
    expect(all.payload.data?.total).toBe(2);

    const active = await listEntitlements(`?q=${marker}&status=ACTIVE`);
    expect(active.payload.data?.total).toBe(1);
    expect((active.payload.data?.rows as Array<{ userId: string }>)[0]?.userId).toBe(first.id);

    const byProduct = await listEntitlements(`?productId=${other.id}`);
    expect(byProduct.payload.data?.total).toBe(1);

    // A manual grant has no source order, and its history names an
    // administrator, so it filters as `admin` rather than as `order`.
    const bySource = await listEntitlements(`?q=${marker}&source=admin`);
    expect(bySource.payload.data?.total).toBe(2);
    const asOrder = await listEntitlements(`?q=${marker}&source=order`);
    expect(asOrder.payload.data?.total).toBe(0);
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await listEntitlements(
      '?page=abc&status=nonsense&perPage=99999&from=2026-13-40',
    );

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await listEntitlements();
    expect(response.status).toBe(403);
  });
});

describe('GET /api/admin/entitlements/[entitlementId]', () => {
  it('returns the whole history in order, with its actor and reasons', async () => {
    const admin = await signInAs('ADMIN');
    const student = await createAccount('STUDENT');
    const product = await createProduct();

    await grant({ email: student.email, productId: product.id, reason: 'منح تمهيدي' });
    const row = await prisma.entitlement.findUniqueOrThrow({
      where: { userId_productId: { userId: student.id, productId: product.id } },
      select: { id: true },
    });
    await changeStatus(row.id, { status: 'REVOKED', reason: 'سحب اختباري' });

    const { response, payload } = await getEntitlement(row.id);

    expect(response.status).toBe(200);
    expect(payload.data?.status).toBe('REVOKED');

    const events = payload.data?.events as Array<{
      type: string;
      reason: string | null;
      actorEmail: string | null;
      source: string;
    }>;
    // Oldest first: this is a narrative read to answer "how did we get here",
    // which is a question that only makes sense forwards.
    expect(events.map((event) => event.type)).toEqual(['GRANTED', 'REVOKED']);
    expect(events[0]?.actorEmail).toBe(admin.email);
    expect(events[0]?.source).toBe('admin');
    expect(events[1]?.reason).toBe('سحب اختباري');
  });

  it('answers an unknown entitlement with 404', async () => {
    await signInAs('ADMIN');
    const { response } = await getEntitlement(randomUUID());
    expect(response.status).toBe(404);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await getEntitlement(randomUUID());
    expect(response.status).toBe(403);
  });
});
