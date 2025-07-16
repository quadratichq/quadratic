import { expect, type Page } from '@playwright/test';
import { USER_PASSWORD } from '../constants/auth';
import { buildUrl } from './buildUrl.helpers';
import { cleanUpFiles } from './file.helpers';

type LogInOptions = {
  emailPrefix: string;
  teamName?: string;
  route?: string;
};
export const logIn = async (page: Page, options: LogInOptions): Promise<string> => {
  // grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // Get the browser type
  const browserName = page.context().browser()?.browserType().name();

  // extract email and password if available otherwise use env vars
  const email = `${options.emailPrefix}_${browserName}@quadratichq.com`;

  // to create a new account, only needed when adding a dedicated account for new test
  // try {
  //   await signUp(page, { email });
  //   await page.locator('button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_"))').click({ timeout: 60 * 1000 });
  //   await page.locator(`:text("Logout")`).click({ timeout: 60 * 1000 });
  //   await expect(page).toHaveURL(/login/);
  // } catch (_error) {
  //   void _error;
  // }

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // Try to navigate to our URL
  await page.goto(buildUrl(options?.route ?? '/'), {
    waitUntil: 'domcontentloaded',
    timeout: 3 * 60 * 1000,
  });

  // fill out log in page and log in
  await page.locator(`#username`).fill(email, { timeout: 60 * 1000 });
  await page.locator(`#password`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator(`button:text("Continue")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(10 * 1000);

  // Handle authorize screen
  const authorizeApp = page.locator(`button[name="action"]`).filter({ hasText: 'Accept' });
  while (await authorizeApp.isVisible()) {
    await authorizeApp.click({ timeout: 60 * 1000 });
    await page.waitForTimeout(10 * 1000);
  }

  // Handle loading state
  const quadraticLoading = page.locator('html[data-loading-start]');
  while (await quadraticLoading.isVisible()) {
    await page.waitForLoadState('domcontentloaded');
    await quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
    await page.waitForTimeout(10 * 1000);
  }

  // Handle onboarding
  const onboarding = page.locator('h2:has-text("How will you use Quadratic?")');
  while (await onboarding.isVisible()) {
    await page.goto(buildUrl(options?.route ?? '/'), {
      waitUntil: 'domcontentloaded',
      timeout: 3 * 60 * 1000,
    });

    while (await quadraticLoading.isVisible()) {
      await quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
      await page.waitForTimeout(10 * 1000);
    }
  }

  // go to dashboard if in app
  const dashboardLink = page.locator('nav a[href="/"]');
  while (await dashboardLink.isVisible()) {
    await dashboardLink.click({ timeout: 60 * 1000 });
    await page.waitForLoadState('domcontentloaded');
    await quadraticLoading.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
    await page.waitForTimeout(10 * 1000);
  }

  // assert that we are logged in
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });

  // Click team dropdown
  if (options?.teamName) {
    await page
      .locator(`nav`)
      .getByRole(`button`, { name: `arrow_drop_down` })
      .click({ timeout: 60 * 1000 });
    await page
      .locator(`div[data-state="open"] a:has-text("${options.teamName}")`)
      .nth(0)
      .click({ timeout: 60 * 1000 });
  }

  // Wait for Filter by file or creator name...
  await page.locator('[placeholder="Filter by file or creator name…"]').waitFor({ timeout: 60 * 1000 });

  await cleanUpFiles(page, { fileName: 'Untitled' });

  return email;
};

type SignUpOptions = {
  email: string;
};
export const signUp = async (page: Page, { email }: SignUpOptions): Promise<string> => {
  // navigate to log in page
  await page.goto(buildUrl(), { waitUntil: 'domcontentloaded' });

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the 'Sign up' button
  await page.locator(`:text("Sign up")`).click({ timeout: 60 * 1000 });

  // Fill in an email
  await page.locator(`#email`).fill(email, { timeout: 60 * 1000 });

  // Fill in a Password
  await page.locator(`#password`).fill(USER_PASSWORD, { timeout: 60 * 1000 });

  // Click the Continue button
  await page
    .locator(`button[name="action"]`)
    .filter({ hasText: 'Continue' })
    .click({ timeout: 60 * 1000 });

  const authorizeApp = page.locator(`button[name="action"]`).filter({ hasText: 'Accept' });
  if (await authorizeApp.isVisible()) {
    await authorizeApp.click({ timeout: 60 * 1000 });
  }

  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert we're navigated into our file. After sign up, new users should be directed into a new sheet.
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible({ timeout: 60 * 1000 });

  // Exit out of default new file
  await page
    .getByRole(`navigation`)
    .getByRole(`link`)
    .click({ timeout: 60 * 1000 });

  // We're successfully Signed up
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/teams/, { timeout: 60 * 1000 });

  return email;
};
