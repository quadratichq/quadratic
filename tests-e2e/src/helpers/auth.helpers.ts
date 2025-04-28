import { expect, type Page } from "@playwright/test";
import { buildUrl } from "./buildUrl.helpers";

type LogInOptions = {
  emailPrefix?: string;
  teamName?: string;
  route?: string;
};

export const FREE_USER_PREFIX = "e2e_free";
export const PRO_USER_PREFIX = "e2e_pro";
export const USER_PASSWORD = "E2E_test";

export const logIn = async (
  page: Page,
  options: LogInOptions,
): Promise<string> => {
  // extract email and password if available otherwise use env vars
  const email = `${options.emailPrefix ?? PRO_USER_PREFIX}_chrome@quadratichq.com`;

  // setup dialog alerts to be yes
  page.on("dialog", (dialog) => {
    dialog.accept().catch((error) => {
      console.error("Failed to accept the dialog:", error);
    });
  });

  // Try to navigate to our URL
  try {
    await page.goto(buildUrl(options.route ? options.route : "/"), {
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    console.error(error);
  }

  // fill out log in page and log in
  await page.locator(`#username`).fill(email);
  await page.locator(`#password`).fill(USER_PASSWORD);
  await page.locator(`button:text("Continue")`).click();
  await page.waitForLoadState("networkidle");

  // assert that we are logged in
  await expect(page.getByText(email)).toBeVisible();

  // Click team dropdown
  if (options.teamName) {
    await page
      .locator(`nav`)
      .getByRole(`button`, { name: `arrow_drop_down` })
      .click();
    await page
      .locator(`div[data-state="open"] a:has-text("${options.teamName}")`)
      .nth(0)
      .click();
  }

  // Wait for Filter by file or creator name...
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();

  return email;
};
