import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { ContactMessageInput, ContactMessageListQuery } from '@/validators/contact';

const CONTACT_MESSAGE_SELECT = {
  id: true,
  name: true,
  email: true,
  subject: true,
  message: true,
  createdAt: true,
} satisfies Prisma.ContactMessageSelect;

export type ContactMessageRecord = Prisma.ContactMessageGetPayload<{
  select: typeof CONTACT_MESSAGE_SELECT;
}>;

export async function createContactMessage(input: ContactMessageInput): Promise<{ id: string }> {
  const row = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
    },
    select: { id: true },
  });
  return row;
}

export async function listContactMessages(query: ContactMessageListQuery) {
  const where: Prisma.ContactMessageWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          { subject: { contains: query.q, mode: 'insensitive' } },
          { message: { contains: query.q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, rows] = await prisma.$transaction([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: CONTACT_MESSAGE_SELECT,
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

export async function getContactMessage(id: string): Promise<ContactMessageRecord | null> {
  return prisma.contactMessage.findUnique({ where: { id }, select: CONTACT_MESSAGE_SELECT });
}
