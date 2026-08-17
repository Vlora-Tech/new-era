import 'server-only';

import { Prisma, type $Enums } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma, type PrismaTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';
import { mediaAssetUrl } from '@/services/media/media.service';
import {
  AUDIT_ACTIONS,
  auditChanges,
  writeAuditLog,
  type AuditAction,
  type AuditActor,
} from '@/services/audit/audit.service';
import {
  productSlugSchema,
  type CreateProductInput,
  type ProductListQuery,
  type UpdateProductInput,
} from '@/validators/admin-product';

/**
 * Catalogue administration: the write side of `Product`.
 *
 * Four properties are the reason this is a service rather than a handful of
 * Prisma calls inside route handlers:
 *
 *  1. **Price is the current catalogue price and nothing more.** `Order` carries
 *     its own `amountHalalas`, snapshotted by `order.service.ts` at the moment
 *     the order was created (`amountHalalas: product.priceHalalas`), and no
 *     query in this file writes to `orders`. Editing a price therefore moves the
 *     shelf, never a receipt. That is a property of *what this file does not
 *     touch*, so it is the kind of thing a later "keep the order in sync" edit
 *     would break silently — nothing would fail, and every historical total
 *     would quietly change.
 *  2. **Publication is a transition with preconditions**, not a column an edit
 *     form can set. It lives in `transitionProductStatus` and refuses a product
 *     that has nothing to sell.
 *  3. **Slug uniqueness cannot depend on collation.** The database runs an ICU
 *     `ar-SA` collation; the slug is normalised to ASCII here so the unique
 *     index compares the same bytes on every host, and a `P2002` is translated
 *     into a sentence naming the field rather than escaping as a 500.
 *  4. **Every mutation is audited inside its own transaction**, so the trail can
 *     never record a change that rolled back.
 */

export type AdminProductContext = {
  actor: AuditActor;
  requestId?: string;
};

/** The columns the list table draws. Deliberately narrow: no descriptions. */
const PRODUCT_ROW_SELECT = {
  id: true,
  type: true,
  slug: true,
  title: true,
  status: true,
  priceHalalas: true,
  currency: true,
  featured: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_ROW_SELECT,
  shortDescription: true,
  longDescription: true,
  coverAssetId: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

/**
 * The detail columns plus the two relations the edit screen needs.
 *
 * Kept separate from `PRODUCT_DETAIL_SELECT` so the scalar half can still be
 * turned into a type by `ProductGetPayload` without the relations colliding with
 * the reshaped `coverAsset` and the flattened counts below.
 */
const PRODUCT_DETAIL_WITH_RELATIONS = {
  ...PRODUCT_DETAIL_SELECT,
  coverAsset: {
    select: {
      id: true,
      objectKey: true,
      visibility: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      deletedAt: true,
    },
  },
  _count: { select: { orders: true, entitlements: true } },
} satisfies Prisma.ProductSelect;

type ProductDetailRow = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_DETAIL_WITH_RELATIONS;
}>;

export type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_ROW_SELECT }>;

/**
 * The attached cover, resolved to something a browser can draw.
 *
 * Structurally the `MediaPickerValue` the picker takes, restated here rather
 * than imported: this is a `server-only` module and `media-picker.tsx` is a
 * `'use client'` one, so depending on it would point the arrow the wrong way
 * even for a type. TypeScript checks the two agree where the page hands one to
 * the other, which is where a divergence would actually matter.
 */
export type AdminProductCover = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

export type AdminProductDetail = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_DETAIL_SELECT;
}> & {
  /**
   * Why the edit screen needs these: an order or a granted entitlement freezes
   * the slug and blocks deletion, and a form that only discovers that on submit
   * has already wasted the administrator's typing.
   */
  orderCount: number;
  entitlementCount: number;
  /** Null when nothing is attached, or when the attached asset was deleted. */
  coverAsset: AdminProductCover | null;
};

export type AdminProductPage = {
  rows: AdminProductRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

/**
 * The fields an audit row is allowed to carry for a product.
 *
 * An explicit allowlist rather than a spread of the row: a column added to
 * `Product` later must be named here before it appears in the trail, which is
 * what stops the next migration from quietly widening what gets logged.
 */
const AUDITED_PRODUCT_FIELDS = [
  'slug',
  'title',
  'shortDescription',
  'longDescription',
  'coverAssetId',
  'priceHalalas',
  'featured',
  'status',
] as const;

type AuditableProduct = {
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  coverAssetId: string | null;
  priceHalalas: number;
  featured: boolean;
  status: $Enums.ProductStatus;
};

/**
 * Fold a slug to the exact ASCII bytes the unique index will compare.
 *
 * `NFKC` first, because a full-width `ａ` and a plain `a` are different code
 * points that an index stores happily side by side while a reader sees one
 * value; the compatibility fold turns the first into the second. What survives
 * is then re-validated through the same schema the browser form uses, so the
 * refusal is the Arabic sentence already authored there — the service is
 * callable from a script that never went near a route handler, and the ASCII
 * guarantee has to hold on that path too.
 */
function normaliseSlug(input: string): string {
  return productSlugSchema.parse(input.normalize('NFKC'));
}

function notFound(): never {
  throw new HttpError(404, COPY.adminProducts.errors.notFound, 'product_not_found');
}

/**
 * Reshape a row into what a screen consumes.
 *
 * Called *outside* every transaction, deliberately. `mediaAssetUrl` asks the
 * storage adapter for an address and the adapter refuses when no provider is
 * approved for the environment — throwing that from inside the transaction
 * would roll back a save that had already succeeded, so a product would fail to
 * save because its picture had no URL.
 */
function toDetail(row: ProductDetailRow): AdminProductDetail {
  const { _count, coverAsset, ...product } = row;

  return {
    ...product,
    orderCount: _count.orders,
    entitlementCount: _count.entitlements,
    // A soft-deleted asset is reported as no cover rather than as a broken
    // image: the column still points at the row, and the screen should show the
    // truth, which is that there is nothing to draw.
    coverAsset:
      coverAsset && coverAsset.deletedAt === null
        ? {
            id: coverAsset.id,
            url: mediaAssetUrl(coverAsset),
            mimeType: coverAsset.mimeType,
            sizeBytes: coverAsset.sizeBytes,
            width: coverAsset.width,
            height: coverAsset.height,
          }
        : null,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept a path segment as a product id, or refuse it as "no such product".
 *
 * `id` is `uuid` in PostgreSQL, so handing Prisma `/api/admin/products/hello`
 * raises a driver-level cast error that the envelope can only report as an
 * unexpected 500. A malformed id is not a server fault — it names a product that
 * does not exist, and that is what the caller is told.
 */
export function parseProductId(value: string): string {
  if (!UUID_PATTERN.test(value)) notFound();
  return value;
}

/**
 * Translate the unique violation on `products.slug` into a field-level refusal.
 *
 * The check is `error.code` plus the target, not a string match on the message:
 * a driver upgrade rewords messages, and a rewording that turned this into a
 * generic 500 would show an administrator "حدث خطأ غير متوقع" for a typo.
 */
function isSlugConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  // An empty target means the driver did not name the index. The only unique
  // column on this table is the slug, so a bare P2002 here is still a slug clash.
  return fields.length === 0 || fields.some((field) => String(field).includes('slug'));
}

function slugTaken(): never {
  throw new HttpError(409, COPY.adminProducts.errors.slugTaken, 'product_slug_taken');
}

/**
 * A cover has to be an image that exists, is not deleted, and is public.
 *
 * The visibility check is the one that matters. `PROTECTED` objects are the
 * question bank's paid content, served only through an authorising route; a
 * product cover is rendered by the public catalogue with no such check, so
 * attaching a protected asset would publish paid material through the one image
 * on the page nobody thinks of as content.
 */
async function assertUsableCover(tx: PrismaTransaction, assetId: string): Promise<void> {
  const asset = await tx.mediaAsset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { id: true, visibility: true },
  });

  if (!asset) {
    throw new HttpError(404, COPY.adminProducts.errors.coverAssetNotFound, 'cover_asset_not_found');
  }
  if (asset.visibility !== 'PUBLIC') {
    throw new HttpError(
      409,
      COPY.adminProducts.errors.coverAssetNotPublic,
      'cover_asset_not_public',
    );
  }
}

// ── Reads ────────────────────────────────────────────────────────────────

/**
 * One page of the catalogue, filtered on the server.
 *
 * Filtering happens in SQL rather than over a full table dumped to the client:
 * a catalogue is small today and the shape of the code is what decides whether
 * it is still small enough in two years. `q` matches the title or the slug —
 * the two things an administrator actually remembers about a product.
 *
 * The count and the page are read in one transaction so the pagination summary
 * describes the same moment as the rows beneath it.
 */
export async function listProducts(query: ProductListQuery): Promise<AdminProductPage> {
  const where: Prisma.ProductWhereInput = {};

  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.featured !== undefined) where.featured = query.featured;

  if (query.q) {
    // Normalised the same way the stored slug was, so searching for the slug an
    // administrator pasted from a URL matches the row it came from.
    const term = query.q.normalize('NFKC');
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { slug: { contains: term.toLowerCase(), mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      // `id` breaks ties. Two products saved in the same millisecond otherwise
      // have no defined order, and an undefined order across two pages is how a
      // row appears twice while another is never shown at all.
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: PRODUCT_ROW_SELECT,
    }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** One product, its cover and the two counts that decide what may be done to it. */
export async function getProductForAdmin(productId: string): Promise<AdminProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: PRODUCT_DETAIL_WITH_RELATIONS,
  });

  return product ? toDetail(product) : null;
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * Create a product as a draft, together with its specialisation row.
 *
 * `Course` and `ExamSimulator` are written in the same transaction rather than
 * left for the courses or simulators screen to add later. The relation is
 * one-to-one and mandatory in practice — `getCourseDetail` returns `null` for a
 * product with no `Course` — so a product without it is a row that can be
 * published into a catalogue page that then 404s. Creating it here means the
 * invariant holds from the first millisecond instead of depending on somebody
 * visiting a second screen.
 *
 * A simulator needs a `track`, which the product form does not ask for because
 * it is an examination setting rather than a catalogue one. `BOTH` is the
 * widest audience and therefore the safe default: the simulator screen narrows
 * it, and narrowing later removes nothing a student had.
 */
export async function createProduct(
  input: CreateProductInput,
  context: AdminProductContext,
): Promise<AdminProductDetail> {
  const slug = normaliseSlug(input.slug);

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (input.coverAssetId) await assertUsableCover(tx, input.coverAssetId);

      const product = await tx.product.create({
        data: {
          type: input.type,
          slug,
          title: input.title,
          shortDescription: input.shortDescription,
          longDescription: input.longDescription,
          coverAssetId: input.coverAssetId,
          priceHalalas: input.priceHalalas,
          featured: input.featured,
          // Never accepted from the request: a product that could be created
          // already published would bypass every precondition below.
          status: 'DRAFT',
          currency: 'SAR',
          ...(input.type === 'COURSE'
            ? { course: { create: {} } }
            : { examSimulator: { create: { track: 'BOTH' } } }),
        },
        select: PRODUCT_DETAIL_WITH_RELATIONS,
      });

      const changes = auditChanges<AuditableProduct>(null, product, AUDITED_PRODUCT_FIELDS);
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.PRODUCT_CREATED,
        targetType: 'Product',
        targetId: product.id,
        metadata: { type: product.type, ...changes },
        requestId: context.requestId,
      });

      return product;
    });

    logger.info('product created', {
      productId: created.id,
      actorId: context.actor.id,
      requestId: context.requestId,
    });

    return toDetail(created);
  } catch (error) {
    if (isSlugConflict(error)) slugTaken();
    throw error;
  }
}

/**
 * Save an edit.
 *
 * `type` is absent from `UpdateProductInput` by construction, so this function
 * cannot change which content tree a product owns even if a caller wanted it to.
 *
 * The slug freezes once an order exists. An order is evidence of a purchase made
 * against a particular catalogue address, and a slug that can be re-pointed is a
 * slug that can be handed to a different product later — at which point the
 * evidence names something that was never bought.
 */
export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
  context: AdminProductContext,
): Promise<AdminProductDetail> {
  const slug = normaliseSlug(input.slug);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({
        where: { id: productId },
        select: PRODUCT_DETAIL_WITH_RELATIONS,
      });
      if (!before) notFound();

      if (slug !== before.slug && before._count.orders > 0) {
        throw new HttpError(
          409,
          COPY.adminProducts.errors.slugImmutableAfterOrders,
          'product_slug_frozen',
        );
      }

      // Re-checked on every save, not only when the id changed: an asset can be
      // deleted, or have its visibility changed, between two edits of the
      // product that points at it.
      if (input.coverAssetId) await assertUsableCover(tx, input.coverAssetId);

      const product = await tx.product.update({
        where: { id: productId },
        data: {
          slug,
          title: input.title,
          shortDescription: input.shortDescription,
          longDescription: input.longDescription,
          coverAssetId: input.coverAssetId,
          // The current catalogue price. `orders.amountHalalas` is a separate
          // column written once at checkout; this statement names no order table
          // and must never grow one.
          priceHalalas: input.priceHalalas,
          featured: input.featured,
        },
        select: PRODUCT_DETAIL_WITH_RELATIONS,
      });

      const changes = auditChanges<AuditableProduct>(before, product, AUDITED_PRODUCT_FIELDS);
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.PRODUCT_UPDATED,
        targetType: 'Product',
        targetId: product.id,
        metadata: changes,
        requestId: context.requestId,
      });

      return product;
    });

    logger.info('product updated', {
      productId,
      actorId: context.actor.id,
      requestId: context.requestId,
    });

    return toDetail(updated);
  } catch (error) {
    if (isSlugConflict(error)) slugTaken();
    throw error;
  }
}

/**
 * Publication preconditions.
 *
 * Each refusal names the missing thing, because "تعذّر النشر" on a form the
 * administrator has just filled in leaves them nothing to do but press the
 * button again.
 *
 * A price of zero counts as *no price*: `priceHalalas` is a non-nullable `Int`,
 * so zero is the only value a product that has never been priced can hold, and
 * the platform sells nothing for free. A genuinely free product would need its
 * own flag rather than an amount that is indistinguishable from an omission.
 */
function assertPublishable(product: {
  title: string;
  shortDescription: string;
  priceHalalas: number;
}): void {
  // The title is folded into the description's sentence deliberately. It cannot
  // actually be blank — the schema requires two characters and the column is
  // non-nullable — so this arm only fires for a row edited straight in the
  // database, and the copy bank models the two things an author can genuinely
  // leave out rather than inventing a refusal nobody can trigger.
  if (product.title.trim().length === 0 || product.shortDescription.trim().length === 0) {
    throw new HttpError(
      409,
      COPY.adminProducts.errors.descriptionRequiredToPublish,
      'product_incomplete',
    );
  }
  if (product.priceHalalas <= 0) {
    throw new HttpError(409, COPY.adminProducts.errors.priceRequiredToPublish, 'product_unpriced');
  }
}

const TRANSITION_ACTIONS: Record<$Enums.ProductStatus, AuditAction> = {
  PUBLISHED: AUDIT_ACTIONS.PRODUCT_PUBLISHED,
  ARCHIVED: AUDIT_ACTIONS.PRODUCT_ARCHIVED,
  DRAFT: AUDIT_ACTIONS.PRODUCT_UNPUBLISHED,
};

/**
 * Move a product between DRAFT, PUBLISHED and ARCHIVED.
 *
 * `publishedAt` is stamped on every entry into `PUBLISHED` and cleared on every
 * exit. It answers "since when can this be bought", which is the question the
 * catalogue's ordering asks, so a product withdrawn for a month and returned is
 * new to the shelf again. The history of when it was published before is not
 * lost — it is in the audit trail, which is where a history belongs; a single
 * column can only hold one answer and would otherwise claim a draft is live.
 *
 * Nothing here touches orders or entitlements. Withdrawing a product removes it
 * from the catalogue; the people who already bought it keep what they bought,
 * which is exactly what the confirmation text promises.
 */
export async function transitionProductStatus(
  productId: string,
  status: $Enums.ProductStatus,
  context: AdminProductContext,
): Promise<{ product: AdminProductDetail; changed: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({
      where: { id: productId },
      select: PRODUCT_DETAIL_WITH_RELATIONS,
    });
    if (!before) notFound();

    // Answered honestly rather than re-stamped. Re-running the update would move
    // `publishedAt` and write a second audit row for a publication that already
    // happened, which is exactly the kind of noise that makes a trail unreadable.
    if (before.status === status) {
      return { product: before, changed: false };
    }

    if (status === 'PUBLISHED') assertPublishable(before);

    const product = await tx.product.update({
      where: { id: productId },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      select: PRODUCT_DETAIL_WITH_RELATIONS,
    });

    await writeAuditLog(tx, {
      actor: context.actor,
      action: TRANSITION_ACTIONS[status],
      targetType: 'Product',
      targetId: product.id,
      metadata: {
        from: before.status,
        to: product.status,
        slug: product.slug,
        priceHalalas: product.priceHalalas,
      },
      requestId: context.requestId,
    });

    return { product, changed: true };
  });

  if (result.changed) {
    logger.info('product status changed', {
      productId,
      status,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  return { product: toDetail(result.product), changed: result.changed };
}

/**
 * Delete a product, and refuse whenever that would orphan a purchase.
 *
 * The schema already declines: `orders.productId` and `entitlements.productId`
 * are both `Restrict`, so the statement would fail at the database. The counts
 * are read first anyway, because the two answers are not equivalent — a foreign
 * key violation surfaces as an unexplained failure, while this path names the
 * obstacle and points at archiving, which is the action that was actually
 * wanted. The database edge stays as the backstop for the case where this check
 * is wrong.
 *
 * A product with no orders still owns a `Course` or `ExamSimulator`, which
 * cascade with it — that is the schema's draft-content-tree rule, and it is why
 * deletion is offered at all rather than only archiving.
 */
export async function deleteProduct(
  productId: string,
  context: AdminProductContext,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          _count: { select: { orders: true, entitlements: true } },
        },
      });
      if (!product) notFound();

      if (product._count.orders > 0 || product._count.entitlements > 0) {
        throw new HttpError(
          409,
          COPY.adminProducts.errors.deleteBlockedByOrders,
          'product_delete_blocked',
        );
      }

      // Written before the row disappears, and inside the transaction, so the
      // trail records the deletion only if the deletion actually commits.
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.PRODUCT_DELETED,
        targetType: 'Product',
        targetId: product.id,
        metadata: {
          slug: product.slug,
          title: product.title,
          type: product.type,
          status: product.status,
        },
        requestId: context.requestId,
      });

      await tx.product.delete({ where: { id: productId } });
    });
  } catch (error) {
    // Something further down the content tree holds a `Restrict` edge — lesson
    // progress, a submitted attempt. The wording stays generic on purpose: it is
    // not an order, and blaming one would send the administrator looking in the
    // wrong place.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2014')
    ) {
      logger.warn('product deletion refused by a database constraint', {
        productId,
        code: error.code,
        requestId: context.requestId,
      });
      throw new HttpError(
        409,
        COPY.adminCommon.confirmDelete.blockedBody,
        'product_delete_blocked',
      );
    }
    throw error;
  }

  logger.info('product deleted', {
    productId,
    actorId: context.actor.id,
    requestId: context.requestId,
  });
}
