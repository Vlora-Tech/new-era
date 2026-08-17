import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { createProduct, listProducts } from '@/services/catalog/product-admin.service';
import { createProductSchema, productListQuerySchema } from '@/validators/admin-product';

export const runtime = 'nodejs';

/**
 * The catalogue collection.
 *
 * `requireAdmin()` is on both verbs. The administration shell hides the link for
 * a student, but hiding a link is decoration: these URLs are guessable, and the
 * guard here is the only thing that actually decides.
 */

/**
 * List products, filtered and paged on the server.
 *
 * The query schema `.catch()`es every field, so `?page=abc&status=nonsense`
 * degrades to page one unfiltered instead of answering a browsing request with a
 * validation error. A list has a sensible answer for bad input; the mutations
 * below deliberately do not.
 */
export const GET = routeHandler('GET /api/admin/products', async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const query = productListQuerySchema.parse(Object.fromEntries(url.searchParams));

  return apiSuccess(await listProducts(query));
});

/**
 * Create a product as a draft.
 *
 * The body cannot carry `status`, `publishedAt` or `currency` — the schema does
 * not declare them, so Zod strips them before the service is reached. A product
 * therefore cannot be created already published, which is what keeps the
 * publication preconditions from being optional.
 */
export const POST = routeHandler('POST /api/admin/products', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  const input = createProductSchema.parse(await request.json());
  const product = await createProduct(input, {
    actor: { id: admin.id, email: admin.email },
  });

  return apiSuccess(product, { status: 201 });
});
