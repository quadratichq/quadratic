import { expect, test } from "@playwright/test";
import { logIn } from "../helpers/auth.helpers";
import { cleanupPaymentMethod } from "../helpers/billing.helpers";
import {
  cleanUpFiles,
  createFile,
  navigateIntoFile,
} from "../helpers/file.helpers";

test("AI Message Counter", async ({ page }) => {
  //--------------------------------
  // AI Message Counter
  //--------------------------------

  // Store file name to be created and used for this workflow
  const fileName = `AI Message Counter`;

  // Store message prompts to send to the AI chat
  const promptsToSend = [
    "Hi, can you help me?",
    "What is Quadratic?",
    "Can you create a simple table?",
    "Can you delete all the contents in my file?",
  ];

  // Store prompts count that we're expecting to send to the AI chat
  // This number can be used as the expected number of responses from AI
  const promptsToSendCount = promptsToSend.length;

  // Use the following dedicated account for Pro account WFs
  const emailPrefix = "e2e_ai_message_count";

  // Log into Quadratic
  await logIn(page, { emailPrefix });

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole("link", { name: "settings Settings" }).click();

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(
    page.getByRole(`heading`, { name: `Team settings` }),
  ).toBeVisible();

  // Assert that 'Your AI messages' stat is available on the page
  await expect(page.getByText(`Your AI messages`)).toBeVisible();

  // Locate the text element that starts with 'Your AI messages' followed by a number
  // Store the text content (e.g., 'Your AI messages303')
  const aiMessageCountText = await page
    .locator("text=/^Your AI messages\\d+$/")
    .textContent();
  expect(aiMessageCountText).toBeDefined();

  // Extract the numerical value after 'Your AI messages'
  // The match returns an array where the first element is the number we need
  // The aiMessageCount now contains the current message count (e.g., "303")
  const aiMessageCount = Number(aiMessageCountText?.match(/\d+/)?.[0]);

  // Return to file directory page
  await page.getByRole(`link`, { name: `draft Files` }).click();

  // Assert that we're at the files page before triggering cleanup & creating a new file
  await expect(page.getByRole(`heading`, { name: `Team files` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `New file` })).toBeVisible();

  // Clean up files that were previously created by this WF
  await cleanUpFiles(page, { fileName, skipFilterClear: false });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName, skipClose: false });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click on the Chat icon in left sidebar
  await page.getByRole(`button`, { name: `auto_awesome` }).click();

  // Assert the chat is open based on heading text
  await expect(page.getByText(`Sheet chat`)).toBeVisible();
  await expect(
    page.getByRole(`heading`, { name: `What can I help with?` }),
  ).toBeVisible();
  await page.waitForTimeout(1000);
  // Iterate through the pre-defined prompt messages and send them one by one to the chat
  for (let i = 0; i < promptsToSend.length; i++) {
    // Prompt the AI
    await page.getByPlaceholder("Ask a question...").fill(promptsToSend[i]);

    // Click the button with the "arrow_upward" icon to submit the prompt
    await page.locator('span:has-text("arrow_upward")').click();

    // Assert the user prompt is visible in chat history
    const userPrompt = page.locator(`form`).nth(i);
    await expect(userPrompt).toContainText(promptsToSend[i]);

    // Assert no 403 Error Message is visible
    await expect(page.locator('.markdown :text("403")')).not.toBeVisible();

    // Wait for the AI response to appear (ensure the AI's response is visible)
    const aiResponse = page.locator('div[class="markdown"]').last();
    await expect(aiResponse).toBeVisible();

    // Assert that the 'Cancel Generating' button appears while AI is generating and disappears afterwards
    await expect(
      page.getByRole("button", { name: "backspace Cancel generating" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "backspace Cancel generating" }),
    ).toBeHidden({ timeout: 60000 });
  }

  // Navigate back to the Settings page to check the message counter
  await page.locator(`[href="/"]`).click();
  await page.getByRole(`link`, { name: `settings Settings` }).click();

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(
    page.getByRole(`heading`, { name: `Team settings` }),
  ).toBeVisible();

  // Assert that 'Your AI messages' stat is available on the page
  await expect(page.getByText(`Your AI messages`)).toBeVisible();

  // Locate the text element that starts with 'Your AI messages' followed by a number
  // Store the text content (e.g., 'Your AI messages303')
  const updatedAiMessageCountText = await page
    .locator("text=/^Your AI messages\\d+$/")
    .textContent();
  expect(updatedAiMessageCountText).toBeDefined();

  // Extract the numerical value after 'Your AI messages'
  const updatedAiMessageCount = Number(
    updatedAiMessageCountText?.match(/\d+/)?.[0],
  );

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the current AI message count should NOT equal the original message count
  expect(updatedAiMessageCount).not.toBe(aiMessageCount);

  // Assert that the AI message count should be increased by the number of prompts that were sent
  expect(updatedAiMessageCount).toBe(aiMessageCount + promptsToSendCount);

  // **Cleanup**
  // Navigate back to homepage to trigger cleanup
  await page.getByRole(`link`, { name: `draft Files` }).click();

  // Assert that we're at the files page before trigger cleanup
  await expect(page.getByRole(`heading`, { name: `Team files` })).toBeVisible();
  await expect(page.getByRole(`button`, { name: `New file` })).toBeVisible();

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName, skipFilterClear: false });
});

test("Manage Billing - Add Payment Method", async ({ page }) => {
  //--------------------------------
  // Manage Billing - Add Payment Method
  //--------------------------------

  // New payment method to add to account
  // Has different card number & expiration (than the one used to upgrade to Pro plan)
  const paymentMethod = {
    type: "Mastercard",
    cardNumber: "5555 5555 5555 4444",
    expDate: "03/40",
    expDateFull: "03/2040",
    cvc: "424",
    zipCode: "90210",
  };

  // Log into Quadratic
  const emailAddress = await logIn(page, {});

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole("link", { name: "settings Settings" }).click();

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(
    page.getByRole(`heading`, { name: `Team settings` }),
  ).toBeVisible();

  //--------------------------------
  // Act:
  //--------------------------------

  // Locate the parent divs that contains 'Pro plan' and 'Free plan' details
  const proPlanParentEl = page
    .locator(`:text("Pro plan")`)
    .locator("..")
    .locator("..");
  const freePlanParentEl = page.locator(`:text("Free plan")`).locator("..");

  // Assert that the 'Free plan' is not accompanied by the 'Current plan' flag
  // freePlanParentEl is declared 'Arrange' step
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible();
  await expect(
    freePlanParentEl.locator(`:text("Current plan")`),
  ).not.toBeVisible();

  // Assert that the 'Pro plan' container includes the 'Current plan' flag
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible();
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).toBeVisible();

  // Assert that the 'Upgrade to Pro' button is no longer visible
  await expect(
    page.getByRole(`button`, { name: `Upgrade to Pro` }),
  ).not.toBeVisible();

  // Navigate to the billing management page
  await page.getByRole(`button`, { name: `Manage billing` }).click();

  // **Cleanup** Remove the extra payment method if it was leftover from previous WF
  await cleanupPaymentMethod(page, { paymentMethod });

  // Assert that the current page is the billing management page
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible();
  await expect(page.getByText(`Payment method`, { exact: true })).toBeVisible();

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible();

  // Store the credit card details from the initial payment method used to upgrade to Pro
  const initialPaymentEl = await page
    .locator(`[data-testid="page-container-main"] .Box-hideIfEmpty`)
    .nth(21)
    .innerText();
  const [initialPaymentNum, _, initialPaymentExpiry] =
    initialPaymentEl.split("\n");

  // Click 'Add payment method' to add an additional payment method
  await page.getByRole(`link`, { name: `Add payment method` }).click();

  // Assert that we're currently on a page to add a new payment method
  await expect(page).toHaveURL(/pay/);
  await expect(page).toHaveTitle(/Add payment method/);
  await expect(page.getByText(`Add payment method`)).toBeVisible();

  // Wait for the Stripe iframe to be available
  const iframeLocator = page.locator(".__PrivateStripeElement iframe").first();

  // Access the content of the iframe
  const iframe = iframeLocator.contentFrame();

  // Wait for the input elements inside the iframe to load
  await iframe.locator('input[name="number"]').waitFor();
  await iframe.locator('input[name="expiry"]').waitFor();
  await iframe.locator('input[name="cvc"]').waitFor();
  // await iframe.locator('input[name="postalCode"]').waitFor();
  await page.locator(`[data-testid="confirm"]`).waitFor({ state: "attached" });

  // Fill the card details in the iframe
  // Card details include: card number, expiration date, CVC number, and zip code
  await iframe.locator('input[name="number"]').fill(paymentMethod.cardNumber);
  await iframe.locator('input[name="expiry"]').fill(paymentMethod.expDate);
  await iframe.locator('input[name="cvc"]').fill(paymentMethod.cvc);
  await iframe.locator('select[name="country"]').selectOption("US");
  await iframe.locator('input[name="postalCode"]').fill(paymentMethod.zipCode);

  // Wait 1s to ensure the form 'Add' button is active
  await page.waitForTimeout(1000);

  // Click 'Submit' button to add the new payment method after it is enabled
  await expect(page.locator(`[data-testid="confirm"]`)).toBeEnabled();
  await page.locator(`[data-testid="confirm"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-testid="confirm"]`).click();

  // Assert that the current page is the billing management page (redirected from the previous page)
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible();
  await expect(
    page.getByText(`Payment methods`, { exact: true }),
  ).toBeVisible();

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that there are two card elements representing each card (initial card and newly added payment card)
  const newCardCount = await page
    .locator(`[data-testid="page-container-main"] .Card--radius--all`)
    .count();
  expect(newCardCount).toBe(2);

  // Assert that the previously added payment method is still visible, based on its expiration date
  await expect(page.getByText(initialPaymentExpiry)).toBeVisible();

  // Assert that the previously added payment method is still visible, based on its card type & card number
  await expect(page.getByText(initialPaymentNum)).toBeVisible();

  // Assert that the newly added payment method is visible based on its expiration date
  await expect(
    page.getByText(`Expires ${paymentMethod.expDateFull}`),
  ).toBeVisible();

  // Assert that the newly added payment method is visible based on its card number and type
  await expect(
    page.getByText(
      `${paymentMethod.type} •••• ${paymentMethod.cardNumber.split(" ")[3]}`,
    ),
  ).toBeVisible();

  // **Cleanup** Remove the newly added payment method from this account
  await cleanupPaymentMethod(page, { paymentMethod });
});
