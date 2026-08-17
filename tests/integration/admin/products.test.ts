import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The products administration routes, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. The Zod schemas, the origin check, the
 * service, the audit writes and the database are all real, because every
 * property worth asserting here is a property of the whole request pipeline:
 * "an edit form cannot publish a product", "a student gets 403", "a product
 * somebody bought cannot be deleted". Asserting any of those one layer below the
 * route would prove nothing about the route.
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
const createdAssetIds: string[] = [];

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
  const email = `admin-products-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

/**
 * A stored image, written straight to the table.
 *
 * The upload pipeline belongs to the media suite; what matters here is only that
 * a product refuses to point at the wrong kind of asset, so the row is created
 * directly rather than pushed through an encoder.
 */
async function createTestAsset(visibility: 'PUBLIC' | 'PROTECTED') {
  const asset = await prisma.mediaAsset.create({
    data: {
      provider: 'LOCAL',
      objectKey: `${visibility.toLowerCase()}/${randomUUID()}.png`,
      visibility,
      mimeType: 'image/png',
      sizeBytes: 1_024,
      width: 800,
      height: 600,
    },
    select: { id: true },
  });
  createdAssetIds.push(asset.id);
  return asset;
}

/** A valid create body. Overrides are applied on top. */
function productBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'COURSE',
    slug: `admin-test-${randomUUID()}`.slice(0, 60),
    title: 'دورة اختبارية',
    shortDescription: 'وصف مختصر صالح لمنتج اختباري.',
    longDescription: null,
    coverAssetId: null,
    priceHalalas: 49_900,
    featured: false,
    ...overrides,
  };
}

async function postProduct(body: unknown) {
  const { POST } = await import('@/app/api/admin/products/route');
  const response = await POST(jsonRequest('/api/admin/products', 'POST', body));
  const payload = (await response.json()) as Envelope;
  if (typeof payload.data?.id === 'string') createdProductIds.push(payload.data.id);
  return { response, payload };
}

async function patchProduct(productId: string, body: unknown) {
  const { PATCH } = await import('@/app/api/admin/products/[productId]/route');
  const response = await PATCH(jsonRequest(`/api/admin/products/${productId}`, 'PATCH', body), {
    params: Promise.resolve({ productId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

async function publishProduct(productId: string, status: string) {
  const { POST } = await import('@/app/api/admin/products/[productId]/publish/route');
  const response = await POST(
    jsonRequest(`/api/admin/products/${productId}/publish`, 'POST', { status }),
    { params: Promise.resolve({ productId }) },
  );
  return { response, payload: (await response.json()) as Envelope };
}

async function deleteProductRoute(productId: string) {
  const { DELETE } = await import('@/app/api/admin/products/[productId]/route');
  const response = await DELETE(jsonRequest(`/api/admin/products/${productId}`, 'DELETE'), {
    params: Promise.resolve({ productId }),
  });
  return { response, payload: (await response.json()) as Envelope };
}

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

/**
 * Torn down by id rather than by truncating shared tables: Vitest runs files in
 * parallel workers against one database, and a `TRUNCATE products` here would
 * delete another file's fixtures mid-assertion.
 */
afterAll(async () => {
  const orders = await prisma.order.findMany({
    where: { productId: { in: createdProductIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.entitlementEvent.deleteMany({
    where: { entitlement: { productId: { in: createdProductIds } } },
  });
  await prisma.entitlement.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.auditLog.deleteMany({
    where: { targetType: 'Product', targetId: { in: createdProductIds } },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.course.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.examSimulator.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  // After the products: `products.coverAssetId` is `Restrict`, so an asset with
  // a product still pointing at it cannot be removed.
  await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssetIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('POST /api/admin/products', () => {
  it('creates a draft, its specialisation row and an audit entry', async () => {
    const admin = await signInAs('ADMIN');
    const { response, payload } = await postProduct(productBody({ type: 'COURSE' }));

    expect(response.status).toBe(201);
    expect(payload.data?.status).toBe('DRAFT');
    expect(payload.data?.currency).toBe('SAR');

    const productId = payload.data?.id as string;
    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { status: true, publishedAt: true, currency: true, course: { select: { id: true } } },
    });

    // A product is never born published, and it owns its content tree from the
    // first millisecond rather than from whenever somebody visits a second screen.
    expect(stored.status).toBe('DRAFT');
    expect(stored.publishedAt).toBeNull();
    expect(stored.course).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'Product', targetId: productId, action: 'product.created' },
      select: { actorId: true, actorEmail: true },
    });
    expect(audit?.actorId).toBe(admin.id);
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(audit?.actorEmail).toBe(admin.email);
  });

  it('creates the simulator specialisation for an EXAM_SIMULATOR', async () => {
    await signInAs('ADMIN');
    const { payload } = await postProduct(productBody({ type: 'EXAM_SIMULATOR' }));

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: payload.data?.id as string },
      select: { examSimulator: { select: { track: true } }, course: { select: { id: true } } },
    });
    expect(stored.examSimulator?.track).toBe('BOTH');
    expect(stored.course).toBeNull();
  });

  it('ignores a status and a currency the client tried to set', async () => {
    await signInAs('ADMIN');
    const { payload } = await postProduct(
      productBody({ status: 'PUBLISHED', publishedAt: new Date().toISOString(), currency: 'USD' }),
    );

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: payload.data?.id as string },
      select: { status: true, publishedAt: true, currency: true },
    });
    expect(stored).toEqual({ status: 'DRAFT', publishedAt: null, currency: 'SAR' });
  });

  it('refuses a slug that is already taken, naming the field', async () => {
    await signInAs('ADMIN');
    const slug = `admin-dup-${randomUUID()}`.slice(0, 60);

    const first = await postProduct(productBody({ slug }));
    expect(first.response.status).toBe(201);

    // Same slug, different case and padded: the service folds it to the same
    // ASCII bytes the unique index compares, so this is the same slug.
    const second = await postProduct(productBody({ slug: `  ${slug.toUpperCase()}  ` }));

    expect(second.response.status).toBe(409);
    expect(second.payload.error?.code).toBe('product_slug_taken');
    expect(second.payload.error?.message).toBe(
      'هذا المعرّف مستخدم في منتج آخر. اختر معرّفًا مختلفًا.',
    );
  });

  it('attaches a public cover and resolves it for the picker', async () => {
    await signInAs('ADMIN');
    const asset = await createTestAsset('PUBLIC');

    const { response, payload } = await postProduct(productBody({ coverAssetId: asset.id }));

    expect(response.status).toBe(201);
    expect(payload.data?.coverAssetId).toBe(asset.id);
    // Resolved server-side, so the edit screen can draw the cover on first paint.
    expect((payload.data?.coverAsset as { id: string; url: string }).id).toBe(asset.id);
    expect((payload.data?.coverAsset as { url: string }).url).toBeTruthy();
  });

  it('refuses a protected asset as a cover, and writes no product', async () => {
    await signInAs('ADMIN');
    const asset = await createTestAsset('PROTECTED');
    const slug = `admin-protected-cover-${randomUUID()}`.slice(0, 60);

    const { response, payload } = await postProduct(productBody({ slug, coverAssetId: asset.id }));

    // The one mistake in this area that cannot be walked back: a cover is drawn
    // by the public catalogue with no access check, so a protected asset behind
    // it would publish paid material.
    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('cover_asset_not_public');
    expect(await prisma.product.count({ where: { slug } })).toBe(0);
  });

  it('answers a signed-in student with 403 and writes nothing', async () => {
    await signInAs('STUDENT');
    const slug = `admin-forbidden-${randomUUID()}`.slice(0, 60);

    const { response } = await postProduct(productBody({ slug }));

    expect(response.status).toBe(403);
    expect(await prisma.product.count({ where: { slug } })).toBe(0);
  });

  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const { POST } = await import('@/app/api/admin/products/route');
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify(productBody()),
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/admin/products/[productId]', () => {
  it('saves an edit and leaves an existing order untouched', async () => {
    const admin = await signInAs('ADMIN');
    const created = await postProduct(productBody({ priceHalalas: 49_900 }));
    const productId = created.payload.data?.id as string;

    await publishProduct(productId, 'PUBLISHED');

    // A real purchase at the old price.
    const order = await prisma.order.create({
      data: {
        userId: admin.id,
        productId,
        productType: 'COURSE',
        productTitle: 'دورة اختبارية',
        amountHalalas: 49_900,
        currency: 'SAR',
        status: 'PAID',
        provider: 'MOCK',
        checkoutRequestKey: randomUUID(),
      },
      select: { id: true },
    });

    const { response, payload } = await patchProduct(
      productId,
      productBody({ slug: created.payload.data?.slug, title: 'عنوان محدَّث', priceHalalas: 9_900 }),
    );

    expect(response.status).toBe(200);
    expect(payload.data?.title).toBe('عنوان محدَّث');
    expect(payload.data?.priceHalalas).toBe(9_900);

    // The point of the whole test: the catalogue moved, the receipt did not.
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { amountHalalas: true, productTitle: true },
    });
    expect(stored).toEqual({ amountHalalas: 49_900, productTitle: 'دورة اختبارية' });
  });

  it('refuses a type that disagrees with the stored one instead of silently dropping it', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody({ type: 'COURSE' }));
    const productId = created.payload.data?.id as string;

    const { response, payload } = await patchProduct(
      productId,
      productBody({ slug: created.payload.data?.slug, type: 'EXAM_SIMULATOR' }),
    );

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('product_type_immutable');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { type: true } }))
        .type,
    ).toBe('COURSE');
  });

  it('cannot publish through the edit form', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    await patchProduct(
      productId,
      productBody({ slug: created.payload.data?.slug, status: 'PUBLISHED' }),
    );

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { status: true },
    });
    expect(stored.status).toBe('DRAFT');
  });

  it('answers an unknown product with 404 rather than a server error', async () => {
    await signInAs('ADMIN');
    const { response } = await patchProduct(randomUUID(), productBody());
    expect(response.status).toBe(404);
  });

  it('answers a malformed id with 404 rather than a driver cast error', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await patchProduct('not-a-uuid', productBody());
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('product_not_found');
  });
});

describe('POST /api/admin/products/[productId]/publish', () => {
  it('publishes, stamps publishedAt and audits the transition', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    const { response, payload } = await publishProduct(productId, 'PUBLISHED');

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { status: true, publishedAt: true },
    });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.publishedAt).not.toBeNull();

    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Product', targetId: productId, action: 'product.published' },
      }),
    ).toBe(1);
  });

  it('reports a repeated publication as no change instead of claiming a second one', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    await publishProduct(productId, 'PUBLISHED');
    const { payload } = await publishProduct(productId, 'PUBLISHED');

    expect(payload.data?.changed).toBe(false);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Product', targetId: productId, action: 'product.published' },
      }),
    ).toBe(1);
  });

  it('refuses to publish an unpriced product, and says which thing is missing', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody({ priceHalalas: 0 }));
    const productId = created.payload.data?.id as string;

    const { response, payload } = await publishProduct(productId, 'PUBLISHED');

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('product_unpriced');
    expect(payload.error?.message).toBe(
      'لا يمكن نشر منتج بلا سعر محدَّد. حدّد السعر أولًا ثم انشر.',
    );
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: productId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });

  it('withdraws a product without touching what was already bought', async () => {
    const admin = await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;
    await publishProduct(productId, 'PUBLISHED');

    const entitlement = await prisma.entitlement.create({
      data: { userId: admin.id, productId, status: 'ACTIVE', grantedAt: new Date() },
      select: { id: true },
    });

    const { payload } = await publishProduct(productId, 'DRAFT');
    expect(payload.data?.changed).toBe(true);

    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { status: true, publishedAt: true },
    });
    expect(stored.status).toBe('DRAFT');
    // Cleared, because a draft row carrying a publication date claims to be live.
    expect(stored.publishedAt).toBeNull();

    expect(
      (
        await prisma.entitlement.findUniqueOrThrow({
          where: { id: entitlement.id },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    await signInAs('STUDENT');
    const { response } = await publishProduct(productId, 'PUBLISHED');

    expect(response.status).toBe(403);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: productId },
          select: { status: true },
        })
      ).status,
    ).toBe('DRAFT');
  });
});

describe('DELETE /api/admin/products/[productId]', () => {
  it('deletes an untouched draft along with its specialisation row', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    const { response } = await deleteProductRoute(productId);

    expect(response.status).toBe(200);
    expect(await prisma.product.count({ where: { id: productId } })).toBe(0);
    expect(await prisma.course.count({ where: { productId } })).toBe(0);
    // The trail outlives the row it describes; nothing about it points at the
    // deleted product with a foreign key.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Product', targetId: productId, action: 'product.deleted' },
      }),
    ).toBe(1);
  });

  it('refuses to delete a product an order references, and suggests archiving', async () => {
    const admin = await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    await prisma.order.create({
      data: {
        userId: admin.id,
        productId,
        productType: 'COURSE',
        productTitle: 'دورة اختبارية',
        amountHalalas: 49_900,
        currency: 'SAR',
        status: 'PAID',
        provider: 'MOCK',
        checkoutRequestKey: randomUUID(),
      },
      select: { id: true },
    });

    const { response, payload } = await deleteProductRoute(productId);

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('product_delete_blocked');
    expect(payload.error?.message).toContain('أرشفه');
    expect(await prisma.product.count({ where: { id: productId } })).toBe(1);
    // Nothing was recorded, because nothing happened.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Product', targetId: productId, action: 'product.deleted' },
      }),
    ).toBe(0);
  });

  it('answers a signed-in student with 403 and leaves the product in place', async () => {
    await signInAs('ADMIN');
    const created = await postProduct(productBody());
    const productId = created.payload.data?.id as string;

    await signInAs('STUDENT');
    const { response } = await deleteProductRoute(productId);

    expect(response.status).toBe(403);
    expect(await prisma.product.count({ where: { id: productId } })).toBe(1);
  });
});

describe('GET /api/admin/products', () => {
  it('filters by status and searches by title or slug, on the server', async () => {
    await signInAs('ADMIN');
    const marker = randomUUID().slice(0, 8);

    const draft = await postProduct(
      productBody({ slug: `list-draft-${marker}`, title: `مسودة ${marker}` }),
    );
    const published = await postProduct(
      productBody({ slug: `list-live-${marker}`, title: `منشور ${marker}` }),
    );
    await publishProduct(published.payload.data?.id as string, 'PUBLISHED');

    const { GET } = await import('@/app/api/admin/products/route');

    const all = (await (
      await GET(new Request(`${ORIGIN}/api/admin/products?q=${marker}`))
    ).json()) as Envelope;
    expect(all.data?.total).toBe(2);

    const onlyDraft = (await (
      await GET(new Request(`${ORIGIN}/api/admin/products?q=${marker}&status=DRAFT`))
    ).json()) as Envelope;
    expect(onlyDraft.data?.total).toBe(1);
    expect((onlyDraft.data?.rows as Array<{ id: string }>)[0]?.id).toBe(draft.payload.data?.id);

    // A slug pasted from a URL finds its own row.
    const bySlug = (await (
      await GET(new Request(`${ORIGIN}/api/admin/products?q=list-live-${marker}`))
    ).json()) as Envelope;
    expect(bySlug.data?.total).toBe(1);
  });

  it('degrades a malformed query to page one rather than failing the screen', async () => {
    await signInAs('ADMIN');
    const { GET } = await import('@/app/api/admin/products/route');

    const response = await GET(
      new Request(`${ORIGIN}/api/admin/products?page=abc&status=nonsense&perPage=99999`),
    );
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
    expect(payload.data?.perPage).toBe(25);
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { GET } = await import('@/app/api/admin/products/route');
    const response = await GET(new Request(`${ORIGIN}/api/admin/products`));
    expect(response.status).toBe(403);
  });
});
