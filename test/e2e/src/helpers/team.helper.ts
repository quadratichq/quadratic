import { expect, type Page } from '@playwright/test';
import { handleOnboarding } from './auth.helpers';
import { buildUrl } from './buildUrl.helpers';

/**
 * Creates a new team, walks through the onboarding process, and navigates to the dashboard.
 */
export const createNewTeamAndNavigateToDashboard = async (page: Page) => {
  // Open dropdown
  await page.locator(`[data-testid="team-switcher-button"]`).click({ timeout: 60 * 1000 });

  // Click "Create team"
  await page.locator(`[data-testid="create-team-button"]`).click({ timeout: 60 * 1000 });

  // Confirm team creation
  const createTeamButtonSubmit = await page.locator(`[data-testid="create-team-button-submit"]`);
  await expect(createTeamButtonSubmit).toBeVisible({ timeout: 60 * 1000 });
  await createTeamButtonSubmit.click({ timeout: 60 * 1000 });

  // Wait to be redirected to the new team onboarding page
  await page.waitForURL(/onboarding/, { timeout: 60 * 1000 });

  // Get the team's UUID: `/teams/:uuid/onboarding`
  const teamUuid = page.url().match(/\/teams\/([^\/]+)\/onboarding/)?.[1];

  // Walk through the onboarding process
  await handleOnboarding(page);

  // Navigate to the dashboard
  await page.goto(buildUrl(`/teams/${teamUuid}`));

  return { teamUuid };
};
