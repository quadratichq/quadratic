import { expect, type Page } from '@playwright/test';
import { buildUrl } from './buildUrl.helpers';

/**
 * Creates a new team, walks through the onboarding process, and navigates to the dashboard.
 */
type CreateNewTeamOptions = {
  teamName: string;
};
export const createNewTeamByURL = async (page: Page, { teamName }: CreateNewTeamOptions) => {
  // Navigate to the create team url
  await page.goto(buildUrl('/teams/'));

  // Assert getting started with your team message
  await expect(page.getByRole(`heading`, { name: `Getting started with your team` })).toBeVisible({timeout: 60 * 1000});

  // Click on My Team and Create Team buttons
  await page.locator(`[data-testid="team-switcher-button"]`).click();
  await page.locator(`[data-testid="create-team-button"]`).click();

  // Validate Create new team pop-up shows up
  await expect(page.getByRole(`heading`, { name: `Teams in Quadratic` })).toBeVisible({ timeout: 60 * 1000 });

  // Click on Create new team button
  await page.locator(`[data-testid="create-team-button-submit"]`).click();

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

  // Validate 'how many' people Onboarding step
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

  // Return the URL for the team to verify it's visible
  await page.waitForLoadState('domcontentloaded');

  const teamUrl = page.url().split('/teams/')[1];
  return { teamUrl };
};

