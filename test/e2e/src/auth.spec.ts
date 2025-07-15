import { expect, test } from '@playwright/test';
import { USER_PASSWORD } from './constants/auth';
import { logIn, signUp } from './helpers/auth.helpers';
import { buildUrl } from './helpers/buildUrl.helpers';

test('Log In', async ({ page }) => {
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
  await expect(page.locator(`:text("Login to Quadratic.")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`#username`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.locator(`#password`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/login/);
});

test.skip('Sign Up', async ({ page }) => {
  //--------------------------------
  // Sign Up
  //--------------------------------

  const email = `e2e_signup_${Date.now()}@quadratichq.com`;

  // navigate to log in page
  try {
    await page.goto(buildUrl(), { waitUntil: 'domcontentloaded' }); // navigate to log in page
  } catch (e) {
    console.log(e);
  }

  //--------------------------------
  // Act:
  //--------------------------------
  await signUp(page, { email });

  // Log Out
  await page
    .locator('button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_signup_"))')
    .click({ timeout: 60 * 1000 });
  await page.getByText('logout', { exact: true }).click({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/login/);

  // Log In
  await page.locator(`#username`).fill(email, { timeout: 60 * 1000 });
  await page.locator(`#password`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator(`button:text("Continue")`).click({ timeout: 60 * 1000 });

  // Assert we can successfully log in
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/teams/);
});
