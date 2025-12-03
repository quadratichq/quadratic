import { expect, type Page } from '@playwright/test';
import { handleOnboarding } from './auth.helpers';
import { buildUrl } from './buildUrl.helpers';

/**
 * Creates a new team, walks through the onboarding process, and navigates to the dashboard.
 */
export const createNewTeamAndNavigateToDashboard = async (page: Page) => {
  // Wait for the team switcher button to be visible before clicking
  const teamSwitcherButton = page.locator(`[data-testid="team-switcher-button"]`);
  await expect(teamSwitcherButton).toBeVisible({ timeout: 60 * 1000 });

  // Open dropdown
  await teamSwitcherButton.click({ timeout: 60 * 1000 });

  // Click "Create team"
  await page.locator(`[data-testid="create-team-button"]`).click({ timeout: 60 * 1000 });

  // Confirm team creation
  const createTeamButtonSubmit = await page.locator(`[data-testid="create-team-button-submit"]`);
  await expect(createTeamButtonSubmit).toBeVisible({ timeout: 60 * 1000 });
  await createTeamButtonSubmit.click({ timeout: 60 * 1000 });

  // Wait to be redirected to the new team onboarding page
  await page.waitForURL(/onboarding/, { timeout: 60 * 1000 });

  // Get the team's UUID: `/teams/:uuid/*`
  const teamUuid = page.url().match(/\/teams\/([^\/]+)\//)?.[1];

  // Walk through the onboarding process
  await handleOnboarding(page);

  // Navigate to the dashboard
  await page.goto(buildUrl(`/teams/${teamUuid}`));

  const teamUrl = page.url().split('/teams/')[1];
  return { teamUuid: teamUrl };
};
