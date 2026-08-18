import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The platform settings routes, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. The Zod schemas, the origin check, the
 * service, the audit writes and the database are all real, because the
 * properties worth asserting are properties of the whole pipeline: "an arbitrary
 * key cannot be written", "a legal version cannot change without an explicit
 * acknowledgement", "a save that changes nothing writes nothing".
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

const KEYS = {
  terms: 'legal.termsVersion',
  privacy: 'legal.privacyVersion',
  email: 'contact.email',
  phone: 'contact.phone',
  trackMapping: 'exam.trackMapping',
} as const;

const ALL_KEYS = Object.values(KEYS);

const createdUserIds: string[] = [];

type Envelope = {
  ok: boolean;
  data?: {
    changed?: string[];
    settings?: { values?: Record<string, unknown>; seeded?: boolean };
    values?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  };
  error?: { code: string; message: string; details?: Record<string, string> };
};

function jsonRequest(method: string, body?: unknown, origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/admin/settings`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const email = `admin-settings-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

async function getSettings() {
  const { GET } = await import('@/app/api/admin/settings/route');
  const response = await GET(jsonRequest('GET'));
  return { response, payload: (await response.json()) as Envelope };
}

async function patchSettings(body: unknown, origin = ORIGIN) {
  const { PATCH } = await import('@/app/api/admin/settings/route');
  const response = await PATCH(jsonRequest('PATCH', body, origin));
  return { response, payload: (await response.json()) as Envelope };
}

async function storedValue(key: string): Promise<unknown> {
  const row = await prisma.siteSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value ?? null;
}

/**
 * The five rows are seeded, shared, and read by the registration flow through
 * `getCurrentLegalVersions`. The suite therefore snapshots them before it starts
 * and puts them back afterwards, rather than assuming a re-seed will happen.
 */
const originals = new Map<string, unknown>();

beforeAll(async () => {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [...ALL_KEYS] } } });
  for (const row of rows) originals.set(row.key, row.value);
});

beforeEach(() => {
  session.user = { id: '', email: '', name: 'مسؤول', role: 'ADMIN' };
});

afterAll(async () => {
  for (const [key, value] of originals) {
    await prisma.siteSetting.update({
      where: { key },
      data: { value: value as never, updatedById: null },
    });
  }
  // `site_settings.updatedById` is `SetNull`, so the users could be removed
  // first; the rows are restored before them anyway so a failure mid-teardown
  // leaves the shared fixtures intact rather than the accounts.
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('GET /api/admin/settings', () => {
  it('returns the known keys with their values and their editors', async () => {
    await signInAs('ADMIN');
    const { response, payload } = await getSettings();

    expect(response.status).toBe(200);
    expect(Object.keys(payload.data?.values ?? {}).sort()).toEqual([
      'contactEmail',
      'contactPhone',
      'examTrackMapping',
      'privacyVersion',
      'termsVersion',
    ]);
    expect(payload.data?.meta).toBeDefined();
  });

  it('answers a signed-in student with 403', async () => {
    await signInAs('STUDENT');
    const { response } = await getSettings();
    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/admin/settings', () => {
  it('saves a changed key, stamps its editor and audits it in the same transaction', async () => {
    const admin = await signInAs('ADMIN');
    const address = `support-${randomUUID().slice(0, 8)}@example.test`;

    const { response, payload } = await patchSettings({ contactEmail: address });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toEqual([KEYS.email]);

    const stored = await prisma.siteSetting.findUniqueOrThrow({
      where: { key: KEYS.email },
      select: { value: true, updatedById: true },
    });
    expect(stored.value).toBe(address);
    expect(stored.updatedById).toBe(admin.id);

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'SiteSetting', targetId: KEYS.email, actorId: admin.id },
      select: { action: true, actorEmail: true, metadata: true },
    });
    expect(audit?.action).toBe('setting.updated');
    // Snapshotted, so removing the account later cannot anonymise the trail.
    expect(audit?.actorEmail).toBe(admin.email);
    expect((audit?.metadata as { after?: string })?.after).toBe(address);
  });

  it('reports a save that changed nothing as no change, and writes no audit row', async () => {
    const admin = await signInAs('ADMIN');
    const current = (await storedValue(KEYS.email)) as string;

    const { payload } = await patchSettings({ contactEmail: current });

    expect(payload.data?.changed).toEqual([]);
    // A trail full of "set it to what it already was" is a trail nobody reads.
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'SiteSetting', targetId: KEYS.email, actorId: admin.id },
      }),
    ).toBe(0);
  });

  it('normalises a Saudi mobile number to one stored form', async () => {
    await signInAs('ADMIN');

    const { response, payload } = await patchSettings({ contactPhone: '05 123 456-78' });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toEqual([KEYS.phone]);
    // The same number typed three ways is one number, and the contact page must
    // not be able to show it two ways.
    expect(await storedValue(KEYS.phone)).toBe('+966512345678');
  });

  it('accepts an emptied phone number rather than forcing one that nobody answers', async () => {
    await signInAs('ADMIN');
    await patchSettings({ contactPhone: '0512345678' });

    const { response } = await patchSettings({ contactPhone: '  ' });

    expect(response.status).toBe(200);
    expect(await storedValue(KEYS.phone)).toBe('');
  });

  it('refuses an invalid address and writes nothing', async () => {
    await signInAs('ADMIN');
    const before = await storedValue(KEYS.email);

    const { response, payload } = await patchSettings({ contactEmail: 'not-an-address' });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('validation_error');
    expect(payload.error?.details?.contactEmail).toBe('اكتب بريدًا إلكترونيًا صحيحًا.');
    expect(await storedValue(KEYS.email)).toEqual(before);
  });

  it('refuses a track listed as both scientific and theoretical', async () => {
    await signInAs('ADMIN');
    const before = await storedValue(KEYS.trackMapping);

    const { response, payload } = await patchSettings({
      examTrackMapping: {
        note: 'ملاحظة',
        scientific: ['المسار العام'],
        theoretical: ['المسار العام'],
      },
    });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('validation_error');
    expect(await storedValue(KEYS.trackMapping)).toEqual(before);
  });

  it('cannot write a key outside the allowlist, even one that looks like a secret', async () => {
    await signInAs('ADMIN');

    const { response } = await patchSettings({
      'payments.secretKey': 'sk_live_should_never_be_stored',
      moyasarApiKey: 'sk_live_either',
      contactEmail: await storedValue(KEYS.email),
    });

    expect(response.status).toBe(200);
    // The schema strips what it does not declare, so the keys never reach the
    // service as unknown keys to reject — they are simply gone. The store's
    // promise that it holds no secrets survives the next person to edit this
    // screen because the key space is closed, not because a check remembered.
    expect(await prisma.siteSetting.count({ where: { key: 'payments.secretKey' } })).toBe(0);
    expect(await prisma.siteSetting.count({ where: { key: 'moyasarApiKey' } })).toBe(0);
    expect(await prisma.siteSetting.count()).toBe(ALL_KEYS.length);
  });

  it('refuses a legal version change that was not explicitly acknowledged', async () => {
    const admin = await signInAs('ADMIN');
    const before = await storedValue(KEYS.terms);

    const { response, payload } = await patchSettings({ termsVersion: '2027-01-01.1' });

    expect(response.status).toBe(409);
    expect(payload.error?.code).toBe('setting_legal_change_unconfirmed');
    // Nothing was written, because every consent taken from that moment would
    // have named a document nobody confirmed had changed.
    expect(await storedValue(KEYS.terms)).toEqual(before);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'SiteSetting', targetId: KEYS.terms, actorId: admin.id },
      }),
    ).toBe(0);
  });

  it('saves a legal version once it is acknowledged, and audits the old and new value', async () => {
    const admin = await signInAs('ADMIN');
    const before = (await storedValue(KEYS.terms)) as string;

    const { response, payload } = await patchSettings({
      termsVersion: '2027-01-01.1',
      acknowledgeLegalChange: true,
    });

    expect(response.status).toBe(200);
    expect(payload.data?.changed).toEqual([KEYS.terms]);
    expect(await storedValue(KEYS.terms)).toBe('2027-01-01.1');

    const audit = await prisma.auditLog.findFirst({
      where: { targetType: 'SiteSetting', targetId: KEYS.terms, actorId: admin.id },
      select: { metadata: true },
    });
    const metadata = audit?.metadata as { before?: string; after?: string };
    expect(metadata.before).toBe(before);
    expect(metadata.after).toBe('2027-01-01.1');
  });

  it('leaves the keys the body did not mention alone', async () => {
    await signInAs('ADMIN');
    const beforePrivacy = await storedValue(KEYS.privacy);
    const beforeMapping = await storedValue(KEYS.trackMapping);

    await patchSettings({ contactEmail: `partial-${randomUUID().slice(0, 8)}@example.test` });

    // An absent field is the caller saying nothing about that key, never an
    // instruction to clear it — which is what lets one endpoint serve both a
    // single field and the whole form.
    expect(await storedValue(KEYS.privacy)).toEqual(beforePrivacy);
    expect(await storedValue(KEYS.trackMapping)).toEqual(beforeMapping);
  });

  it('refuses a version string that is not a short opaque label', async () => {
    await signInAs('ADMIN');
    const before = await storedValue(KEYS.privacy);

    const { response, payload } = await patchSettings({
      privacyVersion: 'النسخة الأولى',
      acknowledgeLegalChange: true,
    });

    expect(response.status).toBe(400);
    expect(payload.error?.details?.privacyVersion).toContain('رقم الإصدار');
    expect(await storedValue(KEYS.privacy)).toEqual(before);
  });

  it('answers a signed-in student with 403 and writes nothing', async () => {
    await signInAs('ADMIN');
    const before = await storedValue(KEYS.email);

    await signInAs('STUDENT');
    const { response } = await patchSettings({ contactEmail: 'student@example.test' });

    expect(response.status).toBe(403);
    expect(await storedValue(KEYS.email)).toEqual(before);
  });

  it('rejects a cross-site request before the guard is even reached', async () => {
    await signInAs('ADMIN');
    const before = await storedValue(KEYS.email);

    const { response } = await patchSettings(
      { contactEmail: 'attacker@example.test' },
      'https://attacker.example',
    );

    expect(response.status).toBe(403);
    expect(await storedValue(KEYS.email)).toEqual(before);
  });
});
