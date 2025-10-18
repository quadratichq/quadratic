import { expect, test } from '@playwright/test';
import { logIn, signUp } from './helpers/auth.helpers';

test.only('Log In', async ({ page }) => {
  //--------------------------------
  // Log In
  //--------------------------------

  await logIn(page, { emailPrefix: `e2e_login` });

  //--------------------------------
  // Assert:
  //--------------------------------
  // brought to home page
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/teams/);
});

test('Log Out', async ({ page }) => {
  //--------------------------------
  // Log Out
  //--------------------------------

  // Login
  await logIn(page, { emailPrefix: `e2e_logout` });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Account Icon in the bottom left
  await page
    .locator('button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_"))')
    .click({ timeout: 60 * 1000 });

  // Click the Log out button
  await page.getByText('logout', { exact: true }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert you're successfully logged out
  await expect(page.getByText(`Log in to Quadratic`)).toBeVisible({ timeout: 2000 });
});

test('Sign Up', async ({ page }) => {
  //--------------------------------
  // Sign Up
  //--------------------------------

  const emailPrefix = `e2e_signup_${Date.now()}`;

  //--------------------------------
  // Act:
  //--------------------------------
  await signUp(page, { email: `${emailPrefix}_chromium@quadratichq.com` });

  // Log Out
  await page
    .locator('button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_signup_"))')
    .click({ timeout: 60 * 1000 });
  await page.getByText('logout', { exact: true }).click({ timeout: 60 * 1000 });
  await expect(page.getByText(`Log in to Quadratic`)).toBeVisible({ timeout: 2000 });

  // Log In
  await logIn(page, { emailPrefix });

  // Assert we can successfully log in
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/teams/);
});
