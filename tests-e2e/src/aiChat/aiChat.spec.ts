import { expect, test } from "@playwright/test";
import {
  cleanUpFiles,
  createFile,
  logIn,
  navigateIntoFile,
} from "../helpers/helpers";

const fileName = `AI Chat Insert Code, Clear Query, View History`;

test("AI Chat Insert Code, Clear Query, View History", async ({ page }) => {
  // Log in
  await logIn(page, {
    email: "e2e_chrome@quadratichq.com",
    password: "E2E_chrome",
  });

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
    ["./ai_chat_insert_code_5_prime.png"],
    { maxDiffPixels: 100 },
  );

  throw "fail";
});
