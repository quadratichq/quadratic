import { expect, type Page } from "@playwright/test";

/**
 * Creates a new team by navigating to the create team URL and filling in the team name.
 * @param {Page} page - The Playwright page object.
 * @param {string} newTeamName - The name of the new team to be created.
 * @returns {Promise<void>}
 *
 * @example
 * await createNewTeamByURL(page, 'My New Team');
 */

import { buildUrl } from "./buildUrl.helpers";

type CreateNewTeamOptions = {
  teamName: string;
};

export const createNewTeamByURL = async (
  page: Page,
  { teamName }: CreateNewTeamOptions,
) => {
  // Navigate to the create team url
  await page.goto(buildUrl("/teams/create"));

  await expect(
    page.getByRole(`heading`, { name: `Create a team` }),
  ).toBeVisible();

  // Fill in the new team name
  await page.locator(`[role="dialog"] [name="name"]`).fill(teamName);

  // Click on the "Create team" submit button
  await page.locator(`[type="submit"]:text("Create team")`).click();

  // Assert that the "No files" text is visible on the page
  await expect(page.locator(`:text("No files")`)).toBeVisible();
  await expect(page).not.toHaveURL("/create");

  // Assert getting started with your team message
  await expect(
    page.getByRole(`heading`, { name: `Getting started with your team` }),
  ).toBeVisible();

  // Return the URL for the team to verify it's visible
  await page.waitForLoadState("domcontentloaded");

  const teamUrl = page.url().split("/teams/")[1];
  return { teamUrl };
};
