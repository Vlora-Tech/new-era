import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db';
import { listContactMessages } from '@/services/contact-message.service';

const ORIGIN = 'http://localhost:3000';
const createdIds: string[] = [];

type Envelope = {
  ok: boolean;
  data?: { received?: boolean };
  error?: { code: string; details?: Record<string, string> };
};

function request(body: unknown, origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-Forwarded-For': `contact-test-${randomUUID()}`,
    },
    body: JSON.stringify(body),
  });
}

async function submit(body: unknown, origin = ORIGIN) {
  const { POST } = await import('@/app/api/contact/route');
  const response = await POST(request(body, origin));
  return { response, payload: (await response.json()) as Envelope };
}

afterAll(async () => {
  if (createdIds.length > 0)
    await prisma.contactMessage.deleteMany({ where: { id: { in: createdIds } } });
});

describe('POST /api/contact', () => {
  it('stores a normalized one-way contact message', async () => {
    const marker = randomUUID().slice(0, 8);
    const { response, payload } = await submit({
      name: '  طالب جديد  ',
      email: `CONTACT-${marker}@EXAMPLE.TEST`,
      subject: '  استفسار عن دورة  ',
      message: '  أحتاج إلى معرفة تفاصيل الدورة المتاحة.  ',
      website: '',
    });

    expect(response.status).toBe(201);
    expect(payload).toEqual({ ok: true, data: { received: true } });

    const row = await prisma.contactMessage.findFirst({
      where: { email: `contact-${marker}@example.test` },
    });
    expect(row).toMatchObject({
      name: 'طالب جديد',
      subject: 'استفسار عن دورة',
      message: 'أحتاج إلى معرفة تفاصيل الدورة المتاحة.',
    });
    if (row) createdIds.push(row.id);
  });

  it('returns field errors and stores nothing for an invalid message', async () => {
    const before = await prisma.contactMessage.count();
    const { response, payload } = await submit({
      name: 'أ',
      email: 'bad',
      subject: '',
      message: 'قصير',
    });

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe('validation_error');
    expect(payload.error?.details).toHaveProperty('name');
    expect(payload.error?.details).toHaveProperty('email');
    expect(payload.error?.details).toHaveProperty('message');
    expect(await prisma.contactMessage.count()).toBe(before);
  });

  it('silently discards a filled honeypot', async () => {
    const before = await prisma.contactMessage.count();
    const { response } = await submit({
      name: 'زائر حقيقي',
      email: 'bot@example.test',
      subject: '',
      message: 'هذه رسالة طويلة بما يكفي للاختبار.',
      website: 'https://spam.example',
    });

    expect(response.status).toBe(200);
    expect(await prisma.contactMessage.count()).toBe(before);
  });

  it('rejects a cross-origin submission', async () => {
    const { response, payload } = await submit(
      {
        name: 'زائر حقيقي',
        email: 'cross@example.test',
        subject: '',
        message: 'هذه رسالة طويلة بما يكفي للاختبار.',
      },
      'https://attacker.example',
    );
    expect(response.status).toBe(403);
    expect(payload.error?.code).toBe('cross_origin');
  });

  it('returns messages newest-first and searches their content', async () => {
    const marker = `needle-${randomUUID().slice(0, 8)}`;
    const first = await prisma.contactMessage.create({
      data: { name: 'الأول', email: 'first@example.test', message: `${marker} الرسالة الأولى` },
    });
    const second = await prisma.contactMessage.create({
      data: { name: 'الثاني', email: 'second@example.test', message: `${marker} الرسالة الثانية` },
    });
    createdIds.push(first.id, second.id);

    const result = await listContactMessages({ q: marker, page: 1, perPage: 20 });
    expect(result.total).toBe(2);
    expect(result.rows.map((row) => row.id)).toEqual([second.id, first.id]);
  });
});
