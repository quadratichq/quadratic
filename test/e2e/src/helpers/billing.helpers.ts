import { expect, type Page } from '@playwright/test';
import { SWIPE_TEST_CARD } from '../constants/billing';
import { buildUrl } from './buildUrl.helpers';

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

export const cleanupPaymentMethod = async (page: Page, { paymentMethod }: CleanupPaymentMethodOptions) => {
  try {
    // Check if the page contains the 'Payment methods' text
    const paymentMethodsTextVisible = await page.getByText('Payment methods', { exact: true }).isVisible();

    // If 'Payment methods' text is visible, perform cleanup
    // Note: 'methods' is plural indicating more than 1 card
    if (paymentMethodsTextVisible) {
      // When a new card is added, it becomes the default payment method
      // Assign default payment method *back* to the original Visa card
      await page.locator(`[data-testid="overflow-menu-button"]`).click({ timeout: 60 * 1000 });
      await page.locator('[data-test="menu-contents"]').waitFor({ state: 'visible' });
      await page.getByRole(`menuitem`, { name: `Make default` }).click({ timeout: 60 * 1000 });

      // Wait for dropdown to be hidden
      await page.waitForTimeout(5 * 1000);

      // Remove the newly added payment method (Mastercard)
      await page.locator(`[data-testid="overflow-menu-button"]`).click({ timeout: 60 * 1000 });
      await page.locator('[data-test="menu-contents"]').waitFor({ state: 'visible' });
      await page.locator(`[data-test="nonDefaultPaymentInstrumentDeleteButton"]`).click({ timeout: 60 * 1000 });

      // Wait for dialog to appear for delete confirmation
      await page.locator(`.Dialog-header`).getByText('Delete payment method').waitFor();

      // Assert the dialog is for confirmation the deletion of the new payment method
      await expect(page.getByRole(`dialog`).getByText(`${paymentMethod.type} ••••`)).toBeVisible({
        timeout: 60 * 1000,
      });
      await expect(page.getByRole(`dialog`).getByText(`Expires ${paymentMethod.expDateFull}`)).toBeVisible({
        timeout: 60 * 1000,
      });

      // Click 'Delete payment method' and confirm deletion
      await page
        .locator(`[data-test="PaymentInstrumentActionsDetatchModalConfirmButton"]`)
        .click({ timeout: 60 * 1000 });

      // **Assert that payment method was deleted:
      // Wait for page to update
      await page.waitForTimeout(5 * 1000);

      // Assert that there is only 1 card element representing the initial card
      const afterCleanupCardCount = await page
        .locator(`[data-testid="page-container-main"] .Card--radius--all`)
        .count();
      expect(afterCleanupCardCount).toBe(1);

      // Assert that the newly added payment method is NOT visible based on its expiration date
      await expect(page.getByText(`Expires ${paymentMethod.expDateFull}`)).not.toBeVisible({ timeout: 60 * 1000 });

      // Assert that the newly added payment method is NOT visible based on its card number and type
      await expect(
        page.getByText(`${paymentMethod.type} •••• ${paymentMethod.cardNumber.split(' ')[3]}`)
      ).not.toBeVisible({ timeout: 60 * 1000 });
    }
  } catch (error: any) {
    console.log(`There was an error cleaning up the provided payment method: ${error.message}`);
  }
};

/**
 * Starts at the Quadratic 'Team settings' page
 * Upgrades a user's subscription to the Pro plan and performs various assertions throughout the process.
 * This function simulates the steps for upgrading from a Free plan to a Pro plan, including:
 * 1. Verifying the user's current subscription (Free plan).
 * 2. Navigating to the Stripe checkout page and ensuring the correct product is being purchased.
 * 3. Filling in the credit card details and completing the checkout process.
 * 4. Verifying that the user is redirected to the dashboard page post-purchase.
 * 5. Ensuring that the Pro plan is now marked as the active subscription and that the Free plan no longer shows as active.
 * 6. Validating that the 'Upgrade to Pro' button is no longer visible and that the 'Manage billing' button is available.
 * Note: This function uses pre-defined (valid) credit card credentials (`creditCard` object) for simulating the checkout process.
 */
export const upgradeToProPlan = async (page: Page) => {
  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForLoadState('domcontentloaded');

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  // Locate the parent div that contains 'Free plan'
  const freePlanParentEl = page.locator(`:text("Free plan")`).locator('..');

  // Assert both 'Free plan' and 'Current plan' texts are within the same parent div
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(freePlanParentEl.locator(`:text("Current plan")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Upgrade to Pro' button is visible, indicating that the user is not on the Pro plan
  await expect(page.locator(`[data-testid="billing-upgrade-to-pro-button"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Locate the parent div that contains 'Pro plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');

  // Click 'Upgrade to Pro' to upgrade the account
  await page.locator(`[data-testid="billing-upgrade-to-pro-button"]`).click({ timeout: 60 * 1000 });

  // Assert that page was redirected to a Stripe integrated payment page
  await expect(page.getByRole(`link`, { name: `Powered by Stripe` })).toBeVisible({ timeout: 60 * 1000 });

  // Assert that subscription page is for Team billing
  await expect(page.locator(`[data-testid="product-summary-name"]`)).toHaveText(`Subscribe to Team`);
  await expect(page.locator(`[data-testid="line-item-product-name"]`)).toHaveText(`Team`);

  // Assert that the 'Total due today' text is visible, indicating that we're on a checkout page
  await expect(page.getByText(`Total due today`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the bank account textbox is not visible
  // This ensures that we will be filling in credit card details and not bank details (debit)
  await expect(page.getByRole(`textbox`, { name: `Bank account` })).not.toBeVisible({ timeout: 60 * 1000 });

  // Fill the card number in the input for 'Card Information'
  await page.getByRole(`textbox`, { name: `Card number` }).fill(SWIPE_TEST_CARD.number);

  // Fill the expiration date in the input for 'Expiration'
  await page.getByRole(`textbox`, { name: `Expiration` }).fill(SWIPE_TEST_CARD.expiration);

  // Fill the 3-digit CVC number in the input for 'CVC'
  await page.getByRole(`textbox`, { name: `CVC` }).fill(SWIPE_TEST_CARD.cvc);

  // Fill the cardholder's name in the input for 'Cardholder Name'
  await page.getByRole(`textbox`, { name: `Cardholder name` }).fill(SWIPE_TEST_CARD.name);

  // Select United States
  await page
    .getByRole(`combobox`, {
      name: `Country or region`,
    })
    .selectOption({ label: `United States` });

  // Fill the zip code in the input for 'Zip Code'
  await page.getByRole(`textbox`, { name: `ZIP` }).fill(SWIPE_TEST_CARD.zipCode);

  // Default 'country or region' should be set to 'US'
  await expect(page.getByLabel(`Country or region`)).toHaveValue(`US`);

  // Click 'Subscribe' button to upgrade the count to a Pro plan
  const navigationPromise = page.waitForNavigation();
  await page.locator(`[data-testid="hosted-payment-submit-button"]`).click({ timeout: 60 * 1000 });

  // Wait for the page to redirect to the dashboard page
  await navigationPromise;
  await page.waitForLoadState('domcontentloaded');

  // Assert page is currently displaying Settings (with extended timeout for post-payment redirect)
  await expect(page).toHaveURL(/settings/, { timeout: 90 * 1000 });
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 90 * 1000 });

  // Assert that the 'Free plan' is no longer accompanied by the 'Current plan' flag
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(freePlanParentEl.locator(`:text("Current plan")`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Pro plan' container includes the 'Current plan' flag
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Upgrade to Pro' button is no longer visible
  await expect(page.locator(`[data-testid="billing-upgrade-to-pro-button"]`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Assert that the 'Manage billing' button is visible
  // This indicates that the user has an active subscription to manage
  await expect(page.getByRole(`button`, { name: `Manage subscription` })).toBeVisible({ timeout: 60 * 1000 });

  await page.goto(buildUrl(), { waitUntil: 'domcontentloaded' });
};

type InviteUserToTeamOptions = {
  email: string;
  permission: string;
};

export const inviteUserToTeam = async (page: Page, { email, permission }: InviteUserToTeamOptions) => {
  // Navigate to Members page
  await page.locator(`nav :text-is("Members")`).click({ timeout: 60 * 1000 });
  await expect(page.locator(`h1:has-text("Team members")`)).toBeVisible({ timeout: 60 * 1000 });
  await page.locator(`[aria-label="Email"]`).fill(email);
  const currentPermission = await page.locator(`button[role="combobox"]`).first().textContent();
  if (currentPermission !== permission) {
    await page
      .locator(`button[role="combobox"]`)
      .first()
      .click({ timeout: 60 * 1000 });
    await page
      .locator(`[role="option"] :text("${permission}")`)
      .last()
      .click({ timeout: 60 * 1000 });
  }
  await page.locator(`button:text("Invite")`).click({ timeout: 60 * 1000 });
  await expect(page.locator(`[data-testid="share-dialog-list-item"]:has-text("${email}")`)).toBeVisible({
    timeout: 60 * 1000,
  });
};

/**
 * Starts at the Quadratic homepage.
 * Removes a team member from the Pro Plan and verifies billing and member count details.
 *
 * @param {object} page - The Page object representing the browser page.
 * @param {string} emailAddress - The account email for billing verification.
 * @param {string} additionalUserEmail - The email of the member to remove.
 */

type DeleteMemberFromProPlanOptions = {
  emailAddress: string;
  additionalUserEmail: string;
};

export const deleteMemberFromProPlan = async (
  page: Page,
  { emailAddress, additionalUserEmail }: DeleteMemberFromProPlanOptions
) => {
  try {
    // Navigate to the Team Members page by clicking 'Members'
    await page.getByRole(`link`, { name: `group Members` }).click({ timeout: 60 * 1000 });

    // Assert that we've navigated to the team management page
    await expect(page.getByRole(`heading`, { name: `Team members` })).toBeVisible({ timeout: 60 * 1000 });
    await expect(page).toHaveURL(/members/);

    // Only execute cleanup if the additional user's email is on the team members page
    const isVisible = await page.getByText(additionalUserEmail).first().isVisible();
    if (isVisible) {
      // Click 'Can Edit' to open the dropdown menu
      await page
        .locator(`[role="combobox"]`)
        .last()
        .click({ timeout: 60 * 1000 });

      // Select 'Remove' to delete this user from the team
      await page
        .getByRole(`option`, { name: `Remove` })
        .locator(`span`)
        .first()
        .click({ timeout: 60 * 1000 });

      await page.locator('[role="alertdialog"] button:has-text("Remove")').click({ timeout: 60 * 1000 });

      // Assert that the team member that was added earlier in the WF is now removed
      await expect(page.getByText(additionalUserEmail).first()).not.toBeVisible({ timeout: 60 * 1000 });

      // Navigate back to Settings page
      await page.getByRole(`link`, { name: `settings Settings` }).click({ timeout: 60 * 1000 });

      await page.waitForTimeout(5 * 1000);
      await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

      // Locate the text element that starts with 'Team members (manage)' followed by a number
      // Store the text content (e.g., 'Team members (manage)1'
      const afterCleanupMemberCountText = await page.locator('text=/^Team members \\(manage\\)\\d+$/').textContent();
      const afterCleanupMemberCount = Number(afterCleanupMemberCountText?.match(/\d+/)?.[0]);

      // Assert that the team member count should be back to 1
      expect(afterCleanupMemberCount).toBe(1);

      // Navigate to billing management page
      await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

      // Assert the account email address is displayed on the billing page
      await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

      // Assert that the 'Cancel Subscription' button appears
      await expect(page.locator(`[data-testid="cancel-subscription"]`)).toBeVisible({ timeout: 60 * 1000 });

      // Assert that the page reflects the base Pro plan cost
      await expect(page.getByText(`$20.00 per month`)).toBeVisible({ timeout: 60 * 1000 });

      // Assert that the page does not include the Pro plan cost + 1 extra member
      await expect(page.getByText(`$40.00 per month`)).not.toBeVisible({ timeout: 60 * 1000 });

      // Navigate to homepage
      await page.locator(`[data-testid="return-to-business-link"]`).click({ timeout: 60 * 1000 });

      await page.waitForLoadState('domcontentloaded');
    }
  } catch (error: any) {
    console.log(`There was an error when deleting the team member from the Pro Plan: ${error.message}`);
  }
};

/**
 * Starts at the 'Billing Management' page and resets the billing information to default values by:
 * - Navigating to the billing information section.
 * - Filling the fields with default values (e.g., 'My Team' for Name, 'N/A' for Address).
 * - Saving the changes.
 */
export const resetBillingInformation = async (page: Page) => {
  try {
    // Click 'Update information' to update the billing info
    await page.getByRole(`button`, { name: `Update information` }).click({ timeout: 60 * 1000 });

    // Assert that the page displays 'Billing Information'
    await expect(page.locator(`form`).getByText(`Billing information`)).toBeVisible({ timeout: 60 * 1000 });

    // Assert that 'Name', 'Email', 'Address' and 'Phone Number' fields are available to update
    await expect(
      page
        .locator(`div`)
        .filter({ hasText: /^Name$/ })
        .first()
    ).toBeVisible({ timeout: 60 * 1000 });
    await expect(
      page
        .locator(`div`)
        .filter({ hasText: /^Email$/ })
        .first()
    ).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.locator(`div`).filter({ hasText: /^Address$/ })).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.locator(`div`).filter({ hasText: /^Phone number$/ })).toBeVisible({ timeout: 60 * 1000 });

    // Assert that there are options to 'Save' or 'Cancel' any changes
    await expect(page.locator(`[data-testid="confirm"]`)).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.locator(`[data-test="cancel"]`)).toBeVisible({ timeout: 60 * 1000 });

    // Fill 'Name' textbox with the default name: 'My Team'
    await page.getByRole(`textbox`, { name: `Name` }).fill('My Team');

    // Update the remaining billing information (address, city, state, zip)
    await page.getByRole(`textbox`, { name: `Address line 1` }).fill(`N/A`);
    await page.getByRole(`textbox`, { name: `Address line 2` }).fill(``);
    await page.getByRole(`textbox`, { name: `City` }).fill(`N/A`);
    await page.getByLabel(`State`).click({ timeout: 60 * 1000 });
    await page.getByLabel(`State`).type(`Alabama`);
    await page.getByLabel(`State`).press('Enter');
    await page.getByRole(`textbox`, { name: `ZIP` }).fill(`95014`);

    // Click 'Save' button to confirm the changes
    await page.locator(`[data-testid="confirm"]`).click({ timeout: 60 * 1000 });

    // Assert that the name is back to the original 'My Team'
    await expect(page.getByText(`NameMy Team`)).toBeVisible({ timeout: 60 * 1000 });

    // Assert that the billing address is just placeholder text
    await expect(page.getByText(`N/A`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.getByText(`N/A, AL 95014 US`)).toBeVisible({ timeout: 60 * 1000 });
  } catch (error: any) {
    console.log(`There was an error cleaning up the billing information: ${error.message}.`);
  }
};

/**
 * Starts at the Quadratic 'Team settings' page
 * Cancels a user's Pro subscription and performs various assertions throughout the process.
 * This function simulates the steps for cancelling an active Pro plan subscription, including:
 *
 * 1. Verifying the user's current page is the 'Settings' page.
 * 2. Navigating to the 'Billing' management page and ensuring key sections are visible (current subscription, payment methods, etc.).
 * 3. Clicking the 'Cancel subscription' button to initiate cancellation.
 * 4. Verifying that the cancellation confirmation page appears.
 * 5. Confirming that the subscription cancellation is completed and displayed correctly in the dialog.
 * 6. Ensuring that the 'Renew Subscription' button appears, confirming the cancellation.
 * 7. Validating that the cancellation date is displayed.
 * 8. Returning to the homepage to complete the process.
 */
export const cancelProPlan = async (page: Page) => {
  try {
    // Assert page is currently displaying Settings
    await expect(page).toHaveURL(/settings/);
    await expect(page).toHaveTitle(/settings/);
    await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

    // Click 'Manage billing' to reach the billing management page
    await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

    await page.waitForTimeout(5 * 1000);
    await page.waitForLoadState('domcontentloaded');

    // Assert that the current page is the billing management page
    // Check for information that includes: current subscription, payment methods, billing info and invoice history
    await expect(page).toHaveTitle(/Billing/);
    await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.getByText(/Payment method[s]?/, { exact: true })).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.getByText(`Billing information`)).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.getByText(`Invoice history`)).toBeVisible({ timeout: 60 * 1000 });

    // Click 'Cancel subscription' button
    await page.locator(`[data-testid="cancel-subscription"]`).click({ timeout: 60 * 1000 });

    // Assert that the page to confirm the cancellation appears
    await expect(page).toHaveTitle(/Cancel subscription/);
    await expect(page.getByText(`Cancel your subscription`)).toBeVisible({ timeout: 60 * 1000 });

    // Store the text content of the main page container and remove the extra spaces
    const cancelSubscriptionRawText = await page.locator('[data-testid="page-container-main"]').textContent();
    const cancelSubscriptionText = cancelSubscriptionRawText?.replace(/\s+/g, ' ')?.trim();

    // Assert that the normalized text contains the expected phrase
    expect(cancelSubscriptionText).toContain('subscription will be canceled');

    // Click 'Cancel subscription" to confirm the cancellation
    await page.locator(`[data-testid="confirm"]`).click({ timeout: 60 * 1000 });

    // Wait for the cancellation confirmation dialog to appear
    await page.getByRole(`dialog`).waitFor();

    // Assert that the dialog contains the text "Subscription has been cancelled" to confirm cancellation
    await expect(page.locator(`[role="dialog"] span`).nth(1)).toHaveText(`Subscription has been canceled`);

    // Click 'No thanks' to exit the dialog
    await page.locator(`[data-testid="cancellation_reason_cancel"]`).click({ timeout: 60 * 1000 });

    // Assert that the subscription has been cancelled by checking for 'Renew Subscription' button to appear
    await expect(page.locator(`[data-test="renew-subscription"]`)).toBeVisible({ timeout: 60 * 1000 });

    // Assert that the cancellation date is visible
    await expect(page.locator(`[data-test="subscription-cancel-at-period-end-badge"]`)).toBeVisible({
      timeout: 60 * 1000,
    });

    // End cleanup by navigating to the homepage
    await page.locator(`[data-testid="return-to-business-link"]`).click({ timeout: 60 * 1000 });

    await page.waitForLoadState('domcontentloaded');
  } catch (error: any) {
    console.log(`An error occurred while cancelling the Pro plan: ${error.message}`);
  }
};
