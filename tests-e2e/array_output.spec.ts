import { test, expect } from '@playwright/test';
import { getGridScreenshot } from './utils/getGridScreenshot';
import { pause } from './utils/pause';
import { enterCodeInCell } from './patterns/enterCodeInCell';

const PYTHON_DF = `import pandas as pd
import numpy as np

# using numpy's randint
pd.DataFrame(np.random.randint(0,100,size=(15, 4)))`;

const PYTHON_DF_WITH_COLUMN_NAMES = `import pandas as pd
pd.DataFrame(data={'col1': [1, 2], 'col2': [3, 4]})`;

const PYTHON_DF_VERITICAL = `import pandas as pd

result = pd.DataFrame(["1111111","2222222","3333333","4444444"])`;

const PYTHON_DF_HORIZONTAL = `import pandas as pd

result = pd.DataFrame([["1111111","2222222","3333333","4444444"]])`;

const PYTHON_LIST_VERTICAL = `result = []
for i in range(25):
    result.append(2**i)`;

const PYTHON_LIST_HORIZONTAL = `[["hello"],["world"]]`;

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto('/');
});

test.describe('Grid interaction', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.evaluate(`window.localStorage.setItem('firstTime', false)`);

    await page.locator('#QuadraticCanvasID').waitFor();
  });

  test('should output array results correctly', async ({ page }) => {
    await page.locator('#QuadraticCanvasID').focus();

    await enterCodeInCell(page, PYTHON_LIST_VERTICAL);

    await page.locator('#QuadraticCanvasID').focus();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_LIST_HORIZONTAL);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_DF_VERITICAL);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await enterCodeInCell(page, PYTHON_DF_HORIZONTAL);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await enterCodeInCell(page, PYTHON_DF);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await enterCodeInCell(page, PYTHON_DF_WITH_COLUMN_NAMES);

    // flakey, this takes a different amount of time based on resources and browser
    // waiting for grid to update. Should be able to await a real event.
    await pause(process.env.CI ? 10000 : 1000);

    await expect(await getGridScreenshot(page)).toMatchSnapshot('2ruvUg.png');
  });
});
