import { Page, expect, request, test } from '@playwright/test';

require('dotenv').config();
const LOCALHOST_SERVER = process.env.LOCALHOST_SERVER ?? "http://localhost:3000/";
const LOGIN = process.env.AUTH0_TEST_USER_LOGIN ?? "test@quadratichq.com"
const PASSOWRD = process.env.AUTH0_TEST_USER_PASSWORD;

const checkIfServerIsStarted = async () => {
  let http = await request.newContext({ baseURL: LOCALHOST_SERVER })
  let res = await http.get(`/`);
  return res.ok()
}

if (!checkIfServerIsStarted) {
  test.skip(true, `${LOCALHOST_SERVER} not started`)
}

if (!PASSOWRD) {
  test.skip(true, "Only local testing: AUTH0_TEST_USER_PASSWORD is required")
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(LOCALHOST_SERVER)
});

const performLogIn = async (page: Page) => {
  // enter email
  await page.getByLabel('Email address').click();
  await page.getByLabel('Email address').fill(LOGIN);
  // enter password
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill(PASSOWRD ?? "");
  // click Continue (auth0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // click accept (auth0)
  await page.waitForTimeout(500);
  const accept_step = await page.getByRole('button', { name: 'Accept' }).isVisible();
  if (accept_step) {
    await page.getByRole('button', { name: 'Accept' }).click();
  }

  // rederited to files page
  await page.getByRole('heading', { name: 'My files' }).click();
}

test.describe('Test Python', () => {
  test('should run python code', async ({ page }) => {
    test.slow();

    await performLogIn(page);

    // create new file
    await page.getByRole('link', { name: 'Create file' }).click();

    // click on canva
    await page.locator('#QuadraticCanvasID').click({
      position: {
        x: 300,
        y: 110
      }
    });

    // open formula menu
    await page.keyboard.press('=');
    await page.getByRole('button', { name: 'Python Script with Pandas,' }).click();

    // execute
    {
      let result = await executePythonCode(page, "2/0")
      expect(result).toContain("ZeroDivisionError")
      expect(result).toContain("line 1")
    }
    {
      let result = await executePythonCode(page, "10 * 8")
      expect(result).toContain("Print") // is empty
    }
    {
      let result = await executePythonCode(page, `
import pandas as pd

a = pd.DataFrame()
a[0][0]
      `)
      expect(result).toContain("ERROR")
      expect(result).toContain("line 5")
    }
    {
      let result = await executePythonCode(page, `
import pandas as pd


a = pd.DataFrame()
a[0][0]
      `)
      expect(result).toContain("ERROR")
      expect(result).toContain("line 6")
    }
  })
})

async function executePythonCode(page: Page, code: string): Promise<string | null> {
  // focus code editor
  await page.locator('.view-lines').click();

  // clear
  for (let index = 0; index < 100; index++) {
    await page.keyboard.press('Backspace');
  }

  // enter code
  await page.keyboard.insertText(code)

  // run code
  await page.locator('#QuadraticCodeEditorRunButtonID').click();
  await page.locator('#QuadraticCodeEditorRunButtonID').click();

  // read result from console
  const consoleResult = await page.getByRole('tabpanel', { name: 'Console' }).locator('div').first();
  const text = await consoleResult.textContent();
  return text
}