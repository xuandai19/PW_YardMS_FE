import { expect, test } from '@playwright/test';

test('anonymous users are shown the login form', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'YMS Admin' })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
