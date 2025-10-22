import { chromium, expect, test } from '@playwright/test';
import { DUMMY_USER_EMAIL } from './constants/auth';
import { logIn } from './helpers/auth.helpers';
import {
  cancelProPlan,
  cleanupPaymentMethod,
  deleteMemberFromProPlan,
  inviteUserToTeam,
  resetBillingInformation,
  upgradeToProPlan,
} from './helpers/billing.helpers';
import { buildUrl } from './helpers/buildUrl.helpers';
import { cleanUpFiles, createFile, navigateIntoFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test.skip('AI Message Counter', async ({ page }) => {
  //--------------------------------
  // AI Message Counter
  //--------------------------------

  // Store file name to be created and used for this workflow
  const fileName = `AI Message Counter`;

  // Store message prompts to send to the AI chat
  const promptsToSend = [
    'Hi, can you help me?',
    'What is Quadratic?',
    'Can you create a simple table?',
    'Can you delete all the contents in my file?',
  ];

  // Store prompts count that we're expecting to send to the AI chat
  // This number can be used as the expected number of responses from AI
  const promptsToSendCount = promptsToSend.length;

  // Log into Quadratic
  await logIn(page, { emailPrefix: 'e2e_ai_message_count' });

  // Create new team
  const teamName = `AI Counter - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  // Assert that 'Your AI messages' stat is available on the page
  await expect(page.getByText(`Your AI messages`)).toBeVisible({ timeout: 60 * 1000 });

  // Locate the text element that starts with 'Your AI messages' followed by a number
  // Store the text content (e.g., 'Your AI messages303')
  const aiMessageCountText = await page.locator('text=/^Your AI messages\\d+$/').textContent();
  expect(aiMessageCountText).toBeDefined();

  // Extract the numerical value after 'Your AI messages'
  // The match returns an array where the first element is the number we need
  // The aiMessageCount now contains the current message count (e.g., "303")
  const aiMessageCount = Number(aiMessageCountText?.match(/\d+/)?.[0]);

  // Return to file directory page
  await page.getByRole(`link`, { name: `draft Files` }).click({ timeout: 60 * 1000 });

  // Assert that we're at the files page before triggering cleanup & creating a new file
  await expect(page.getByRole(`heading`, { name: `Team files` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `New file` })).toBeVisible({ timeout: 60 * 1000 });

  // Clean up files that were previously created by this WF
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click on the Chat icon in left sidebar
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Assert the chat is open based on heading text
  await expect(page.getByText(`Sheet chat`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`heading`, { name: `What can I help with?` })).toBeVisible({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);
  // Iterate through the pre-defined prompt messages and send them one by one to the chat
  for (let i = 0; i < promptsToSend.length; i++) {
    // Prompt the AI
    await page.getByPlaceholder('Ask a question...').fill(promptsToSend[i]);

    // Click the button with the "arrow_upward" icon to submit the prompt
    await page.locator('span:has-text("arrow_upward")').click({ timeout: 60 * 1000 });

    // Assert the user prompt is visible in chat history
    const userPrompt = page.locator(`form`).nth(i);
    await expect(userPrompt).toContainText(promptsToSend[i]);

    // Assert no 403 Error Message is visible
    await expect(page.locator('.markdown :text("403")')).not.toBeVisible({ timeout: 60 * 1000 });

    // Wait for the AI response to appear (ensure the AI's response is visible)
    const aiResponse = page.locator('div[class="markdown"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 60 * 1000 });

    // Assert that the 'Cancel Generating' button appears while AI is generating and disappears afterwards
    await expect(page.getByRole('button', { name: 'backspace Cancel generating' })).toBeVisible({ timeout: 60 * 1000 });
    await expect(page.getByRole('button', { name: 'backspace Cancel generating' })).toBeHidden({ timeout: 60000 });
  }

  // Navigate back to the Settings page to check the message counter
  await page.locator(`[href="/"]`).click({ timeout: 60 * 1000 });
  await page.getByRole(`link`, { name: `settings Settings` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  // Assert that 'Your AI messages' stat is available on the page
  await expect(page.getByText(`Your AI messages`)).toBeVisible({ timeout: 60 * 1000 });

  // Locate the text element that starts with 'Your AI messages' followed by a number
  // Store the text content (e.g., 'Your AI messages303')
  const updatedAiMessageCountText = await page.locator('text=/^Your AI messages\\d+$/').textContent();
  expect(updatedAiMessageCountText).toBeDefined();

  // Extract the numerical value after 'Your AI messages'
  const updatedAiMessageCount = Number(updatedAiMessageCountText?.match(/\d+/)?.[0]);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the current AI message count should NOT equal the original message count
  expect(updatedAiMessageCount).not.toBe(aiMessageCount);

  // Assert that the AI message count should be increased by the number of prompts that were sent
  expect(updatedAiMessageCount).toBe(aiMessageCount + promptsToSendCount);

  // **Cleanup**
  // Navigate back to homepage to trigger cleanup
  await page.getByRole(`link`, { name: `draft Files` }).click({ timeout: 60 * 1000 });

  // Assert that we're at the files page before trigger cleanup
  await expect(page.getByRole(`heading`, { name: `Team files` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `New file` })).toBeVisible({ timeout: 60 * 1000 });

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });
});

test('Manage Billing - Add Payment Method', async ({ page }) => {
  //--------------------------------
  // Manage Billing - Add Payment Method
  //--------------------------------

  // New payment method to add to account
  // Has different card number & expiration (than the one used to upgrade to Pro plan)
  const paymentMethod = {
    type: 'Mastercard',
    cardNumber: '5555 5555 5555 4444',
    expDate: '03/40',
    expDateFull: '03/2040',
    cvc: '424',
    zipCode: '90210',
  };

  // Log into Quadratic
  const emailAddress = await logIn(page, { emailPrefix: 'e2e_add_payment' });

  // Create new team
  const teamName = `Team - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Locate the parent divs that contains 'Pro plan' and 'Free plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');
  const freePlanParentEl = page.locator(`:text("Free plan")`).locator('..');

  // Assert that the 'Free plan' is not accompanied by the 'Current plan' flag
  // freePlanParentEl is declared 'Arrange' step
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(freePlanParentEl.locator(`:text("Current plan")`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Pro plan' container includes the 'Current plan' flag
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Upgrade to Pro' button is no longer visible
  await expect(page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Navigate to the billing management page
  await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // **Cleanup** Remove the extra payment method if it was leftover from previous WF
  await cleanupPaymentMethod(page, { paymentMethod });

  // Assert that the current page is the billing management page
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Payment method`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

  // Store the credit card details from the initial payment method used to upgrade to Pro
  const initialPaymentEl = await page.locator(`:below(:text("Payment Method")) >>nth=0`).innerText();
  const [initialPaymentNum, , initialPaymentExpiry] = initialPaymentEl.split('\n');

  // Click 'Add payment method' to add an additional payment method
  await page.getByRole(`link`, { name: `Add payment method` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert that we're currently on a page to add a new payment method
  await expect(page).toHaveURL(/pay/);
  await expect(page).toHaveTitle(/Add payment method/);
  await expect(page.getByText(`Add payment method`)).toBeVisible({ timeout: 60 * 1000 });

  // Wait for the Stripe iframe to be available
  const iframeLocator = page.locator('.__PrivateStripeElement iframe').first();

  // Access the content of the iframe
  const iframe = iframeLocator.contentFrame();

  // Wait for the input elements inside the iframe to load
  await iframe.locator('input[name="number"]').waitFor();
  await iframe.locator('input[name="expiry"]').waitFor();
  await iframe.locator('input[name="cvc"]').waitFor();
  await page.locator(`[data-testid="confirm"]`).waitFor({ state: 'attached' });

  // Fill the card details in the iframe
  // Card details include: card number, expiration date, CVC number, and zip code
  await iframe.locator('input[name="number"]').fill(paymentMethod.cardNumber);
  await iframe.locator('input[name="expiry"]').fill(paymentMethod.expDate);
  await iframe.locator('input[name="cvc"]').fill(paymentMethod.cvc);
  await iframe.locator('select[name="country"]').selectOption('US');
  await iframe.locator('input[name="postalCode"]').fill(paymentMethod.zipCode);

  // Wait 1s to ensure the form 'Add' button is active
  await page.waitForTimeout(5 * 1000);

  // Click 'Submit' button to add the new payment method after it is enabled
  await expect(page.locator(`[data-testid="confirm"]`)).toBeEnabled();
  await page.locator(`[data-testid="confirm"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-testid="confirm"]`).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert that the current page is the billing management page (redirected from the previous page)
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Payment methods`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that there are two card elements representing each card (initial card and newly added payment card)
  const newCardCount = await page.locator(`[data-testid="page-container-main"] .Card--radius--all`).count();
  expect(newCardCount).toBe(2);

  // Assert that the previously added payment method is still visible, based on its expiration date
  await expect(page.getByText(initialPaymentExpiry)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the previously added payment method is still visible, based on its card type & card number
  await expect(page.getByText(initialPaymentNum)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the newly added payment method is visible based on its expiration date
  await expect(page.getByText(`Expires ${paymentMethod.expDateFull}`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the newly added payment method is visible based on its card number and type
  await expect(page.getByText(`${paymentMethod.type} •••• ${paymentMethod.cardNumber.split(' ')[3]}`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // **Cleanup** Remove the newly added payment method from this account
  await cleanupPaymentMethod(page, { paymentMethod });
});

test('Add user to a Team with existing Pro Plan', async ({ page }) => {
  //--------------------------------
  // Add user to a Team with existing Pro Plan
  //--------------------------------

  const user2Browser = await chromium.launch();
  const userPage2 = await user2Browser.newPage();

  // login 2 users
  const [emailAddress, user2Email] = await Promise.all([
    logIn(page, { emailPrefix: 'e2e_add_to_pro' }),
    logIn(userPage2, { emailPrefix: 'e2e_added_to_pro' }),
  ]);

  // Create new team
  const teamName = `Add user to team - ${Date.now()}`;
  const { teamUrl } = await createNewTeamByURL(page, {
    teamName,
  });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Cleanup the team member's email if it exists
  await deleteMemberFromProPlan(page, {
    emailAddress,
    additionalUserEmail: DUMMY_USER_EMAIL,
  });

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Locate and store the parent div containing 'Pro plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');

  // Extract the cost from the parent div of 'Pro plan' (the number between `$` and `/user/month`)
  const proPlanCostText = await proPlanParentEl.textContent();
  const proPlanCost = Number(proPlanCostText?.match(/\$(\d+)(?= \/user\/month)/)?.[1]);

  // Assert that the Pro plan cost is $20 per user per month
  expect(proPlanCost).toBe(20);

  // Locate the text element that starts with 'Team members (manage)' followed by a number
  // Store the text content (e.g., 'Team members (manage)1'
  await page.getByText(`Team members (manage)`).waitFor();
  const memberCountText = await page.locator('text=/^Team members \\(manage\\)\\d+$/').textContent();
  const memberCount = Number(memberCountText?.match(/\d+/)?.[0]);

  // Assert that there is currently 1 team member
  expect(memberCount).toBe(1);

  // Click 'manage' link to manage team members
  await page.getByRole(`link`, { name: `manage` }).click({ timeout: 60 * 1000 });

  // Assert that we've navigated to the team management page
  await expect(page.getByRole(`heading`, { name: `Team members` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page).toHaveURL(/members/);

  // Invite the new user to the team with 'Can Edit' permission
  await inviteUserToTeam(page, {
    email: user2Email,
    permission: 'Can Edit',
  });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that invited user is added as a team member
  await expect(page.getByText(user2Email).first()).toBeVisible({ timeout: 60 * 1000 });

  // Second user navigates into file
  await userPage2.bringToFront();
  await userPage2.reload();

  // Navigate to team URL
  await userPage2.goto(buildUrl(`/teams/${teamUrl}`));
  await userPage2.waitForTimeout(2000);
  await userPage2.waitForLoadState('domcontentloaded');
  await userPage2.waitForLoadState('networkidle');

  // Navigate to 'Settings' to check team member count again
  await page.getByRole(`link`, { name: `settings Settings` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Locate the text element that starts with 'Team members (manage)' followed by a number
  // Store the text content (e.g., 'Team members (manage)1'
  const newMemberCountText = await page.locator('text=/^Team members \\(manage\\)\\d+$/').textContent();
  const newMemberCount = Number(newMemberCountText?.match(/\d+/)?.[0]);

  // Assert that the team member count increased to 2
  expect(newMemberCount).toBe(2);

  // Navigate to the billing management page
  await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert that the current page is the billing management page
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Payment method`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Cancel Subscription' button appears
  await expect(page.locator(`[data-test="cancel-subscription"]`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the page reflects the increased cost due to new members
  await expect(page.getByText(`$${newMemberCount * proPlanCost}.00 per month`)).toBeVisible({ timeout: 60 * 1000 });

  // Expand and check the first accordion element for invoice details
  await page
    .locator(`[data-test="show-cost-details"]`)
    .first()
    .click({ timeout: 60 * 1000 });
  const invoiceTotalText = await page
    .locator('[data-testid="expanded-invoice-details"] span[data-test="value"]')
    .first()
    .innerText();

  // Extract and assert the invoice total cost (to equal the number of members * pro plan cost)
  const invoiceTotal = invoiceTotalText.split('.')[0].replace(/[^0-9]/g, '');
  expect(Number(invoiceTotal)).toBe(newMemberCount * proPlanCost);

  // Close the first accordion
  await page.locator(`[data-test="hide-cost-details"]`).click({ timeout: 60 * 1000 });

  // Wait for the accordion to close before interacting with the second one
  await page.waitForTimeout(500);

  // Expand and check the second accordion for invoice details
  await page
    .locator(`[data-test="show-cost-details"]`)
    .last()
    .click({ timeout: 60 * 1000 });
  const secondInvoiceText = await page.locator(`[data-testid="expanded-invoice-details"]`).last().innerText();

  // Check if the text includes a prorated charge for team
  expect(secondInvoiceText).toContain(`Prorated charge for Team\nQty 1 → ${newMemberCount}`);

  // Assert that the second accordion contains "Qty 2" for the two team members
  expect(secondInvoiceText).toContain(`Qty ${newMemberCount}`);

  // Close the second accordion
  await page.locator(`[data-test="hide-cost-details"]`).click({ timeout: 60 * 1000 });

  // **Cleanup**
  // Remove the team member from the team and check monthly cost is back to $20
  // Navigate to Quadratic home page (files page)
  await page.locator(`[data-testid="return-to-business-link"]`).click({ timeout: 60 * 1000 });

  // Remove the team member from the team
  await deleteMemberFromProPlan(page, {
    emailAddress,
    additionalUserEmail: DUMMY_USER_EMAIL,
  });
});

test('Manage Billing - Cancel Subscription', async ({ page }) => {
  //--------------------------------
  // Manage Billing - Cancel Subscription
  //--------------------------------

  // Log into Quadratic
  const emailAddress = await logIn(page, { emailPrefix: 'e2e_cancel_subscription' });

  // Create new team
  const teamName = `Team - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  // Click 'Manage billing' to reach the billing management page
  await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert that the current page is the billing management page
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Payment method`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the billing management page includes the account email address
  await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

  // Click 'Cancel subscription' button
  await page.locator(`[data-test="cancel-subscription"]`).click({ timeout: 60 * 1000 });

  // Assert that the page to confirm the cancellation appears
  await expect(page).toHaveTitle(/Cancel subscription/);
  await expect(page.getByText(`Cancel your subscription`)).toBeVisible({ timeout: 60 * 1000 });

  // Store the text content of the main page container and remove the extra spaces
  const cancelSubscriptionRawText = await page.locator('[data-testid="page-container-main"]').textContent();
  const cancelSubscriptionText = cancelSubscriptionRawText?.replace(/\s+/g, ' ')?.trim();

  // Assert that the normalized text contains the expected phrase (indicating cancellation of plan)
  expect(cancelSubscriptionText).toContain('subscription will be canceled');

  // Click 'Cancel subscription" to confirm the cancellation
  await page.locator(`[data-testid="confirm"]`).click({ timeout: 60 * 1000 });

  // Wait for the cancellation confirmation dialog to appear
  await page.getByRole(`dialog`).waitFor();

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the cancellation dialog contains confirmation message
  await expect(page.locator('[role="dialog"] span').nth(1)).toHaveText('Subscription has been canceled');
});

test('Manage Billing - Update Billing Information', async ({ page }) => {
  //--------------------------------
  // Manage Billing - Update Billing Information
  //--------------------------------

  // Store billing information to update to
  const billingInfo = {
    name: 'My Updated Billing Name',
    address1: '1234 Elm Street',
    address2: 'Apt 567',
    city: 'Springfield',
    state: 'Illinois',
    stateAbbr: 'IL',
    zip: '62701',
    // Need valid phone number in order to update phone #
  };

  // Log into Quadratic
  const emailAddress = await logIn(page, { emailPrefix: 'e2e_update_billing' });

  // Create new team
  const teamName = `Team - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Locate the parent divs that contains 'Pro plan' and 'Free plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');
  const freePlanParentEl = page.locator(`:text("Free plan")`).locator('..');

  // Assert that the 'Free plan' is not accompanied by the 'Current plan' flag
  // freePlanParentEl is declared 'Arrange' step
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(freePlanParentEl.locator(`:text("Current plan")`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Pro plan' container includes the 'Current plan' flag
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Upgrade to Pro' button is no longer visible
  await expect(page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Click 'Manage billing' to reach the billing management page
  await page.getByRole(`button`, { name: `Manage subscription` }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('domcontentloaded');

  // Assert that the current page is the billing management page
  await expect(page).toHaveTitle(/Billing/);

  // Assert a couple of key elements that confirm we're on the correct page
  await expect(page.getByText(`Current subscription`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`Payment method`, { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  // Assert the account email address is displayed on the billing page
  await expect(page.getByText(emailAddress)).toBeVisible({ timeout: 60 * 1000 });

  // Click 'Update Information' under 'Billing Information'
  await page.getByRole(`button`, { name: `Update information` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

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

  // Fill 'Name' textbox with an updated name: 'My Updated Billing Name'
  await page.getByRole(`textbox`, { name: `Name` }).fill(billingInfo.name);

  // Update the remaining billing information (address, city, state, zip)
  await page.getByRole(`textbox`, { name: `Address line 1` }).fill(billingInfo.address1);
  await page.getByRole(`textbox`, { name: `Address line 2` }).fill(billingInfo.address2);
  await page.getByRole(`textbox`, { name: `City` }).fill(billingInfo.city);
  await page.getByLabel(`State`).click({ timeout: 60 * 1000 });
  await page.getByLabel(`State`).type(billingInfo.state);
  await page.getByLabel(`State`).press('Enter');
  await page.getByRole(`textbox`, { name: `ZIP` }).fill(billingInfo.zip);

  // Click 'Save' button to confirm the changes
  await page.locator(`[data-testid="confirm"]`).click({ timeout: 60 * 1000 });

  // Assert that the new name is the updated name
  await expect(page.getByText(`Name${billingInfo.name}`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the billing address is the updated address
  await expect(page.getByText(billingInfo.address1)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(billingInfo.address2)).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByText(`${billingInfo.city}, ${billingInfo.stateAbbr} ${billingInfo.zip} US`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // **Cleanup** Reset billing information from 'Billing management' page
  await resetBillingInformation(page);
});

test('Upgrade to the Pro Plan', async ({ page }) => {
  //--------------------------------
  // Upgrade to the Pro Plan
  //--------------------------------

  // Log into Quadratic
  await logIn(page, { emailPrefix: 'e2e_upgrade_pro' });

  // Create new team
  const teamName = `Team - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

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
  await expect(page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Locate the parent div that contains 'Pro plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');

  //--------------------------------
  // Act:
  //--------------------------------

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

  // Assert page is currently displaying Settings
  await expect(page).toHaveURL(/settings/);
  await expect(page).toHaveTitle(/settings/);
  await expect(page.getByRole(`heading`, { name: `Team settings` })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that the 'Free plan' is no longer accompanied by the 'Current plan' flag
  // freePlanParentEl is declared in the 'Arrange' step
  await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(freePlanParentEl.locator(`:text("Current plan")`)).not.toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Pro plan' container includes the 'Current plan' flag
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Upgrade to Pro' button is no longer visible
  await expect(page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`)).not.toBeVisible({
    timeout: 60 * 1000,
  });

  // Assert that the 'Manage billing' button is visible
  // This indicates that the user has an active subscription to manage
  await expect(page.getByRole(`button`, { name: `Manage subscription` })).toBeVisible({ timeout: 60 * 1000 });

  // **CLEANUP**
  // Cancel the Pro plan subscription for this account
  await cancelProPlan(page);
});

test('Upgrade to the Pro Plan with an Invalid Card', async ({ page }) => {
  //--------------------------------
  // Upgrade to the Pro Plan with an Invalid Card
  //--------------------------------

  // Dummy credit card credentials to be used in the checkout page
  // Invalid card number is main error to be tested
  const creditCard = {
    name: 'Inavalid card',
    number: '0000 0000 0000 0000',
    expiration: '03/30',
    cvc: '424',
    zipCode: '90210',
  };

  // Log into Quadratic
  await logIn(page, { emailPrefix: 'e2e_invalid_card' });

  // Create new team
  // const teamName = `Invalid - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Navigate to the Settings page by clicking the 'Settings' link
  await page.getByRole('link', { name: 'settings Settings' }).click({ timeout: 60 * 1000 });

  await page.waitForTimeout(5 * 1000);
  await page.waitForLoadState('networkidle', { timeout: 60 * 1000 });

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
  await expect(page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`)).toBeVisible({
    timeout: 60 * 1000,
  });

  // Locate the parent div that contains 'Pro plan' details
  const proPlanParentEl = page.locator(`:text("Pro plan")`).locator('..').locator('..');

  // Assert that 'Current plan' is not within the 'Pro plan' div
  await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible({ timeout: 60 * 1000 });
  await expect(proPlanParentEl.locator(`:text("Current plan")`)).not.toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // Act:
  //--------------------------------

  // Click 'Upgrade to Pro' to upgrade the account
  await page.locator(`[data-testid="upgrade-to-pro-button-on-team-settings"]`).click({ timeout: 60 * 1000 });

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

  // Assert the border color of the card number input is as expected (dark gray) using toHaveCSS
  await expect(page.locator('[data-qa="FormFieldGroup-cardForm"] #cardNumber')).toHaveCSS(
    'border-color',
    'rgba(26, 26, 26, 0.9)'
  );

  // Fill the card number in the input for 'Card Information'
  await page.getByRole(`textbox`, { name: `Card number` }).fill(creditCard.number);

  // Fill the expiration date in the input for 'Expiration'
  await page.getByRole(`textbox`, { name: `Expiration` }).fill(creditCard.expiration);

  // Fill the 3-digit CVC number in the input for 'CVC'
  await page.getByRole(`textbox`, { name: `CVC` }).fill(creditCard.cvc);

  // Fill the cardholder's name in the input for 'Cardholder Name'
  await page.getByRole(`textbox`, { name: `Cardholder name` }).fill(creditCard.name);

  // Select United States
  await page
    .getByRole(`combobox`, {
      name: `Country or region`,
    })
    .selectOption({ label: `United States` });

  // Fill the zip code in the input for 'Zip Code'
  await page.getByRole(`textbox`, { name: `ZIP` }).fill(creditCard.zipCode);

  // Click 'Subscribe' button to upgrade the count to a Pro plan
  await page.locator(`[data-testid="hosted-payment-submit-button"]`).click({ timeout: 60 * 1000 });

  await page.waitForLoadState('domcontentloaded');

  //--------------------------------
  // Assert:
  //--------------------------------

  // Assert that page was NOT redirected and we're still on the Stripe-integrated payment page
  await expect(page.getByRole(`link`, { name: `Powered by Stripe` })).toBeVisible({ timeout: 60 * 1000 });

  // Assert that the 'Total due today' text is visible, indicating that we're *still* on the checkout page
  await expect(page.getByText(`Total due today`)).toBeVisible({ timeout: 60 * 1000 });

  // Ensure that the textbox with the card number is visible
  await page.locator('[data-qa="FormFieldGroup-cardForm"] #cardNumber').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Assert that the border color of the card number input is NOT the color it was before invalid credentials were submitted
  await expect(page.locator('[data-qa="FormFieldGroup-cardForm"] #cardNumber')).not.toHaveCSS(
    'border-color',
    'rgba(26, 26, 26, 0.9)'
  );

  // Assert that the textbox border color is now the expected red color
  await expect(page.locator('[data-qa="FormFieldGroup-cardForm"] #cardNumber')).toHaveCSS(
    'border-color',
    'rgb(220, 39, 39)'
  );

  // Assert that the invalid card number is still in the 'Card Information' textbox
  await expect(page.getByRole(`textbox`, { name: `Card number` })).toHaveValue(creditCard.number);

  // Assert that an error message indicating an issue with the card number is visible
  await expect(page.locator(`[data-qa="FormFieldGroup-cardForm"] [role="alert"]`)).toHaveText(
    `Your card number is incorrect.`
  );
});
