import { expect, test } from '@playwright/test';

/**
 * The critical public path: arrive, browse, register, land in the dashboard.
 *
 * Each account uses a unique address so a re-run does not collide with the last
 * one, and so the suite never depends on cleanup having happened.
 */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
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

    // Light only: nothing should have opted the document into a dark scheme.
    const colorScheme = await html.evaluate((el) => getComputedStyle(el).colorScheme);
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
});

test.describe('account', () => {
  test('registering signs the student in immediately, with no approval step', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('الاسم الكامل').fill('طالب اختبار آلي');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill('E2ePassword!2026');
    await page.getByLabel('تأكيد كلمة المرور').fill('E2ePassword!2026');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();

    // No verification screen, no waiting room: straight into the dashboard.
    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('a signed-out visitor is redirected away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('next=%2Fdashboard');
  });

  test('a hostile redirect target is not honoured after sign-in', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('الاسم الكامل').fill('طالب اختبار آلي');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill('E2ePassword!2026');
    await page.getByLabel('تأكيد كلمة المرور').fill('E2ePassword!2026');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
    await page.waitForURL('**/dashboard');

    // Sign out, then try to smuggle an external destination through `next`.
    await page.request.post('/api/auth/logout', {
      headers: { origin: new URL(page.url()).origin },
    });
    await page.goto('/login?next=https://evil.example');

    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill('E2ePassword!2026');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await page.waitForURL('**/dashboard');
    expect(page.url()).not.toContain('evil.example');
  });

  test('a student cannot reach the administration area', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('الاسم الكامل').fill('طالب اختبار آلي');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill('E2ePassword!2026');
    await page.getByLabel('تأكيد كلمة المرور').fill('E2ePassword!2026');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/admin');
    await page.waitForURL('**/dashboard');
    expect(page.url()).not.toContain('/admin');
  });
});
