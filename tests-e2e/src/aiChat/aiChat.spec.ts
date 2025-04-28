import { expect, test } from "@playwright/test";
import { logIn } from "../helpers/auth.helpers";
import {
  cleanUpFiles,
  createFile,
  navigateIntoFile,
} from "../helpers/file.helpers";

test("AI Chat Insert Code, Clear Query, View History", async ({ page }) => {
  //--------------------------------
  // Inert Code
  //--------------------------------
  // Constants
  const fileName = `AI Chat Insert Code, Clear Query, View History`;

  // Log in
  await logIn(page, {});

  // Clean up files created by this workflow
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

  // Fill in codeGenerate prompt in chat
  await page
    .getByPlaceholder(`Ask a question...`)
    .fill(`generate first 5 prime numbers using python in A1`);

  // Click Send button (blue arrow icon)
  await page.getByRole(`button`, { name: `arrow_upward` }).click();

  // Wait until prompt is complete
  await expect(page.locator(`:text("Cancel generating")`).first()).toBeVisible({
    timeout: 60 * 2 * 1000,
  });
  await expect(
    page.locator(`:text("Cancel generating")`).first(),
  ).not.toBeVisible({ timeout: 60 * 2 * 1000 });
  await page.waitForTimeout(2000);

  // Click on Python button to 'Open diff in editor'
  await page
    .locator(`#main`)
    .getByRole(`button`, { name: `code`, exact: true })
    .click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert Code Editor has a Python script to generate first 5 prime numbers
  await page.locator(`[id="QuadraticCodeEditorID"]`).waitFor();
  await page.waitForTimeout(2000);

  // Assert prime function
  await expect(page.locator(`[id="QuadraticCodeEditorID"]`)).toContainText(
    `def is_prime`,
  );

  // Assert the first 5 prime numbers were applied to cells from chat prompt
  await expect(page.locator("#QuadraticCanvasID")).toHaveScreenshot(
    ["ai_chat_insert_code_5_prime.png"],
    { maxDiffPixels: 100 },
  );

  //--------------------------------
  // Clear Query
  //--------------------------------
  // SETUP for test 3
  const chatText = await page.locator(`[data-gramm_editor]`).textContent();
  console.log({ chatText });

  // Click on history icon in chat
  await page.getByRole(`button`, { name: `history`, exact: true }).click();

  // Save a reference to the chat name
  const chatName = await page
    .locator(
      `div[class*="h-full w-full grid"] div[class*="text-sm text-foreground"]`,
    )
    .innerText();
  console.log({ chatName });

  // Click on history icon in chat to close
  await page.getByRole(`button`, { name: `history`, exact: true }).click();

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the '+' button to start a new chat
  await page.getByRole(`button`, { name: `add` }).first().click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert new chat is present
  await expect(
    page.getByRole(`heading`, { name: `What can I help with?` }),
  ).toBeVisible();
  await expect(
    page.getByRole(`button`, { name: `Give me sample data` }),
  ).toBeVisible();
  await expect(
    page.getByRole(`button`, { name: `Generate code` }),
  ).toBeVisible();
  await expect(
    page.getByRole(`button`, { name: `Build a chart` }),
  ).toBeVisible();

  //--------------------------------
  // View History
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // Click the history button in chat panel
  await page.getByRole(`button`, { name: `history`, exact: true }).click();

  //--------------------------------
  // Assert:
  //--------------------------------
  // Assert the previous chat is visible
  await expect(page.getByText(`${chatName}`)).toBeVisible();

  // Click on the previous chat
  await page.getByText(`${chatName}`).click();

  // Assert this opens up the previous chat and contains its previous response
  const chatTextHistory = await page
    .locator(`[data-gramm_editor]`)
    .textContent();
  console.log({ chatText });
  console.log({ chatTextHistory });
  expect(chatText).toContain(chatTextHistory);
});
