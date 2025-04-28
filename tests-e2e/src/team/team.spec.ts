import { expect, test } from "@playwright/test";
import { logIn } from "../helpers/auth.helpers";
import { createNewTeam } from "../helpers/team.helper";

test("Create a Team", async ({ page }) => {
  //--------------------------------
  // Create a Team
  //--------------------------------

  // Define team name
  const teamName = `Test Team Creation - ${Date.now()}`;

  // Login
  await logIn(page, {});

  //--------------------------------
  // Act:
  //--------------------------------

  // Assert the team is not visible since not yet created
  await expect(page.locator(`:text("${teamName}")`)).not.toBeVisible();

  // Create a new team
  await createNewTeam(page, { teamName });

  // Click team dropdown
  await page
    .locator(`nav`)
    .getByRole(`button`, { name: `arrow_drop_down` })
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the new team is created and visible in the list of teams
  await expect(
    page.locator(`[role="menuitem"] :text("${teamName}")`),
  ).toBeVisible();
});
