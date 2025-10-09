import { expect, type Page } from '@playwright/test';
import { USER_PASSWORD } from '../constants/auth';
import { buildUrl } from './buildUrl.helpers';
import { cleanUpFiles } from './file.helpers';

type LogInOptions = {
  emailPrefix: string;
  teamName?: string;
  route?: string;
  createAccount?: boolean;
};
export const logIn = async (page: Page, options: LogInOptions): Promise<string> => {
  // grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // Get the browser type
  const browserName = page.context().browser()?.browserType().name();

  // extract email and password if available otherwise use env vars
  const email = `${options.emailPrefix}_${browserName}@quadratichq.com`;

  const loginPage = page.locator(`h1:has-text("Log in to Quadratic")`);

  // to create a new account, only needed when adding a dedicated account for new test
  if (options.createAccount) {
    await signUp(page, { email });
    await page.goto(buildUrl('/logout'));
    await loginPage.waitFor({ timeout: 2 * 60 * 1000 });
  }

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // Try to navigate to our URL
  await page.goto(buildUrl(options?.route ?? '/'));
  await loginPage.waitFor({ timeout: 2 * 60 * 1000 });

  // fill out log in page and log in
  await page.locator(`[data-testid="login-email"]`).fill(email, { timeout: 60 * 1000 });
  await page.locator(`[data-testid="login-password"]`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator(`[data-testid="login-submit"]`).click({ timeout: 60 * 1000 });
  await loginPage.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  await handleOnboarding(page);

  await handleQuadraticLoading(page);

  // go to dashboard if in app
  const dashboardLink = page.locator('[data-testid="back-to-dashboard-link"]');
  await dashboardLink.waitFor({ state: 'visible', timeout: 60 * 1000 });
  await dashboardLink.click({ timeout: 60 * 1000 });
  await handleQuadraticLoading(page);
  // Wait a while to ensure navigation completes
  await page.waitForTimeout(5 * 1000);

  // wait for shared with me visibility on dashboard
  await page.locator(`:text("Shared with me")`).waitFor({ timeout: 2 * 60 * 1000 });

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

  const signupPage = page.locator(`h1:has-text("Sign up for Quadratic")`);
  await signupPage.waitFor({ timeout: 2 * 60 * 1000 });

  // Fill in signup page and submit
  await page.locator(`[data-testid="signup-email"]`).fill(email, { timeout: 60 * 1000 });
  await page.locator(`[data-testid="signup-password"]`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator(`[data-testid="signup-first-name"]`).fill('E2E', { timeout: 60 * 1000 });
  await page.locator(`[data-testid="signup-last-name"]`).fill('Test', { timeout: 60 * 1000 });
  await page.locator(`[data-testid="signup-submit"]`).click({ timeout: 60 * 1000 });
  await signupPage.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  await handleOnboarding(page);

  await handleQuadraticLoading(page);

  // Wait for canvas to be visible
  await page.locator(`#QuadraticCanvasID`).waitFor({ timeout: 2 * 60 * 1000 });

  // Click on dashboard
  await page.locator('nav a[href="/"]').click({ timeout: 2 * 60 * 1000 });

  // Wait for shared with me visibility on dashboard
  await page.locator(`:text("Shared with me")`).waitFor({ timeout: 2 * 60 * 1000 });

  // Assert we are on the teams page
  await expect(page).toHaveURL(/teams/, { timeout: 60 * 1000 });

  return email;
};

const handleOnboarding = async (page: Page) => {
  const onboardingStart = page.locator('h2:has-text("How will you use Quadratic?")');
  if (!(await onboardingStart.isVisible())) {
    await handleQuadraticLoading(page);
    return;
  }

  await page.locator('a:has-text("Work")').click({ timeout: 60 * 1000 });
  await onboardingStart.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  const onboardingFirstQuestion = page.locator('h2:has-text("What best describes your role?")');
  await onboardingFirstQuestion.waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });
  await page.locator('a:has-text("Software Development")').click({ timeout: 60 * 1000 });
  await onboardingFirstQuestion.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  const onboardingSecondQuestion = page.locator('h2:has-text("Which languages are you proficient in?")');
  await onboardingSecondQuestion.waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });
  await page.locator('label:has-text("Formulas")').click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `Next` }).click({ timeout: 60 * 1000 });
  await onboardingSecondQuestion.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  const onboardingThirdQuestion = page.locator('h2:has-text("What are you looking to accomplish in Quadratic?")');
  await onboardingThirdQuestion.waitFor({ state: 'visible', timeout: 2 * 60 * 1000 });
  await page.locator('label:has-text("AI analysis")').click({ timeout: 60 * 1000 });
  await page.getByRole(`button`, { name: `Done` }).click({ timeout: 60 * 1000 });
  await onboardingThirdQuestion.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  await handleQuadraticLoading(page);
};

const handleQuadraticLoading = async (page: Page) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
};
