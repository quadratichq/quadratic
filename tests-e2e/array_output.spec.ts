import { test, expect } from '@playwright/test';
import { getGridScreenshot } from './utils/getGridScreenshot';
import { pause } from './utils/pause';
import { enterCodeInCell } from './utils/enterCodeInCell';

const PYTHON_DF = `import pandas as pd

pd.DataFrame(data=[[1, 2, 3, 4, ], [5, 6, 7, 8], [9, 10, 11, 12]])`;

const PYTHON_DF_WITH_COLUMN_NAMES = `import pandas as pd
pd.DataFrame(data={'col1': [1, 2], 'col2': [3, 4]})`;

const PYTHON_DF_VERTICAL = `import pandas as pd

result = pd.DataFrame(["vertical df","vertical df","vertical df","vertical df"])`;

const PYTHON_DF_HORIZONTAL = `import pandas as pd

result = pd.DataFrame([["horizontal df","horizontal df","horizontal df","horizontal df"]])`;

const PYTHON_LIST_VERTICAL = `result = []
for i in range(25):
    result.append(2**i)`;

const PYTHON_LIST_HORIZONTAL = `[["horizontal", "list"]]`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Grid interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(`window.localStorage.setItem('firstTime', false)`);

    await page.locator('#QuadraticCanvasID').waitFor();
  });

  test('should output array results correctly', async ({
    page,
    browserName,
  }) => {
    await page.locator('#QuadraticCanvasID').focus();

    await enterCodeInCell(page, PYTHON_LIST_VERTICAL, browserName);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_LIST_HORIZONTAL, browserName);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_DF_VERTICAL, browserName);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await enterCodeInCell(page, PYTHON_DF_HORIZONTAL, browserName);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await enterCodeInCell(page, PYTHON_DF, browserName);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_DF_WITH_COLUMN_NAMES, browserName);

    // flakey, this takes a different amount of time based on resources and browser
    // waiting for grid to update. Should be able to await a real event.
    await pause(10000);

    await expect(await getGridScreenshot(page)).toMatchSnapshot('2ruvUg.png');
  });
});
