import { expect, Page } from '@playwright/test';
import { pause } from '../utils/pause';

export const enterCodeInCell = async (page: Page, code: string) => {
  await expect(page.locator('#QuadraticCodeEditorID')).toBeHidden();

  await page.keyboard.press('Equal');

  await pause(500);

  await page.locator('#CellTypeMenuID').waitFor();

  await page.locator('#CellTypeMenuInputID').focus();

  await page.keyboard.type('python');

  await page.keyboard.press('Enter');

  await page.locator('#QuadraticCodeEditorID').waitFor();

  await expect(page.locator('#QuadraticCodeEditorID')).toBeVisible();

  await page.keyboard.type(code);

  await page.locator('#QuadraticCodeEditorRunButtonID').click();

  await page.locator('#QuadraticCodeEditorCloseButtonID').click();

  await expect(page.locator('#QuadraticCodeEditorID')).toBeHidden();
};
