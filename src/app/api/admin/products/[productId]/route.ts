import { apiSuccess, routeHandler } from '@/lib/api';
import { HttpError, requireAdmin } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { assertSameOrigin } from '@/lib/security/origin-check';
import {
  deleteProduct,
  getProductForAdmin,
  parseProductId,
  updateProduct,
} from '@/services/catalog/product-admin.service';
import { updateProductSchema } from '@/validators/admin-product';

export const runtime = 'nodejs';

type Context = { params: Promise<{ productId: string }> };

/** Read one product, with the counts that decide what may be done to it. */
export const GET = routeHandler(
  'GET /api/admin/products/[productId]',
  async (_request: Request, context: Context) => {
    await requireAdmin();

    const { productId } = await context.params;
    const product = await getProductForAdmin(parseProductId(productId));
    if (!product) {
      throw new HttpError(404, COPY.adminProducts.errors.notFound, 'product_not_found');
    }

    return apiSuccess(product);
  },
);

/**
 * Save an edit.
 *
 * `updateProductSchema` has no `type` field, so Zod would strip one silently —
 * and a silent strip is the worst of the three possible behaviours here. An
 * administrator who believed they were converting a course into a simulator
 * would get a successful save and no conversion. The raw body is therefore
 * inspected before parsing, and a `type` that disagrees with the stored one is
 * refused by name.
 *
 * An echoed, identical `type` is allowed through: a form that round-trips the
 * product it loaded is not attempting anything, and refusing it would only
 * teach the client to strip fields the server already strips.
 */
export const PATCH = routeHandler(
  'PATCH /api/admin/products/[productId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { productId } = await context.params;
    const id = parseProductId(productId);

    const body: unknown = await request.json();
    if (body !== null && typeof body === 'object' && 'type' in body) {
      const current = await getProductForAdmin(id);
      if (!current) {
        throw new HttpError(404, COPY.adminProducts.errors.notFound, 'product_not_found');
      }
      if ((body as { type: unknown }).type !== current.type) {
        throw new HttpError(409, COPY.adminProducts.errors.typeImmutable, 'product_type_immutable');
      }
    }

    const input = updateProductSchema.parse(body);
    const product = await updateProduct(id, input, {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess(product);
  },
);

/**
 * Delete a product.
 *
 * Refused whenever an order or an entitlement points at it: removing the product
 * a student paid for would leave their purchase referring to nothing. The
 * service answers with the sentence that suggests archiving instead, because
 * that is the action the administrator actually wanted.
 */
export const DELETE = routeHandler(
  'DELETE /api/admin/products/[productId]',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { productId } = await context.params;
    await deleteProduct(parseProductId(productId), {
      actor: { id: admin.id, email: admin.email },
    });

    return apiSuccess({ deleted: true });
  },
);
