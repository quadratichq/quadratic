import { expect, type Page } from "@playwright/test";

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
    } else {
      console.log('Page does not contain "Payment methods", skipping cleanup.');
    }
  } catch (error) {
    console.log(
      `There was an error cleaning up the provided payment method: ${error.message}`,
    );
  }
};
