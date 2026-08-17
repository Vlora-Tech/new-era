import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

import { seedExamContent } from './seed-data/exam-content';
import { seedCourseContent } from './seed-data/course-content';
import { seedCommerceFixtures } from './seed-data/commerce-fixtures';

config({ quiet: true });

const prisma = new PrismaClient();

/**
 * Development seed.
 *
 * Idempotent: every write is keyed on a natural key, so running it repeatedly
 * converges rather than accumulating duplicates. All content is obviously
 * fictional and authored for this platform — no real examination material.
 *
 * The seed never runs against production. Production administrators are created
 * by `npm run admin:bootstrap`, which is deliberate, interactive, and refuses to
 * touch an account that already exists.
 */
const SEED_PASSWORD_ROUNDS = 12;

async function seedSettings() {
  const settings: Array<{ key: string; value: unknown }> = [
    { key: 'legal.termsVersion', value: '2026-08-17.1' },
    { key: 'legal.privacyVersion', value: '2026-08-17.1' },
    { key: 'contact.email', value: 'support@example.com' },
    { key: 'contact.phone', value: '' },
    {
      key: 'exam.trackMapping',
      value: {
        note: 'مصدر التصنيف: الدليل الإرشادي لاختبار القدرات العامة. تاريخ مراجعة المصدر من قِبل نيو إيرا: 2026-08-17.',
        theoretical: ['المسار الشرعي', 'مسار إدارة الأعمال'],
        scientific: ['المسار العام', 'علوم الصحة والحياة', 'علوم الحاسب والهندسة'],
      },
    },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value as never },
      // Only create: an operator may have edited these deliberately.
      update: {},
    });
  }
  console.log(`  settings: ${settings.length} keys ensured`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'مدير المنصة';

  if (!email || !password) {
    console.log('  admin: skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)');
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Never silently reset a password that somebody may have changed.
    console.log(`  admin: ${email} already exists, left untouched`);
    return existing;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, SEED_PASSWORD_ROUNDS),
      role: 'ADMIN',
      sessionVersion: 1,
    },
  });
  console.log(`  admin: created ${email}`);
  return admin;
}

async function seedStudent() {
  const email = 'student@example.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  student: ${email} already exists`);
    return existing;
  }

  const student = await prisma.user.create({
    data: {
      email,
      name: 'طالب تجريبي',
      passwordHash: await bcrypt.hash('NewEraLocal!2026', SEED_PASSWORD_ROUNDS),
      role: 'STUDENT',
      sessionVersion: 1,
      consents: {
        create: {
          termsVersion: '2026-08-17.1',
          privacyVersion: '2026-08-17.1',
          acceptedAt: new Date(),
        },
      },
    },
  });
  console.log(`  student: created ${email}`);
  return student;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development seed must not run against production.');
  }

  console.log('Seeding نيو إيرا development data…');

  await seedSettings();
  const admin = await seedAdmin();
  const student = await seedStudent();

  await seedCourseContent(prisma, { authorId: admin?.id ?? null });
  await seedExamContent(prisma, { authorId: admin?.id ?? null, studentId: student?.id ?? null });
  await seedCommerceFixtures(prisma, { studentId: student?.id ?? null });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
