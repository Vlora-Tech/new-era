import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The video-library routes, exercised through the handlers.
 *
 * The gap these routes close is the reason this file matters: the lesson video
 * picker could only ever *select* a `VideoAsset`, and nothing in the platform
 * could create one, so the picker was permanently empty and no lesson could
 * carry a video. Every assertion below is about a property of the whole request
 * pipeline — the schema, the origin check, the service, the audit write and the
 * database — because that is where the interesting behaviour lives.
 *
 * Bunny itself is never contacted. `BUNNY_STREAM_API_KEY` is left unset for most
 * of the file, which is the state of a real development environment and the one
 * that exercises the "accepted but not confirmed" path.
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
    // The real rule, not a pass-through: "a student is refused" is one of the
    // things this file exists to prove.
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
import { resetEnvCacheForTests } from '@/lib/env';

import { GET as listVideos, POST as registerVideo } from '@/app/api/admin/videos/route';
import { DELETE as deleteVideo } from '@/app/api/admin/videos/[videoAssetId]/route';

const ORIGIN = 'http://localhost:3000';
const LIBRARY_ID = '900001';

const createdUserIds: string[] = [];
const createdVideoIds: string[] = [];
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

async function signInAs(role: 'STUDENT' | 'ADMIN') {
  const email = `admin-videos-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: 'حساب اختبار', passwordHash: 'not-a-real-hash', role },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  session.user = { id: user.id, email: user.email, name: 'حساب اختبار', role };
  return user;
}

async function postVideo(body: unknown) {
  const response = await registerVideo(jsonRequest('/api/admin/videos', 'POST', body));
  const payload = (await response.json()) as Envelope;
  const id = payload.data?.video as { id?: string } | undefined;
  if (id?.id) createdVideoIds.push(id.id);
  return { response, payload };
}

beforeEach(async () => {
  /*
   * A configured library with NO management key: the ordinary development
   * environment, and the branch where a pasted identifier is accepted on format
   * alone. Individual tests override this and reset the cache themselves.
   */
  process.env.BUNNY_STREAM_LIBRARY_ID = LIBRARY_ID;
  process.env.BUNNY_STREAM_TOKEN_SECURITY_KEY = 'test-token-security-key';
  delete process.env.BUNNY_STREAM_API_KEY;
  resetEnvCacheForTests();

  await signInAs('ADMIN');
});

afterEach(() => {
  resetEnvCacheForTests();
});

afterAll(async () => {
  /*
   * Products first. `Lesson.videoAssetId` is `onDelete: Restrict`, so a video
   * still attached to a lesson cannot be removed until the course tree above it
   * is gone — the same rule the delete route enforces, met here in teardown.
   */
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.videoAsset.deleteMany({ where: { id: { in: createdVideoIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('POST /api/admin/videos', () => {
  it('registers a pasted identifier and reports that it was not confirmed', async () => {
    const guid = randomUUID();
    const { response, payload } = await postVideo({ videoGuid: guid });

    expect(response.status).toBe(201);
    // The two outcomes are distinguishable on the wire, which is what lets the
    // screen avoid presenting an unverified row as a verified one.
    expect(payload.data?.confirmed).toBe(false);

    const stored = await prisma.videoAsset.findFirst({ where: { videoGuid: guid } });
    expect(stored).not.toBeNull();
    // Read from configuration, never from the request body.
    expect(stored?.libraryId).toBe(LIBRARY_ID);
    expect(stored?.provider).toBe('BUNNY');
    // READY rather than PROCESSING: nothing told us it was still processing, and
    // PROCESSING would disable it in the picker with no way to clear the state.
    expect(stored?.processingStatus).toBe('READY');
  });

  it('ignores a libraryId the client tries to supply', async () => {
    const guid = randomUUID();
    // The schema does not declare it, so Zod strips it before the service runs.
    // Without this, a request could register an identifier into a library this
    // platform does not own but would happily sign playback URLs for.
    const { response } = await postVideo({ videoGuid: guid, libraryId: '999999' });

    expect(response.status).toBe(201);
    const stored = await prisma.videoAsset.findFirst({ where: { videoGuid: guid } });
    expect(stored?.libraryId).toBe(LIBRARY_ID);
  });

  it('refuses an identifier that is not a Bunny GUID, as a field message', async () => {
    const { response, payload } = await postVideo({ videoGuid: 'not-a-guid' });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('validation_error');
    expect(payload.error?.details?.videoGuid).toBeTruthy();
  });

  it('normalises case so the same video cannot be registered twice', async () => {
    const guid = randomUUID();
    const first = await postVideo({ videoGuid: guid.toUpperCase() });
    expect(first.response.status).toBe(201);

    // The schema lowercases, so the unique index actually sees a duplicate
    // rather than admitting a second row differing only in case.
    const second = await postVideo({ videoGuid: guid.toLowerCase() });
    expect(second.response.status).toBe(409);
    expect(second.payload.error?.code).toBe('video_already_registered');
  });

  it('records an audit row attributed to the administrator', async () => {
    const guid = randomUUID();
    const { payload } = await postVideo({ videoGuid: guid });
    const videoId = (payload.data?.video as { id: string }).id;

    const entries = await prisma.auditLog.findMany({
      where: { targetType: 'VideoAsset', targetId: videoId },
      select: { action: true, actorEmail: true },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe('video.registered');
    expect(entries[0]?.actorEmail).toBe(session.user.email);
  });

  it('refuses to register anything when no provider is configured', async () => {
    delete process.env.BUNNY_STREAM_LIBRARY_ID;
    delete process.env.BUNNY_STREAM_TOKEN_SECURITY_KEY;
    resetEnvCacheForTests();

    const { response, payload } = await postVideo({ videoGuid: randomUUID() });

    expect(response.status).toBe(503);
    expect(payload.error?.code).toBe('video_not_configured');
  });

  it('refuses a student', async () => {
    await signInAs('STUDENT');
    const { response } = await postVideo({ videoGuid: randomUUID() });
    expect(response.status).toBe(403);
  });

  it('refuses a cross-origin submission', async () => {
    const response = await registerVideo(
      new Request(`${ORIGIN}/api/admin/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
        body: JSON.stringify({ videoGuid: randomUUID() }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe('GET /api/admin/videos', () => {
  it('lists registered videos and reports where each is used', async () => {
    const guid = randomUUID();
    await postVideo({ videoGuid: guid });

    const response = await listVideos(jsonRequest('/api/admin/videos?perPage=100', 'GET'));
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(200);
    const rows = payload.data?.rows as Array<{ videoGuid: string; lessonCount: number }>;
    const mine = rows.find((row) => row.videoGuid === guid);
    expect(mine).toBeDefined();
    expect(mine?.lessonCount).toBe(0);
  });

  it('degrades a nonsense query to the default view rather than answering 400', async () => {
    // A browsing request has a sensible answer for bad input; the mutations
    // above deliberately do not.
    const response = await listVideos(
      jsonRequest('/api/admin/videos?page=abc&attached=nonsense&perPage=-5', 'GET'),
    );
    const payload = (await response.json()) as Envelope;

    expect(response.status).toBe(200);
    expect(payload.data?.page).toBe(1);
  });
});

describe('DELETE /api/admin/videos/[videoAssetId]', () => {
  async function callDelete(videoAssetId: string) {
    const response = await deleteVideo(jsonRequest(`/api/admin/videos/${videoAssetId}`, 'DELETE'), {
      params: Promise.resolve({ videoAssetId }),
    });
    return { response, payload: (await response.json()) as Envelope };
  }

  it('un-registers a video nothing points at', async () => {
    const guid = randomUUID();
    const { payload } = await postVideo({ videoGuid: guid });
    const videoId = (payload.data?.video as { id: string }).id;

    const { response } = await callDelete(videoId);
    expect(response.status).toBe(200);
    expect(await prisma.videoAsset.findUnique({ where: { id: videoId } })).toBeNull();
  });

  it('refuses while a lesson still points at it, naming what to detach', async () => {
    const guid = randomUUID();
    const { payload } = await postVideo({ videoGuid: guid });
    const videoId = (payload.data?.video as { id: string }).id;

    // A whole course tree, because `Lesson.videoAssetId` is what blocks the
    // delete and a lesson cannot exist without a module and a course.
    const product = await prisma.product.create({
      data: {
        type: 'COURSE',
        slug: `admin-video-test-${randomUUID()}`.slice(0, 60),
        title: 'دورة اختبارية',
        shortDescription: 'وصف مختصر صالح لمنتج اختباري.',
        priceHalalas: 49_900,
        status: 'DRAFT',
        course: {
          create: {
            modules: {
              create: {
                title: 'وحدة',
                position: 1,
                lessons: { create: { title: 'درس', position: 1, videoAssetId: videoId } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    createdProductIds.push(product.id);

    const { response, payload: refusal } = await callDelete(videoId);

    expect(response.status).toBe(409);
    expect(refusal.error?.code).toBe('video_delete_blocked');
    // The row survives: a refusal that half-applied would be worse than none.
    expect(await prisma.videoAsset.findUnique({ where: { id: videoId } })).not.toBeNull();
  });

  it('answers 404 for a video that does not exist', async () => {
    const { response, payload } = await callDelete(randomUUID());
    expect(response.status).toBe(404);
    expect(payload.error?.code).toBe('video_not_found');
  });

  it('refuses a malformed id as a validation error rather than a 500', async () => {
    const { response } = await callDelete('not-a-uuid');
    expect(response.status).toBe(400);
  });

  it('refuses a student', async () => {
    const guid = randomUUID();
    const { payload } = await postVideo({ videoGuid: guid });
    const videoId = (payload.data?.video as { id: string }).id;

    await signInAs('STUDENT');
    const { response } = await callDelete(videoId);
    expect(response.status).toBe(403);
  });
});
