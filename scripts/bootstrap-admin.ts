import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

config({ quiet: true });

/**
 * Create the first administrator.
 *
 * This is the production path, and it is deliberately awkward: a one-time,
 * interactive command rather than a seed, an environment variable that lives
 * forever, or a public sign-up route.
 *
 * Two rules it will not break:
 *
 *  - It refuses to run when an administrator already exists. It never resets a
 *    password. A "bootstrap" that silently reissues credentials for an existing
 *    account is a backdoor, whatever it is called.
 *  - It does not want a password to remain in the environment. The interactive
 *    prompt is the intended path; the non-interactive fallback exists for
 *    automated first-boot only and prints an instruction to remove the variable
 *    immediately afterwards.
 */
const MIN_PASSWORD_LENGTH = 10;
const PASSWORD_ROUNDS = 12;

const prisma = new PrismaClient();

function parseArgs(): { email?: string; name?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; name?: string } = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email') result.email = args[i + 1];
    if (arg === '--name') result.name = args[i + 1];
  }
  return result;
}

/** Reject the passwords that make a compromise trivial. */
function passwordProblem(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Password must contain both letters and digits.';
  }
  if (password.toLowerCase().includes(email.split('@')[0]!.toLowerCase())) {
    return 'Password must not contain the account name.';
  }
  const weak = ['password', '12345678', 'admin', 'qwerty', 'letmein', 'newera'];
  if (weak.some((candidate) => password.toLowerCase().includes(candidate))) {
    return 'Password is too predictable.';
  }
  return null;
}

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // Suppress echo so the password is not left on screen or in scrollback.
  const originalWrite = stdout.write.bind(stdout);
  let muted = false;
  (stdout as unknown as { write: typeof originalWrite }).write = ((
    chunk: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (muted && typeof chunk === 'string') return true;
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof originalWrite;

  const answer = rl.question(question);
  muted = true;
  const value = await answer;
  muted = false;
  (stdout as unknown as { write: typeof originalWrite }).write = originalWrite;
  stdout.write('\n');
  rl.close();

  return value;
}

async function main() {
  const args = parseArgs();

  const existingAdmins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (existingAdmins > 0) {
    console.error(
      'An administrator already exists. This command will not modify it.\n' +
        'To recover access to an existing account, reset its password deliberately\n' +
        'through the database with an audited change — not through this command.',
    );
    process.exitCode = 1;
    return;
  }

  const interactive = stdin.isTTY === true;

  let email = args.email?.trim().toLowerCase();
  let name = args.name?.trim();
  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    if (!email) email = (await rl.question('Administrator email: ')).trim().toLowerCase();
    if (!name) name = (await rl.question('Administrator display name: ')).trim();
    rl.close();

    if (!password) {
      password = await promptHidden('Password (input hidden): ');
      const confirmation = await promptHidden('Confirm password: ');
      if (password !== confirmation) {
        console.error('Passwords did not match.');
        process.exitCode = 1;
        return;
      }
    }
  }

  if (!email || !name || !password) {
    console.error(
      'Missing input. Run interactively, or provide --email and --name with\n' +
        'ADMIN_BOOTSTRAP_PASSWORD set for a single run.',
    );
    process.exitCode = 1;
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('That does not look like an email address.');
    process.exitCode = 1;
    return;
  }

  const problem = passwordProblem(password, email);
  if (problem) {
    console.error(problem);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

  // Re-count inside the transaction: two operators running this at the same
  // moment must not both succeed.
  await prisma.$transaction(async (tx) => {
    const recount = await tx.user.count({ where: { role: 'ADMIN' } });
    if (recount > 0) throw new Error('An administrator was created concurrently. Aborting.');

    const admin = await tx.user.create({
      data: { email, name, passwordHash, role: 'ADMIN', sessionVersion: 1 },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: email,
        action: 'admin.bootstrap',
        targetType: 'User',
        targetId: admin.id,
        metadata: { note: 'First administrator created through the bootstrap command.' },
      },
    });
  });

  console.log(`\nAdministrator created: ${email}`);
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    console.log(
      '\nRemove ADMIN_BOOTSTRAP_PASSWORD from the environment now.\n' +
        'It has served its single purpose and must not persist in configuration.',
    );
  }
}

main()
  .catch((error) => {
    console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
