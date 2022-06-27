import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto('/');
});

test.describe('Grid loads', () => {
  test('should load the Quadratic grid', async ({ page }) => {
    await page.locator('.loadingContainer').isVisible();

    await page.locator('#QuadraticCanvasID').waitFor();
  });
});

test.describe('Grid interaction', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.evaluate(`window.localStorage.setItem('firstTime', false)`);

    await page.locator('#QuadraticCanvasID').waitFor();
  });

  test('should be able to add data to cell', async ({ page }) => {
    await page.locator('#QuadraticCanvasID').click();

    await page.keyboard.press('ArrowRight');

    await page.keyboard.press('Enter');

    await page.keyboard.type('Hello World!');

    await page.keyboard.press('Enter');
  });

  test('should write code cell', async ({ page }) => {
    await page.locator('#QuadraticCanvasID').click();

    await page.keyboard.press('Equal');

    await page.locator('#QuadraticCanvasID').waitFor();

    await page.locator('#CellTypeMenuID').waitFor();

    await page.locator('#CellTypeMenuInputID').focus();

    await page.keyboard.type('python');

    await page.keyboard.press('Enter');

    await page.locator('#QuadraticCodeEditorID').waitFor();

    await expect(page.locator('#QuadraticCodeEditorID')).toBeVisible();

    await page.keyboard.type('1 + 1');

    await page.locator('#QuadraticCodeEditorRunButtonID').click();

    await page.locator('#QuadraticCodeEditorCloseButtonID').click();

    await page.locator('#QuadraticCodeEditorID').waitFor({ state: 'hidden' });

    await expect(page.locator('#QuadraticCodeEditorID')).toBeHidden();
  });
});
