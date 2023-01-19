import { test, expect } from '@playwright/test';
import { getGridScreenshot } from './utils/getGridScreenshot';
import { pause } from './utils/pause';
import { enterCodeInCell } from './utils/enterCodeInCell';

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto('/');
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

    await pause(500);

    await page.keyboard.type('Hello World!');

    await page.keyboard.press('Enter');

    // flakey, this takes a different amount of time based on resources and browser
    // waiting for grid to update. Should be able to await a real event.
    await pause(10000);

    await expect(await getGridScreenshot(page)).toMatchSnapshot('uEy6dp.png');
  });

  test('should write code cell', async ({ page, browserName }) => {
    await page.locator('#QuadraticCanvasID').click();

    await enterCodeInCell(page, '1+1', browserName);

    // flakey, this takes a different amount of time based on resources and browser
    // waiting for grid to update. Should be able to await a real event.
    await pause(10000);

    await expect(await getGridScreenshot(page)).toMatchSnapshot('ie670m.png');
  });
});
