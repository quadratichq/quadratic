import { expect, test } from "@playwright/test";
import { USER_PASSWORD } from "./constants/auth";
import { logIn } from "./helpers/auth.helpers";
import { buildUrl } from "./helpers/buildUrl.helpers";

test("Log In", async ({ page }) => {
  //--------------------------------
  // Log In
  //--------------------------------

  await logIn(page);

  //--------------------------------
  // Assert:
  //--------------------------------
  // brought to home page
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible();
  await expect(page).toHaveURL(/teams/);
});

test("Log Out", async ({ page }) => {
  //--------------------------------
  // Log Out
  //--------------------------------

  // Login
  await logIn(page);

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the Account Icon in the bottom left
  await page
    .locator(
      'button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_"))',
    )
    .click();

  // Click the Log out button
  await page.locator(`:text("Logout")`).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert you're successfully logged out
  await expect(page.locator(`:text("Login to Quadratic.")`)).toBeVisible();
  await expect(page.locator(`#username`)).toBeVisible();
  await expect(page.locator(`#password`)).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test.skip("Sign Up", async ({ page }) => {
  //--------------------------------
  // Sign Up
  //--------------------------------

  const emailAddress = `e2e_signup_${Date.now()}@quadratichq.com`;

  const url = buildUrl();

  // navigate to log in page
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" }); // navigate to log in page
  } catch (e) {
    console.log(e);
  }

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the 'Sign up' button
  await page.locator(`:text("Sign up")`).click();

  // Fill in an email
  await page.locator(`#email`).fill(emailAddress);

  // Fill in a Password
  await page.locator(`#password`).fill(USER_PASSWORD);

  // Click the Continue button
  await page
    .locator(`button[name="action"]`)
    .filter({ hasText: "Continue" })
    .click();

  const authorizeApp = page
    .locator(`button[name="action"]`)
    .filter({ hasText: "Accept" });
  if (await authorizeApp.isVisible()) {
    await authorizeApp.click();
  }

  await page.waitForLoadState("networkidle");

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert we're navigated into our file. After sign up, new users should be directed into a new sheet.
  await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible();

  // Exit out of default new file
  await page.getByRole(`navigation`).getByRole(`link`).click();

  // We're successfully Signed up
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible();
  await expect(page).toHaveURL(/teams/);

  // Log Out
  await page
    .locator(
      'button[aria-haspopup="menu"][data-state="closed"]:has(p:has-text("e2e_signup_"))',
    )
    .click();
  await page.locator(`:text("Logout")`).click();
  await expect(page).toHaveURL(/login/);

  // Log In
  await page.locator(`#username`).fill(emailAddress);
  await page.locator(`#password`).fill(USER_PASSWORD);
  await page.locator(`button:text("Continue")`).click();

  // Assert we can successfully log in
  await expect(page.locator(`:text("Shared with me")`)).toBeVisible();
  await expect(page).toHaveURL(/teams/);
});
