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

  // go to dashboard if in app (optional - only if dashboardLink exists)
  const dashboardLink = page.locator('[data-testid="back-to-dashboard-link"]');
  const isDashboardLinkVisible = await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false);
  if (isDashboardLinkVisible) {
    await dashboardLink.click({ timeout: 60 * 1000 });
    await handleQuadraticLoading(page);
    // Wait a while to ensure navigation completes
    await page.waitForTimeout(5 * 1000);
  }

  // If onboarding video is shown, click "Skip" to proceed
  const getStartedHeader = page.locator('h1:has-text("Get started")');
  if (await getStartedHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    const skipButton = page.getByRole('button', { name: /Skip/i });
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click({ timeout: 60 * 1000 });
    }
  }
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
  // First, check if we're on the onboarding page
  if (!page.url().includes('/onboarding')) {
    await handleQuadraticLoading(page);
    return;
  }

  // Wait for the onboarding page to be ready
  await page.waitForLoadState('networkidle', { timeout: 5 * 1000 }).catch(() => {});

  // const onboardingQuestionTitle = page.locator('[data-testid="onboarding-question-title"]');
  const onboardingBtnGetStarted = page.locator('[data-testid="onboarding-btn-get-started"]');

  // Get started
  await onboardingBtnGetStarted.click({ timeout: 60 * 1000 });
  await onboardingBtnGetStarted.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Personal use
  const onboardingBtnUsePersonal = page.locator('[data-testid="onboarding-btn-use-personal"]');
  await onboardingBtnUsePersonal.click({ timeout: 60 * 1000 });
  await onboardingBtnUsePersonal.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Connections
  const onboardingBtnConnections = page.locator('[data-testid="onboarding-btn-connections-next"]');
  await onboardingBtnConnections.click({ timeout: 60 * 1000 });
  await onboardingBtnConnections.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Team name
  const onboardingInputTeamName = page.locator('[data-testid="onboarding-input-team-name"]');
  await onboardingInputTeamName.fill('E2E Test Team', { timeout: 60 * 1000 });
  const onboardingBtnTeamName = page.locator('[data-testid="onboarding-btn-team-name-next"]');
  await onboardingBtnTeamName.click({ timeout: 60 * 1000 });
  await onboardingBtnTeamName.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Team invites
  const onboardingBtnTeamInvites = page.locator('[data-testid="onboarding-btn-team-invites-next"]');
  await onboardingBtnTeamInvites.click({ timeout: 60 * 1000 });
  await onboardingBtnTeamInvites.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Team plan
  const onboardingBtnTeamPlanFree = page.locator('[data-testid="onboarding-btn-team-plan-free"]');
  await onboardingBtnTeamPlanFree.click({ timeout: 60 * 1000 });
  await onboardingBtnTeamPlanFree.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  await handleQuadraticLoading(page);
};

const handleQuadraticLoading = async (page: Page) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
};
