import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The exam endpoints, exercised through the handlers themselves.
 *
 * Only the session guard is stubbed. Everything else is real — the origin
 * check, the rate limiter, the Zod schemas, the clock and the database — because
 * the properties under test are properties of the request pipeline. "The server
 * does not send the answer key" is only meaningful if it is asserted against
 * the bytes the route actually returns.
 */
const session = vi.hoisted(() => ({
  user: {
    id: '',
    email: 'exam@example.test',
    name: 'طالب',
    role: 'STUDENT' as 'STUDENT' | 'ADMIN',
  },
}));

vi.mock('@/lib/auth/guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guards')>();
  return {
    ...actual,
    getCurrentUser: async () => session.user,
    requireAuth: async () => session.user,
    requireStudent: async () => session.user,
  };
});

import { prisma } from '@/lib/db';
import { resetMemoryBucketsForTests } from '@/lib/security/rate-limit';
import { createAttempt, startAttempt } from '@/services/exams/attempt-lifecycle.service';
import type { AttemptStateView } from '@/services/exams/attempt-snapshot.service';

import {
  UNIQUE_EXPLANATION_MARKER,
  UNIQUE_HINT_MARKER,
  cleanupExamFixtures,
  createExamFixture,
  loadAttemptPaper,
} from './helpers';

const ORIGIN = 'http://localhost:3000';

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

beforeEach(() => {
  resetMemoryBucketsForTests();
});

afterAll(async () => {
  await cleanupExamFixtures();
});

function mutation(path: string, body?: unknown, method = 'POST') {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function read(path: string) {
  return new Request(`${ORIGIN}${path}`, { headers: { Accept: 'application/json' } });
}

async function envelope<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

/** A started attempt owned by the stubbed session user. */
async function signedInAttempt(sections = 2) {
  const fixture = await createExamFixture({
    sections,
    questionsPerSection: 4,
    sectionDurationSec: 1_800,
    bankPerDomain: sections * 4,
  });
  session.user = {
    id: fixture.userId,
    email: 'exam@example.test',
    name: 'طالب',
    role: 'STUDENT',
  };

  const { attemptId } = await createAttempt({
    userId: fixture.userId,
    simulatorId: fixture.simulatorId,
    mode: 'FULL_SIMULATION',
    actorRole: 'STUDENT',
  });
  await startAttempt(attemptId, fixture.userId);

  return { fixture, attemptId };
}

describe('POST /api/exams/[simulatorId]/attempts', () => {
  it('creates an attempt and answers a replay with the same id', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    session.user = { id: fixture.userId, email: 'e@e.test', name: 'طالب', role: 'STUDENT' };

    const { POST } = await import('@/app/api/exams/[simulatorId]/attempts/route');
    const params = { params: Promise.resolve({ simulatorId: fixture.simulatorId }) };

    const first = await POST(mutation(`/api/exams/${fixture.simulatorId}/attempts`, {}), params);
    const firstBody = await envelope<{ attemptId: string; created: boolean }>(first);
    expect(first.status).toBe(201);
    expect(firstBody.data?.created).toBe(true);

    const second = await POST(mutation(`/api/exams/${fixture.simulatorId}/attempts`, {}), {
      params: Promise.resolve({ simulatorId: fixture.simulatorId }),
    });
    const secondBody = await envelope<{ attemptId: string; created: boolean }>(second);
    expect(second.status).toBe(200);
    expect(secondBody.data?.attemptId).toBe(firstBody.data?.attemptId);
    expect(secondBody.data?.created).toBe(false);
  });

  it('refuses a cross-origin request', async () => {
    const fixture = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    session.user = { id: fixture.userId, email: 'e@e.test', name: 'طالب', role: 'STUDENT' };

    const { POST } = await import('@/app/api/exams/[simulatorId]/attempts/route');
    const request = new Request(`${ORIGIN}/api/exams/${fixture.simulatorId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    });

    const response = await POST(request, {
      params: Promise.resolve({ simulatorId: fixture.simulatorId }),
    });
    expect(response.status).toBe(403);
  });
});

describe('GET /api/exam-attempts/[attemptId] — leak scan', () => {
  it('returns the current section with no answer key, explanation or hint', async () => {
    const { attemptId } = await signedInAttempt(2);

    const { GET } = await import('@/app/api/exam-attempts/[attemptId]/route');
    const response = await GET(read(`/api/exam-attempts/${attemptId}`), {
      params: Promise.resolve({ attemptId }),
    });
    expect(response.status).toBe(200);

    const body = await envelope<AttemptStateView>(response);
    const raw = JSON.stringify(body);

    // The payload the browser receives, scanned as bytes.
    expect(raw).not.toContain('correctOptionKey');
    expect(raw).not.toContain('explanationSnapshot');
    expect(raw).not.toContain('hintSnapshot');
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain(UNIQUE_EXPLANATION_MARKER);
    expect(raw).not.toContain(UNIQUE_HINT_MARKER);

    const state = body.data!;
    expect(state.serverTime).toBeTruthy();
    expect(state.currentSection?.deadlineAt).toBeTruthy();
    expect(state.currentSection?.position).toBe(1);
    // Only the live section is serialised; section two's questions are not
    // reachable from a browser that is still in section one.
    expect(state.questions).toHaveLength(4);
    for (const question of state.questions) {
      expect(question.hint).toBeNull();
      expect(question.content.options.length).toBeGreaterThan(1);
    }
  });

  it('answers 404 for an attempt belonging to someone else', async () => {
    const { attemptId } = await signedInAttempt(1);
    const other = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    session.user = { id: other.userId, email: 'e@e.test', name: 'طالب', role: 'STUDENT' };

    const { GET } = await import('@/app/api/exam-attempts/[attemptId]/route');
    const response = await GET(read(`/api/exam-attempts/${attemptId}`), {
      params: Promise.resolve({ attemptId }),
    });
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/exam-attempts/[attemptId]/answers/[attemptQuestionId]', () => {
  it('returns 409 with the current state when the save version is stale', async () => {
    const { attemptId } = await signedInAttempt(1);
    const paper = await loadAttemptPaper(attemptId);
    const question = paper[0]!.questions[0]!;
    const options = (question.contentSnapshot as { options: Array<{ key: string }> }).options;

    const { PUT } =
      await import('@/app/api/exam-attempts/[attemptId]/answers/[attemptQuestionId]/route');
    const params = {
      params: Promise.resolve({ attemptId, attemptQuestionId: question.id }),
    };

    const saved = await PUT(
      mutation(
        `/api/exam-attempts/${attemptId}/answers/${question.id}`,
        { selectedOptionKey: options[0]!.key, flagged: false, saveVersion: 0 },
        'PUT',
      ),
      params,
    );
    expect(saved.status).toBe(200);
    const savedBody = await envelope<{ saveVersion: number }>(saved);
    expect(savedBody.data?.saveVersion).toBe(1);

    const stale = await PUT(
      mutation(
        `/api/exam-attempts/${attemptId}/answers/${question.id}`,
        { selectedOptionKey: options[1]!.key, flagged: true, saveVersion: 0 },
        'PUT',
      ),
      { params: Promise.resolve({ attemptId, attemptQuestionId: question.id }) },
    );

    expect(stale.status).toBe(409);
    const staleBody = await envelope<never>(stale);
    expect(staleBody.error?.code).toBe('save_conflict');
    // The stale tab is handed the truth so it can rebase.
    expect(staleBody.error?.details).toMatchObject({
      saveVersion: 1,
      selectedOptionKey: options[0]!.key,
      flagged: false,
    });
  });

  it('rejects an option key that is not on the question', async () => {
    const { attemptId } = await signedInAttempt(1);
    const paper = await loadAttemptPaper(attemptId);
    const question = paper[0]!.questions[0]!;

    const { PUT } =
      await import('@/app/api/exam-attempts/[attemptId]/answers/[attemptQuestionId]/route');
    const response = await PUT(
      mutation(
        `/api/exam-attempts/${attemptId}/answers/${question.id}`,
        { selectedOptionKey: 'not-a-real-option', flagged: false, saveVersion: 0 },
        'PUT',
      ),
      { params: Promise.resolve({ attemptId, attemptQuestionId: question.id }) },
    );

    expect(response.status).toBe(400);
    expect((await envelope<never>(response)).error?.code).toBe('invalid_option');
  });
});

describe('POST .../sections/[attemptSectionId]/advance', () => {
  it('is irreversible through the API', async () => {
    const { attemptId } = await signedInAttempt(3);
    const paper = await loadAttemptPaper(attemptId);
    const first = paper[0]!;
    const question = first.questions[0]!;
    const optionKey = (question.contentSnapshot as { options: Array<{ key: string }> }).options[0]!
      .key;

    const advance =
      await import('@/app/api/exam-attempts/[attemptId]/sections/[attemptSectionId]/advance/route');
    const path = `/api/exam-attempts/${attemptId}/sections/${first.id}/advance`;

    const firstCall = await advance.POST(mutation(path), {
      params: Promise.resolve({ attemptId, attemptSectionId: first.id }),
    });
    expect(firstCall.status).toBe(200);
    expect((await envelope<{ outcome: string }>(firstCall)).data?.outcome).toBe('advanced');

    // Advancing the same section again is refused, not replayed.
    const secondCall = await advance.POST(mutation(path), {
      params: Promise.resolve({ attemptId, attemptSectionId: first.id }),
    });
    expect(secondCall.status).toBe(409);
    expect((await envelope<never>(secondCall)).error?.code).toBe('section_locked');

    // And the section it closed cannot be written to, whatever the client does.
    const { PUT } =
      await import('@/app/api/exam-attempts/[attemptId]/answers/[attemptQuestionId]/route');
    const write = await PUT(
      mutation(
        `/api/exam-attempts/${attemptId}/answers/${question.id}`,
        { selectedOptionKey: optionKey, flagged: false, saveVersion: 0 },
        'PUT',
      ),
      { params: Promise.resolve({ attemptId, attemptQuestionId: question.id }) },
    );
    expect(write.status).toBe(409);
    expect((await envelope<never>(write)).error?.code).toBe('section_locked');

    // The GET no longer serialises the closed section's questions either.
    const { GET } = await import('@/app/api/exam-attempts/[attemptId]/route');
    const state = await envelope<AttemptStateView>(
      await GET(read(`/api/exam-attempts/${attemptId}`), {
        params: Promise.resolve({ attemptId }),
      }),
    );
    const deliveredIds = state.data!.questions.map((entry) => entry.id);
    expect(deliveredIds).not.toContain(question.id);
    expect(state.data!.currentSection?.position).toBe(2);
  });
});

describe('POST /api/exam-attempts/[attemptId]/submit and the results route', () => {
  it('withholds the review until the attempt is terminal, then discloses it', async () => {
    const { attemptId } = await signedInAttempt(1);

    const results = await import('@/app/api/exam-attempts/[attemptId]/results/route');

    const early = await results.GET(read(`/api/exam-attempts/${attemptId}/results`), {
      params: Promise.resolve({ attemptId }),
    });
    expect(early.status).toBe(409);
    expect((await envelope<never>(early)).error?.code).toBe('results_not_ready');

    const submit = await import('@/app/api/exam-attempts/[attemptId]/submit/route');
    const first = await submit.POST(mutation(`/api/exam-attempts/${attemptId}/submit`), {
      params: Promise.resolve({ attemptId }),
    });
    expect(first.status).toBe(200);
    expect((await envelope<{ finalised: boolean }>(first)).data?.finalised).toBe(true);

    // Replaying the submission returns the stored result rather than rescoring.
    const replay = await submit.POST(mutation(`/api/exam-attempts/${attemptId}/submit`), {
      params: Promise.resolve({ attemptId }),
    });
    const replayBody = await envelope<{ finalised: boolean; submittedAt: string }>(replay);
    expect(replay.status).toBe(200);
    expect(replayBody.data?.finalised).toBe(false);

    const review = await results.GET(read(`/api/exam-attempts/${attemptId}/results`), {
      params: Promise.resolve({ attemptId }),
    });
    expect(review.status).toBe(200);

    const raw = JSON.stringify(await envelope<unknown>(review));
    // After submission the answer key is exactly what the student is owed.
    expect(raw).toContain('correctOptionKey');
    expect(raw).toContain(UNIQUE_EXPLANATION_MARKER);
    expect(raw).toContain('نتيجة تدريبية');
  });

  it('never exposes another student’s review', async () => {
    const { fixture, attemptId } = await signedInAttempt(1);

    const submit = await import('@/app/api/exam-attempts/[attemptId]/submit/route');
    await submit.POST(mutation(`/api/exam-attempts/${attemptId}/submit`), {
      params: Promise.resolve({ attemptId }),
    });

    const other = await createExamFixture({ sections: 1, questionsPerSection: 4 });
    session.user = { id: other.userId, email: 'e@e.test', name: 'طالب', role: 'STUDENT' };

    const results = await import('@/app/api/exam-attempts/[attemptId]/results/route');
    const response = await results.GET(read(`/api/exam-attempts/${attemptId}/results`), {
      params: Promise.resolve({ attemptId }),
    });

    expect(response.status).toBe(404);
    expect(JSON.stringify(await envelope<unknown>(response))).not.toContain(
      UNIQUE_EXPLANATION_MARKER,
    );

    // The owner is unchanged by the failed read.
    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { userId: true },
    });
    expect(attempt.userId).toBe(fixture.userId);
  });
});
