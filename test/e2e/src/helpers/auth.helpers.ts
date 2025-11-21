import { expect, type Page } from '@playwright/test';
import { USER_PASSWORD } from '../constants/auth';
import { buildUrl } from './buildUrl.helpers';
import { cleanUpFiles } from './file.helpers';

type LogInOptions = {
  emailPrefix: string;
  teamName?: string;
  route?: string;
};

type CreateNewTeamOptions = {
  teamName: string;
};

// Create a unique team name
const teamName = `Name - ${Date.now()}`;

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

  //await handleOnboarding(page, { teamName });

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
  
  // Only run onboarding if the onboarding UI is present (fast check)
  try {
    await expect(page.getByRole(`img`, { name: `Quadratic onboarding` })).toBeVisible({ timeout: 2000 });
    await handleOnboarding(page, { teamName });
  } catch {
    // onboarding not present — continue
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
  await handleOnboarding(page, { teamName });

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

export const handleOnboarding = async (page: Page, { teamName }: CreateNewTeamOptions) => {
  // Check for "Get started in"
  const getStartedHeader = page.locator('h2:has-text("Get started in")');
  if (await getStartedHeader.isVisible()) {
    const skipButton = page.locator('[data-testid="skip-get-started"]');
    if (await skipButton.isVisible()) {
      await skipButton.click({ timeout: 60 * 1000 });
      await handleQuadraticLoading(page);
      return;
    }
  }

  // Validate Onboarding page flow
  await expect(page.getByRole(`img`, { name: `Quadratic onboarding` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`heading`, { name: `Welcome to Quadratic!` })).toBeVisible({ timeout: 60 * 1000 });

  // Click Next button
  await page.locator(`[data-testid="onboarding-btn-get-started"]`).click();

  // Validate Experience step in the Onboarding flow
  await expect(page.getByRole(`heading`, { name: `How will you use Quadratic?` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Back` })).toBeVisible({ timeout: 60 * 1000 });
  await page.getByText('Your answers help personalize', { exact: true }).isVisible();

  // Click on Work box option
  await page.locator(`[data-testid="onboarding-btn-use-work"]`).click();

  // Validate Describe your role Onboarding step
  await expect(page.getByRole(`heading`, { name: `What best describes your role?` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Next` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Next` })).toBeDisabled();

  // Click on Data/Analytics option
  await page.getByRole(`link`, { name: 'Data / Analytics' }).click();

  // Validate 'how many people' Onboarding step
  await expect(page.getByRole(`heading`, { name: `How many people are on your team?` })).toBeVisible({ timeout: 60 * 1000 });

  // Select 1-5 option
  await page.getByRole(`link`, { name: '1-5 keyboard_arrow_right' }).click();

  // Validate Data Sources Onboarding step
  await expect(page.getByRole(`heading`, { name: `What data sources are you interested in connecting to?` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole('link', { name: 'Skip, i\'m not interested in any of these' })).toBeVisible({ timeout: 60 * 1000 });

  // Click on the Skip link
  await page.getByRole('link', { name: 'Skip, i\'m not interested in any of these' }).click();

  // Fill in the new team name
  await page.locator(`[data-testid="onboarding-input-team-name"]`).fill(teamName);

  // Click on the Next button
  await page.locator(`[data-testid="onboarding-btn-team-name-next"]`).click({ timeout: 60 * 1000 });

  // Validate Who would you like to invite Onboarding step
  await expect(page.getByRole(`heading`, { name: `Who would you like to invite to your team?` })).toBeVisible({ timeout: 60 * 1000 });
  await page.getByText('Quadratic is better with your team. We’ll send them an invite.', { exact: true }).isVisible();

  // Click Next button
  await page.locator(`[data-testid="onboarding-btn-team-invites-next"]`).click({ timeout: 60 * 1000 });

  // Validate How did you hear Onboarding step
  await expect(page.getByText(`How did you hear about Quadratic?`, { exact: true } )).toBeVisible({ timeout: 60 * 1000 });

  // Click on the Next button
  await page.getByRole(`link`, { name: 'Email' }).click();

  // Validate How did you hear Onboarding step
  await expect(page.getByRole(`heading`, { name: `Which plan would you like?` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Get started for free, or subscribe for full access.`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Click on the Open Quadratic button
  await page.locator(`[data-testid="onboarding-btn-team-plan-free"]`).click({ timeout: 60 * 1000 });

  // Validate the page was navigated to the Spreadsheet
  await expect(page.getByRole(`button`, { name: `Sheet chat` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(teamName, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Navigate to the Dashboard
  await page.locator(`[data-testid="back-to-dashboard-link"]`).click({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/teams/);

  await handleQuadraticLoading(page);
};

const handleQuadraticLoading = async (page: Page) => {
  await page.locator('html[data-loading-start]').waitFor({ state: 'hidden', timeout: 2 * 60 * 1000 });
};
