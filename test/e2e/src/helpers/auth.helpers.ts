import { expect, type Page } from '@playwright/test';
import { USER_PASSWORD } from '../constants/auth';
import { buildUrl } from './buildUrl.helpers';
import { cleanUpFiles } from './file.helpers';

/**
 * Asserts that the Quadratic dashboard page is loaded and the user is logged in.
 * Checks for the user's email, page title, and "Suggested files" heading.
 */
export const assertDashboardLoaded = async (page: Page, options: { email: string }) => {
  const { email } = options;

  await expect(page.getByText(email)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveTitle(/Files - Quadratic/);
  await expect(page.getByRole(`heading`, { name: `Files`, exact: true })).toBeVisible();
};

/**
 * Dismisses the "Upgrade to Pro" dialog if it appears on the dashboard.
 * This dialog can appear periodically for team owners on free plans.
 */
export const dismissUpgradeToProDialog = async (page: Page) => {
  try {
    // Check if the upgrade dialog is visible (it has "Upgrade to Pro" as the title)
    const upgradeDialog = page.locator('[data-testid="upgrade-to-pro-dialog"]');
    if (await upgradeDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click the close button (has sr-only text "Close")
      await page.locator('[role="dialog"] button:has-text("Close")').click({ timeout: 5000 });
      // Wait for the dialog to close
      await upgradeDialog.waitFor({ state: 'hidden', timeout: 5000 });
    }
  } catch {
    // Dialog not present or couldn't be closed, continue silently
  }
};

type LogInOptions = {
  emailPrefix: string;
  teamName?: string;
  route?: string;
};

const handleQuadraticLoading = async (page: Page) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
};

const handleStartWithAi = async (page: Page) => {
  const startWithAiHeader = page.locator('h1:has-text("Start with AI")');
  if (await startWithAiHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click the Quadratic logo to go back to dashboard
    await page
      .locator('a[href="/"]')
      .first()
      .click({ timeout: 60 * 1000 });
    await handleQuadraticLoading(page);
  }
};

const handleHumanCheck = async (page: Page) => {
  const humanCheckHeader = page.locator('text=Before continuing, we need to be sure');
  if (await humanCheckHeader.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log('⚠️  Bot protection detected. Please whitelist E2E test users in WorkOS Radar.');
    console.log('   Emails to whitelist: *e2e_*@quadratichq.com');
    console.log('   WorkOS Dashboard: https://dashboard.workos.com/');

    // Attempt multiple strategies to handle Cloudflare Turnstile

    // Strategy 1: Try to find and click the Turnstile checkbox in iframe
    try {
      const turnstileFrame = page.frameLocator('iframe[title*="Widget"][src*="turnstile"]').first();
      const checkbox = turnstileFrame.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkbox.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 2: Look for Cloudflare challenges iframe
    try {
      const cfFrame = page.frameLocator('iframe[src*="challenges.cloudflare.com"]').first();
      const cfCheckbox = cfFrame.locator('input[type="checkbox"], .cb-i').first();
      if (await cfCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cfCheckbox.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 3: Check for direct checkbox (legacy/fallback)
    const verifyCheckbox = page.getByRole('checkbox', { name: /verify you are human/i });
    if (await verifyCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await verifyCheckbox.check({ timeout: 5000 });
      await page.waitForTimeout(750);
      return;
    }

    // If we get here, captcha couldn't be bypassed automatically
    console.error('❌ Unable to bypass bot protection automatically.');
    console.error('   Action required: Configure WorkOS Radar to whitelist test users.');
  }
};

export const logIn = async (page: Page, options: LogInOptions): Promise<string> => {
  // grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // Get the browser type
  const browserName = page.context().browser()?.browserType().name();

  // extract email and password if available otherwise use env vars
  const email = `${options.emailPrefix}_${browserName}@quadratichq.com`;

  const loginPage = page.locator(`[name="email"]`);

  // setup dialog alerts to be yes
  page.on('dialog', (dialog) => {
    dialog.accept().catch((error) => {
      console.error('Failed to accept the dialog:', error);
    });
  });

  // Try to navigate to our URL
  // When no route is provided, navigate to '/' without query params to ensure
  // login redirects to dashboard (not a previous redirectTo value)
  const route = options?.route ?? '/';
  const url = buildUrl(route);
  // Remove any query parameters when navigating to '/' to ensure clean redirect
  const finalUrl = route === '/' ? url.split('?')[0] : url;
  await page.goto(finalUrl);
  await loginPage.waitFor({ timeout: 2 * 60 * 1000 });

  // fill out log in page and log in
  await page.locator(`[name="email"]`).fill(email, { timeout: 60 * 1000 });
  page.locator('button:has-text("Continue")').click({ timeout: 60 * 1000 });

  // Handle optional captcha/anti-bot step if present
  await handleHumanCheck(page);

  await page.waitForURL((url) => !url.pathname.startsWith('/password'), { timeout: 2 * 60 * 1000 });
  await page.locator(`[name="password"]`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.getByRole('button', { name: 'Sign in' }).click({ timeout: 60 * 1000 });

  await handleHumanCheck(page);

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

  // If "Start with AI" screen is shown, go back to dashboard
  await handleStartWithAi(page);

  // wait for shared with me visibility on dashboard
  await page.locator('[data-testid="dashboard-sidebar-team-files-link"]').waitFor({ timeout: 2 * 60 * 1000 });

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

  // Wait for Filter
  await page.locator('[data-testid="files-list-search-input"]').waitFor({ timeout: 60 * 1000 });

  // Dismiss the "Upgrade to Pro" dialog if it appears
  await dismissUpgradeToProDialog(page);

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
  const loginPage = page.locator(`[name="email"]`);
  await loginPage.waitFor({ timeout: 2 * 60 * 1000 });
  await page.locator('a:has-text("Sign up")').click({ timeout: 60 * 1000 });

  const signupTitle = page.getByText('First name');
  await signupTitle.waitFor({ timeout: 2 * 60 * 1000 });

  // Fill in signup page and submit
  await page.locator('[name="first_name"]').fill('E2E', { timeout: 60 * 1000 });
  await page.locator('[name="last_name"]').fill('Test', { timeout: 60 * 1000 });
  await page.locator('[name="email"]').fill(email, { timeout: 60 * 1000 });
  await page.locator('[value="sign-up"]').click({ timeout: 60 * 1000 });

  await page.locator('[name="password"]').fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator('[value="sign-up"]').click({ timeout: 60 * 1000 });

  await handleHumanCheck(page);
  await handleOnboarding(page);

  await handleQuadraticLoading(page);

  // After onboarding, user may land on canvas or "Start with AI" screen
  const canvasLocator = page.locator(`#QuadraticCanvasID`);
  const startWithAiHeader = page.locator('h1:has-text("Start with AI")');

  // Wait for either canvas or "Start with AI" screen
  await Promise.race([
    canvasLocator.waitFor({ timeout: 2 * 60 * 1000 }),
    startWithAiHeader.waitFor({ timeout: 2 * 60 * 1000 }),
  ]);

  // If on "Start with AI" screen, go back to dashboard; otherwise click nav link from canvas
  if (await startWithAiHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
    await handleStartWithAi(page);
  } else {
    await page.locator('nav a[href="/"]').click({ timeout: 2 * 60 * 1000 });
  }

  // Wait for shared with me visibility on dashboard
  await page.locator(`[data-testid="dashboard-sidebar-team-files-link"]`).waitFor({ timeout: 2 * 60 * 1000 });

  // Assert we are on the teams page
  await expect(page).toHaveURL(/teams/, { timeout: 60 * 1000 });

  return email;
};

export const handleOnboarding = async (page: Page) => {
  // Wait for navigation to potentially complete (redirect to onboarding might happen after login)
  // In CI, the redirect might take longer, so we need to wait for either:
  // 1. The onboarding URL to appear, OR
  // 2. The onboarding button element to appear
  const onboardingBtnUsePersonal = page.locator('[data-testid="onboarding-btn-use-personal"]');

  // First, wait for URL to potentially change to onboarding (with timeout)
  try {
    await page.waitForURL((url) => url.pathname.includes('/onboarding'), { timeout: 10 * 1000 });
  } catch {
    // URL didn't change to onboarding, might not need onboarding
  }

  // Check current URL to determine if we should wait for onboarding
  const currentUrl = page.url();
  const isOnOnboardingUrl = currentUrl.includes('/onboarding');

  // Now check if onboarding button is visible
  // If we're on the onboarding URL, be more patient and wait longer
  const timeoutForButton = isOnOnboardingUrl ? 30 * 1000 : 15 * 1000;
  const isOnboardingVisible = await onboardingBtnUsePersonal
    .isVisible({ timeout: timeoutForButton })
    .catch(() => false);

  // If onboarding button is not visible, check if we're already past onboarding
  if (!isOnboardingVisible) {
    // Check if we're on the onboarding URL - if so, wait a bit more for elements to load
    if (isOnOnboardingUrl) {
      // Wait for the page to fully load
      await page.waitForLoadState('networkidle', { timeout: 10 * 1000 }).catch(() => {});
      // Try again to see if the button appears - give it more time in CI
      const retryVisible = await onboardingBtnUsePersonal.isVisible({ timeout: 30 * 1000 }).catch(() => false);
      if (!retryVisible) {
        await handleQuadraticLoading(page);
        return;
      }
    } else {
      // Not on onboarding URL and button not visible, onboarding likely not needed
      await handleQuadraticLoading(page);
      return;
    }
  }

  // Wait for the onboarding page to be ready
  await page.waitForLoadState('networkidle', { timeout: 5 * 1000 }).catch(() => {});

  // Personal use (first step after removing instructions)
  await onboardingBtnUsePersonal.click({ timeout: 60 * 1000 });
  await onboardingBtnUsePersonal.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Connections page is disabled in e2e tests

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

  // How they heard - click any referral source option (they're randomized, so we pick the first one)
  const onboardingBtnHowTheyHeard = page.locator('[data-testid^="onboarding-btn-source-"]').first();
  await onboardingBtnHowTheyHeard.click({ timeout: 60 * 1000 });
  await onboardingBtnHowTheyHeard.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Team plan
  const onboardingBtnTeamPlanFree = page.locator('[data-testid="onboarding-btn-team-plan-free"]');
  await onboardingBtnTeamPlanFree.click({ timeout: 60 * 1000 });
  await onboardingBtnTeamPlanFree.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Handle case where user ends up on /files/create/ai (A/B test route)
  // Redirect to /files/create instead
  const currentUrlAfterOnboarding = page.url();
  if (currentUrlAfterOnboarding.includes('files/create/ai')) {
    await page.goto(buildUrl('/files/create'));
  }

  await handleQuadraticLoading(page);
};
