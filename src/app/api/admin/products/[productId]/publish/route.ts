import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { parseProductId, transitionProductStatus } from '@/services/catalog/product-admin.service';
import { productStatusTransitionSchema } from '@/validators/admin-product';

export const runtime = 'nodejs';

type Context = { params: Promise<{ productId: string }> };

/**
 * The publication transition — publish, return to draft, archive, restore.
 *
 * It has its own endpoint rather than a `status` field on the edit form, and the
 * separation is the point: publishing has preconditions (a title, a short
 * description, a real price) that an ordinary save does not, and folding the two
 * together would mean every save had to re-check them or none did. The service
 * refuses an incomplete product by naming what is missing.
 *
 * `POST` rather than `PUT`: the request asks for a transition to be performed,
 * and the result depends on the state it starts from — a repeat is answered with
 * `changed: false` rather than pretending work was done, so the client can say
 * "لا توجد تعديلات لحفظها" instead of claiming a second publication.
 */
export const POST = routeHandler(
  'POST /api/admin/products/[productId]/publish',
  async (request: Request, context: Context) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();

    const { productId } = await context.params;
    const input = productStatusTransitionSchema.parse(await request.json());

    const { product, changed } = await transitionProductStatus(
      parseProductId(productId),
      input.status,
      { actor: { id: admin.id, email: admin.email } },
    );

    return apiSuccess({ product, changed });
  },
);
