import { expect, test } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles } from './helpers/file.helpers';

test('Create Example', async ({ page }) => {
  // Constants
  const fileName = 'Python getting started (example)';

  // Log in
  await logIn(page, { emailPrefix: `e2e_create_example` });

  // // Create a new team
  // const teamName = `Create Example - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // Go to private files
  await page.locator(`div a:text("My files")`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName, skipFilterClear: true });

  //--------------------------------
  // Create Example
  //--------------------------------

  //--------------------------------
  // Act:
  //--------------------------------
  // navigate to Templates tab
  await page.locator(`a:text("Templates")`).click({ timeout: 60 * 1000 });
  await page.waitForTimeout(5 * 1000);

  // click on the "Python intro" example
  await page.locator('h2:has-text("Python intro")').click({ timeout: 60 * 1000 });
  await page.waitForTimeout(60 * 1000);

  //--------------------------------
  // Assert:
  //--------------------------------

  // Close Chat
  try {
    await page
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 60 * 1000 });
  } catch (err) {
    console.error(err);
  }

  // assert that the correct file is created
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Resources_Create_Example.png', {
    maxDiffPixelRatio: 0.01,
  });

  // click on Back to files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });

  // Go to private files
  await page.locator(`div a:text("My files")`).click({ timeout: 60 * 1000 });

  // assert that the example file has been created
  await expect(page.locator(`h2:has-text("${fileName}")`)).toBeVisible();
  await page.waitForTimeout(3000);

  // assert that thumbnail matches file look
  await expect(page.locator('[alt="File thumbnail screenshot"]').first()).toHaveScreenshot(
    'Resources_Create_Example_Thumbnail.png',
    {
      maxDiffPixelRatio: 0.01,
    }
  );

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await cleanUpFiles(page, { fileName });
});

test('Docs page', async ({ page }) => {
  // Log in
  await logIn(page, { emailPrefix: `e2e_create_example` });

  //--------------------------------
  // Act:
  //--------------------------------

  // click Docs
  const [page2] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator(`nav [href="https://docs.quadratichq.com"]`).click(),
  ]);
  await page2.waitForLoadState('domcontentloaded');
  await page2.bringToFront();

  //--------------------------------
  // Assert:
  //--------------------------------

  // assert that user is redirected to docs page in new tab
  await expect(page2).toHaveURL('https://docs.quadratichq.com/');
  await expect(page2.locator(`h1:has-text("Getting Started")`)).toBeVisible();
});
