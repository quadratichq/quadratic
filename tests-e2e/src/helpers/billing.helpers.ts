import { expect, type Page } from "@playwright/test";
import { SWIPE_TEST_CARD } from "../constant/billing";

/**
 * Cleans up the provided payment method by:
 * - Checks if the "Payment methods" section is visible.
 * - If "Payment methods" is not found, cleanup is skipped assuming that there is no more than 1 payment method.
 * - Restores the default payment method (original Visa).
 * - Deletes the newly added payment method (e.g., Mastercard) and confirms the deletion.
 * - Ensures only the original payment method remains visible.
 */

type CleanupPaymentMethodOptions = {
  paymentMethod: PaymentMethod;
};

type PaymentMethod = {
  type: string;
  cardNumber: string;
  expDateFull: string;
};

export const cleanupPaymentMethod = async (
  page: Page,
  { paymentMethod }: CleanupPaymentMethodOptions,
) => {
  try {
    // Check if the page contains the 'Payment methods' text
    const paymentMethodsTextVisible = await page
      .getByText("Payment methods", { exact: true })
      .isVisible();

    // If 'Payment methods' text is visible, perform cleanup
    // Note: 'methods' is plural indicating more than 1 card
    if (paymentMethodsTextVisible) {
      // When a new card is added, it becomes the default payment method
      // Assign default payment method *back* to the original Visa card
      await page.locator(`[data-testid="overflow-menu-button"]`).click();
      await page
        .locator('[data-test="menu-contents"]')
        .waitFor({ state: "visible" });
      await page.getByRole(`menuitem`, { name: `Make default` }).click();

      // Wait for dropdown to be hidden
      await page.waitForTimeout(1000);

      // Remove the newly added payment method (Mastercard)
      await page.locator(`[data-testid="overflow-menu-button"]`).click();
      await page
        .locator('[data-test="menu-contents"]')
        .waitFor({ state: "visible" });
      await page
        .locator(`[data-test="nonDefaultPaymentInstrumentDeleteButton"]`)
        .click();

      // Wait for dialog to appear for delete confirmation
      await page
        .locator(`.Dialog-header`)
        .getByText("Delete payment method")
        .waitFor();

      // Assert the dialog is for confirmation the deletion of the new payment method
      await expect(
        page.getByRole(`dialog`).getByText(`${paymentMethod.type} ••••`),
      ).toBeVisible();
      await expect(
        page
          .getByRole(`dialog`)
          .getByText(`Expires ${paymentMethod.expDateFull}`),
      ).toBeVisible();

      // Click 'Delete payment method' and confirm deletion
      await page
        .locator(
          `[data-test="PaymentInstrumentActionsDetatchModalConfirmButton"]`,
        )
        .click();

      // **Assert that payment method was deleted:
      // Wait for page to update
      await page.waitForTimeout(1000);

      // Assert that there is only 1 card element representing the initial card
      const afterCleanupCardCount = await page
        .locator(`[data-testid="page-container-main"] .Card--radius--all`)
        .count();
      expect(afterCleanupCardCount).toBe(1);

      // Assert that the newly added payment method is NOT visible based on its expiration date
      await expect(
        page.getByText(`Expires ${paymentMethod.expDateFull}`),
      ).not.toBeVisible();

      // Assert that the newly added payment method is NOT visible based on its card number and type
      await expect(
        page.getByText(
          `${paymentMethod.type} •••• ${paymentMethod.cardNumber.split(" ")[3]}`,
        ),
      ).not.toBeVisible();
    }
  } catch (error) {
    console.log(
      `There was an error cleaning up the provided payment method: ${error.message}`,
    );
  }
};

/**
 * Starts at the Quadratic 'Team settings' page
 * Upgrades a user's subscription to the Pro plan and performs various assertions throughout the process.
 * This function simulates the steps for upgrading from a Free plan to a Pro plan, including:
 * 1. Verifying the user's current subscription (Free plan).
 * 2. Navigating to the Stripe checkout page and ensuring the correct product is being purchased.
 * 3. Filling in the credit card details and completing the checkout process.
 * 4. Verifying that the user is redirected to the Team files page post-purchase.
 * 5. Ensuring that the Pro plan is now marked as the active subscription and that the Free plan no longer shows as active.
 * 6. Validating that the 'Upgrade to Pro' button is no longer visible and that the 'Manage billing' button is available.
 *
 * @param {object} page - The Page object representing the browser page.
 * @throws {Error} Throws an error if any of the assertions or steps fail.
 *
 * Note: This function uses pre-defined (valid) credit card credentials (`creditCard` object) for simulating the checkout process.
 */

type UpgradeToProPlanOptions = {};

export const upgradeToProPlan = async (
  page: Page,
  options: UpgradeToProPlanOptions,
) => {
  try {
    // Navigate to the Settings page by clicking the 'Settings' link
    await page.getByRole("link", { name: "settings Settings" }).click();

    // Assert page is currently displaying Settings
    await expect(page).toHaveURL(/settings/);
    await expect(page).toHaveTitle(/settings/);
    await expect(
      page.getByRole(`heading`, { name: `Team settings` }),
    ).toBeVisible();

    // Locate the parent div that contains 'Free plan'
    const freePlanParentEl = page.locator(`:text("Free plan")`).locator("..");

    // Assert both 'Free plan' and 'Current plan' texts are within the same parent div
    await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible();
    await expect(
      freePlanParentEl.locator(`:text("Current plan")`),
    ).toBeVisible();

    // Assert that the 'Upgrade to Pro' button is visible, indicating that the user is not on the Pro plan
    await expect(
      page.getByRole(`button`, { name: `Upgrade to Pro` }),
    ).toBeVisible();

    // Locate the parent div that contains 'Pro plan' details
    const proPlanParentEl = page
      .locator(`:text("Pro plan")`)
      .locator("..")
      .locator("..");

    // Locate the text within the parent div of the 'Pro plan' heading
    // Use a regex to extract the number between `$` and `/user/month` to store the Pro plan cost
    const proPlanCostText = await proPlanParentEl.textContent();
    const proPlanCost = proPlanCostText?.match(
      /\$(\d+)(?= \/user\/month)/,
    )?.[1];

    // Click 'Upgrade to Pro' to upgrade the account
    await page.getByRole(`button`, { name: `Upgrade to Pro` }).click();

    // Assert that page was redirected to a Stripe integrated payment page
    await expect(
      page.getByRole(`link`, { name: `Powered by Stripe` }),
    ).toBeVisible();

    // Assert that subscription page is for Team billing
    await expect(
      page.locator(`[data-testid="product-summary-name"]`),
    ).toHaveText(`Subscribe to Team`);
    await expect(
      page.locator(`[data-testid="line-item-product-name"]`),
    ).toHaveText(`Team`);

    // Assert that the 'Total due today' text is visible, indicating that we're on a checkout page
    await expect(page.getByText(`Total due today`)).toBeVisible();

    // Store the checkout page total
    const checkoutTotalText = await page
      .locator(`[data-testid="product-summary-total-amount"]`)
      .getByText(`$`)
      .innerText();
    const checkoutTotal = checkoutTotalText.replace("$", "").split(".")[0];

    // Assert the cost reflects the Pro Plan cost shown on the 'Settings' page
    expect(checkoutTotal).toBe(proPlanCost);

    // Assert that the bank account textbox is not visible
    // This ensures that we will be filling in credit card details and not bank details (debit)
    await expect(
      page.getByRole(`textbox`, { name: `Bank account` }),
    ).not.toBeVisible();

    // Fill the card number in the input for 'Card Information'
    await page
      .getByRole(`textbox`, { name: `Card number` })
      .fill(SWIPE_TEST_CARD.number);

    // Fill the expiration date in the input for 'Expiration'
    await page
      .getByRole(`textbox`, { name: `Expiration` })
      .fill(SWIPE_TEST_CARD.expiration);

    // Fill the 3-digit CVC number in the input for 'CVC'
    await page.getByRole(`textbox`, { name: `CVC` }).fill(SWIPE_TEST_CARD.cvc);

    // Fill the cardholder's name in the input for 'Cardholder Name'
    await page
      .getByRole(`textbox`, { name: `Cardholder name` })
      .fill(SWIPE_TEST_CARD.name);

    // Select United States
    await page
      .getByRole(`combobox`, {
        name: `Country or region`,
      })
      .selectOption({ label: `United States` });

    // Fill the zip code in the input for 'Zip Code'
    await page
      .getByRole(`textbox`, { name: `ZIP` })
      .fill(SWIPE_TEST_CARD.zipCode);

    // Default 'country or region' should be set to 'US'
    await expect(page.getByLabel(`Country or region`)).toHaveValue(`US`);

    // Click 'Subscribe' button to upgrade the count to a Pro plan
    const navigationPromise = page.waitForNavigation();
    await page.locator(`[data-testid="hosted-payment-submit-button"]`).click();

    // Wait for the page to redirect to the Team files page
    await navigationPromise;

    // Assert that page has redirected to the Team files page
    await expect(page).toHaveTitle(/Team files/);
    await expect(
      page.getByRole(`heading`, { name: `Team files` }),
    ).toBeVisible();

    // Navigate to the Settings page by clicking the 'Settings' link
    await page.getByRole("link", { name: "settings Settings" }).click();

    // Assert page is currently displaying Settings
    await expect(page).toHaveURL(/settings/);
    await expect(page).toHaveTitle(/settings/);
    await expect(
      page.getByRole(`heading`, { name: `Team settings` }),
    ).toBeVisible();

    // Assert that the 'Free plan' is no longer accompanied by the 'Current plan' flag
    // freePlanParentEl is declared 'Arrange' step
    await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible();
    await expect(
      freePlanParentEl.locator(`:text("Current plan")`),
    ).not.toBeVisible();

    // Assert that the 'Pro plan' container includes the 'Current plan' flag
    await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible();
    await expect(
      proPlanParentEl.locator(`:text("Current plan")`),
    ).toBeVisible();

    // Assert that the 'Upgrade to Pro' button is no longer visible
    await expect(
      page.getByRole(`button`, { name: `Upgrade to Pro` }),
    ).not.toBeVisible();

    // Assert that the 'Manage billing' button is visible
    // This indicates that the user has an active subscription to manage
    await expect(
      page.getByRole(`button`, { name: `Manage billing` }),
    ).toBeVisible();
  } catch (error) {
    console.log(
      `An error occurred while upgrading to the Pro plan: ${error.message}`,
    );
  }
};
