import { expect, type Page } from '@playwright/test';
import { USER_PASSWORD } from '../constants/auth';
import { buildUrl } from './buildUrl.helpers';
import { cleanUpFiles } from './file.helpers';

type LogInOptions = {
  emailPrefix: string;
  teamName?: string;
  route?: string;
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
  await page.goto(buildUrl(options?.route ?? '/'));
  await loginPage.waitFor({ timeout: 2 * 60 * 1000 });

  // fill out log in page and log in
  await page.locator(`[name="email"]`).fill(email, { timeout: 60 * 1000 });
  page.locator('button:has-text("Continue")').click({ timeout: 60 * 1000 });

  // Handle optional captcha/anti-bot step if present
  await handleHumanCheck(page);

  await page.waitForURL((url) => !url.pathname.startsWith('/password'), { timeout: 2 * 60 * 1000 });
  await page.locator(`[name="password"]`).fill(USER_PASSWORD, { timeout: 60 * 1000 });
  await page.locator('button[value="password"]').click({ timeout: 60 * 1000 });

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

export const handleOnboarding = async (page: Page) => {
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

  // How they heard
  const onboardingBtnHowTheyHeard = page.locator('[data-testid="onboarding-btn-source-other"]');
  await onboardingBtnHowTheyHeard.click({ timeout: 60 * 1000 });
  await onboardingBtnHowTheyHeard.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  // Team plan
  const onboardingBtnTeamPlanFree = page.locator('[data-testid="onboarding-btn-team-plan-free"]');
  await onboardingBtnTeamPlanFree.click({ timeout: 60 * 1000 });
  await onboardingBtnTeamPlanFree.waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });

  await handleQuadraticLoading(page);
};

export const handleQuadraticLoading = async (page: Page) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
};
