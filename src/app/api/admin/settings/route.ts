import { apiSuccess, routeHandler } from '@/lib/api';
import { requireAdmin } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/security/origin-check';
import { getAdminSettings, updateAdminSettings } from '@/services/settings/settings-admin.service';
import { updateSettingsSchema } from '@/validators/admin-settings';

export const runtime = 'nodejs';

/**
 * Platform settings.
 *
 * `PATCH` rather than `PUT`: the body carries the keys the caller means to
 * change and says nothing about the rest, which is what lets one endpoint serve
 * both the whole form and a single field without an omission reading as an
 * instruction to clear four keys.
 *
 * There is no `POST` and no `DELETE`. The key space is fixed in
 * `SETTING_KEYS`, so a setting is never created or removed — only written. A
 * creation endpoint would be an arbitrary-key writer wearing a different name,
 * and the model's own comment promises this store holds no secrets.
 */

/** The five known keys and who last changed each. */
export const GET = routeHandler('GET /api/admin/settings', async () => {
  await requireAdmin();
  return apiSuccess(await getAdminSettings());
});

/**
 * Save the settings that changed.
 *
 * The schema declares five fields and Zod strips the rest, so a body carrying
 * `"payments.secretKey"` reaches the service with that key already gone rather
 * than as an unknown key to reject. The service refuses again anyway.
 *
 * A legal version change additionally requires `acknowledgeLegalChange`, and the
 * refusal lives in the service rather than here: it depends on the *stored*
 * value, which only the transaction that is about to overwrite it can read
 * without racing.
 */
export const PATCH = routeHandler('PATCH /api/admin/settings', async (request) => {
  assertSameOrigin(request);
  const admin = await requireAdmin();

  const input = updateSettingsSchema.parse(await request.json());
  const result = await updateAdminSettings(input, {
    actor: { id: admin.id, email: admin.email },
  });

  return apiSuccess(result);
});
