import { expect, test, type Page } from '@playwright/test';

/**
 * The critical public path: arrive, browse, register, land in the dashboard.
 *
 * Registration happens **once** per project and the account is then reused. The
 * registration endpoint is rate-limited per address, and deliberately so; a
 * suite that registered a fresh account per test would exhaust that budget and
 * fail for a reason that has nothing to do with what it was testing. Loosening
 * the limit to suit the tests would remove the protection being relied on in
 * production, so the tests economise instead.
 */
const PASSWORD = 'E2ePassword!2026';

let sharedEmail = '';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

async function registerAccount(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('الاسم الكامل').fill('طالب اختبار آلي');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
  await page.getByLabel('تأكيد كلمة المرور').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
}

async function signIn(page: Page, email: string, next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
}

async function signOut(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout', {
    headers: { origin: new URL(page.url()).origin },
  });
}

test.describe('public surface', () => {
  test('the homepage is Arabic, right-to-left and light-only', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('درجتك تبدأ من هنا');

    // The independence statement is a standing disclosure, not decoration.
    await expect(page.getByText('منصة تدريبية مستقلة').first()).toBeVisible();

    const colorScheme = await html.evaluate((element) => getComputedStyle(element).colorScheme);
    expect(colorScheme).toContain('light');
  });

  test('the catalogue lists published products and hides drafts', async ({ page }) => {
    await page.goto('/simulators');

    await expect(page.getByText('محاكي قدرات — المسار العلمي')).toBeVisible();
    // The theoretical simulator is seeded as a draft and must not be public.
    await expect(page.getByText('محاكي قدرات — المسار النظري')).toHaveCount(0);
  });

  test('a draft product detail page is not reachable', async ({ page }) => {
    const response = await page.goto('/simulators/qudurat-simulator-theoretical');
    expect(response?.status()).toBe(404);
  });

  test('a simulator page states that results are training indicators', async ({ page }) => {
    await page.goto('/simulators/qudurat-simulator-scientific');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('محاكي قدرات');
    await expect(page.getByText('لا تمثل نتائجها نتيجة رسمية').first()).toBeVisible();
    // The source date is presented as a review date, not a publication date.
    await expect(page.getByText('تاريخ مراجعة المصدر')).toBeVisible();
  });

  test('a signed-out visitor is redirected away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('next=%2Fdashboard');
  });
});

// Serial, because these share one account and the first test creates it.
test.describe.serial('account', () => {
  test('registering signs the student in immediately, with no approval step', async ({ page }) => {
    sharedEmail = uniqueEmail();
    await registerAccount(page, sharedEmail);

    // No verification screen and no waiting room: straight into the dashboard.
    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('a hostile redirect target is not honoured after sign-in', async ({ page }) => {
    await signIn(page, sharedEmail, 'https://evil.example');

    await page.waitForURL('**/dashboard');
    expect(page.url()).not.toContain('evil.example');
  });

  test('a student cannot reach the administration area', async ({ page }) => {
    await signIn(page, sharedEmail);
    await page.waitForURL('**/dashboard');

    await page.goto('/admin');
    await page.waitForURL('**/dashboard');
    expect(page.url()).not.toContain('/admin');
  });

  test('signing out ends access to the dashboard', async ({ page }) => {
    await signIn(page, sharedEmail);
    await page.waitForURL('**/dashboard');

    await signOut(page);

    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
  });
});
