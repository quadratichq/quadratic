import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logIn } from './helpers/auth.helpers';
import { upgradeToProPlan } from './helpers/billing.helpers';
import { cleanUpFiles, createFile, navigateIntoFile, uploadFile } from './helpers/file.helpers';
import { createNewTeamByURL } from './helpers/team.helper';

test('[Attach Button] Extract employee count from Broadcom and Apple PDFs', async ({ page }) => {
  // Constants
  const fileName = `Extract employee count from Broadcom and Apple PDFs`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_pdf_attach` });

  // // Create new team
  // const teamName = `AI PDF Attach Button - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // // Upgrade to Pro plan
  // await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Upload both PDFs via the attach button
  //--------------------------------
  // Click on the Chat icon in left sidebar
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Upload "broadcom-annual-filing.pdf"
  const broadcomFile = `broadcom-annual-filing.pdf`;

  // Set a single use listener
  page.once('filechooser', (chooser) =>
    chooser.setFiles(path.join(process.cwd(), './data/', `${broadcomFile}`)).catch(console.error)
  );
  await page.getByRole(`button`, { name: `attach_file` }).click({ timeout: 60 * 1000 });

  // Wait for file to upload
  await page.locator(`a`).filter({ hasText: broadcomFile }).waitFor();
  await page.waitForTimeout(1_000);

  // Upload "apple-annual-filing.pdf"
  const appleFile = `apple-annual-filing.pdf`;

  // Set a single use listener
  page.once('filechooser', (chooser) =>
    chooser.setFiles(path.join(process.cwd(), './data/', `${appleFile}`)).catch(console.error)
  );
  await page.getByRole(`button`, { name: `attach_file` }).click({ timeout: 60 * 1000 });

  // Assert that "broadcom-annual-filing.pdf" file is visible in attached files
  await expect(page.locator(`a`).filter({ hasText: broadcomFile })).toBeVisible();

  // Assert that "apple-annual-filing.pdf" file is visible in attached files
  await expect(page.locator(`a`).filter({ hasText: appleFile })).toBeVisible();

  // //--------------------------------
  // // Send a prompt Related to the data Uploaded by Attach button
  // //--------------------------------
  // // Constant prompt
  // const aiPrompt = `How many employees do Broadcom and Apple each have?`;

  // // Fill input with prompt question
  // await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(aiPrompt);

  // // Click submit arrow button
  // await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // // Wait for first import action to begin
  // await page.getByText(`Action: PDF import`).nth(0).waitFor();
  // const processingText = page.getByText(`Reading file. Large files may take a few minutes`);
  // await processingText.waitFor();

  // // Wait for first file to finish processing
  // await processingText.waitFor({ state: `hidden`, timeout: 60_000 });

  // // Wait for second import action to begin
  // await page.getByText(`Action: PDF import`).nth(1).waitFor();
  // await processingText.waitFor();

  // // Wait for second file to finish processing
  // await processingText.waitFor({ state: `hidden`, timeout: 60_000 });

  // // Resize column A
  // await page.mouse.move(520, 90);
  // await page.mouse.down();
  // await page.mouse.move(700, 90);
  // await page.mouse.up();

  // // Resize column B
  // await page.mouse.move(800, 90);
  // await page.mouse.down();
  // await page.mouse.move(900, 90);
  // await page.mouse.up();

  // // Take screenshot buffer
  // const buffer = await page.locator(`#QuadraticCanvasID`).screenshot();
  // const base64 = buffer.toString('base64');

  // // Arrange file for GPT Assertion
  // const fileContent = base64; // base64 string of the image
  // const header = `data:image/png;base64,`;
  // const gptPrompt = `Does the image show two tables? One with an employee count of 37,000 for Broadcom and the other with an employee count of 164,000 for Apple? Answer with only "Yes" or "No".`;

  // // Use the vision-preview model, max tokens 4096 (default)
  // const data = JSON.stringify({
  //   base64_file: header + fileContent,
  //   prompt: gptPrompt,
  //   model: 'gpt-4o',
  //   api_key: process.env.QAWA_API_KEY,
  // });

  // const response = await fetch(API_ENDPOINT, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: data,
  // });

  // const resData = await response.text();

  // // Assert that the response is Yes
  // expect(resData).toEqual('Yes.');

  // // Assert that Broadcom's employees have been extracted successfully
  // await expect(page.getByText(/Broadcom.*approximately 37,000 employees/i).first()).toBeVisible();

  // // Assert that Apple's employees have been extracted successfully
  // await expect(page.getByText(/Apple.*approximately 164,000.*employees/i).first()).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test('[Drag & Drop] Extract employee count from Broadcom PDF', async ({ page }) => {
  // Constants
  const fileName = `Drag_And_Drop_PDF`;
  const pdfFileName = `broadcom-annual-filing.pdf`;
  const filePath = path.join(process.cwd(), './data/', `${pdfFileName}`);
  const fileType = 'application/pdf';

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_pdf_drag_drop` });

  // // Create new team
  // const teamName = `AI PDF Drag Drop - ${Date.now()}`;
  // await createNewTeamByURL(page, { teamName });

  // // Upgrade to Pro plan
  // await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Drag and Drop the Broadcom File Into AI Chat
  //--------------------------------
  // Open the ai tool
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Open the file chooser
  page.once('filechooser', (chooser) => {
    void chooser.setFiles(filePath).catch(console.error);
  });

  // Set file attacher to a variable for drag and drop
  const elementSelector = `:text("attach_file")`;

  const rawBuffer = await readFile(filePath);
  const buffer = rawBuffer.toString('base64');

  // prepare the data to transfer
  const dataTransfer = await page.evaluateHandle(
    async ({ bufferData, pdfFileName, fileType }) => {
      const dt = new DataTransfer();

      const blobData = await fetch(bufferData).then((res) => res.blob());

      const file = new File([blobData], pdfFileName, { type: fileType });
      dt.items.add(file);
      return dt;
    },
    {
      bufferData: `data:application/octet-stream;base64,${buffer}`,
      pdfFileName: pdfFileName,
      fileType: fileType,
    }
  );

  // Dispatch the drop event
  await page.dispatchEvent(elementSelector, 'drop', { dataTransfer });

  // Assert that the file is now visible of files
  await expect(page.locator(`a`).filter({ hasText: `${pdfFileName}` })).toBeVisible();

  // //--------------------------------
  // // Send a prompt Related to the data Uploaded by Drag and Drop
  // //--------------------------------
  // // Question to ask the ai provided by Quadratic
  // const aiPrompt = `How many employees does Broadcom have?`;

  // // Fill input with prompt question
  // await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(aiPrompt);

  // // Click submit arrow button
  // await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // // Wait for first import action to begin
  // await page.getByText(`Action: PDF import`).waitFor();
  // const processingText = page.getByText(`Reading file. Large files may take a few minutes`);
  // await processingText.waitFor();

  // // Wait for first file to finish processing
  // await processingText.waitFor({ state: `hidden`, timeout: 60_000 });

  // // Resize column A
  // await page.mouse.move(520, 90);
  // await page.mouse.down();
  // await page.mouse.move(700, 90);
  // await page.mouse.up();

  // // Resize column B
  // await page.mouse.move(800, 90);
  // await page.mouse.down();
  // await page.mouse.move(900, 90);
  // await page.mouse.up();

  // // Take screenshot buffer
  // const gptBuffer = await page.locator(`#QuadraticCanvasID`).screenshot();
  // const base64 = gptBuffer.toString('base64');

  // // Arrange file for GPT Assertion
  // const fileContent = base64; // base64 string of the image
  // const header = `data:image/png;base64,`;
  // const gptPrompt = `Does the image show a table? The table should show an employee count of 37,000. Answer with only "Yes" or "No".`;

  // // Use the vision-preview model, max tokens 4096 (default)
  // const data = JSON.stringify({
  //   base64_file: header + fileContent,
  //   prompt: gptPrompt,
  //   model: 'gpt-4o',
  //   api_key: process.env.QAWA_API_KEY,
  // });

  // const response = await fetch(API_ENDPOINT, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: data,
  // });

  // const resData = await response.text();

  // // Assert that the response is Yes
  // expect(resData).toEqual('Yes.');

  // // Assert that Broadcom's employees have been extracted successful in ai response
  // await expect(page.getByText(/Broadcom.*approximately 37,000 employees/i).first()).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('AI Chat Insert Code, Clear Query, View History', async ({ page }) => {
  // Constants
  const fileName = `AI Chat Insert Code, Clear Query, View History`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_chat` });

  // Create new team
  const teamName = `AI Counter - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Insert Code
  //--------------------------------
  // Click on the Chat icon in left sidebar
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Fill in codeGenerate prompt in chat
  await page.getByPlaceholder(`Ask a question...`).fill(`generate first 5 prime numbers using python in A1`);

  // Click Send button (blue arrow icon)
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Wait until prompt is complete
  await expect(page.locator(`:text("Cancel generating")`).first()).toBeVisible({
    timeout: 60 * 2 * 1000,
  });
  await expect(page.locator(`:text("Cancel generating")`).first()).not.toBeVisible({ timeout: 60 * 2 * 1000 });
  await page.waitForTimeout(2000);

  // Click on Python button to 'Open diff in editor'
  await page
    .locator(`#main`)
    .getByRole(`button`, { name: `code`, exact: true })
    .click({ timeout: 60 * 1000 });

  // Assert Code Editor has a Python script to generate first 5 prime numbers
  await page.locator(`[id="QuadraticCodeEditorID"]`).waitFor();
  await page.waitForTimeout(2000);

  // Assert prime function
  await expect(page.locator(`[id="QuadraticCodeEditorID"]`)).toContainText(`def is_prime`);

  // Assert the first 5 prime numbers were applied to cells from chat prompt
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(['ai_chat_insert_code_5_prime.png'], {
    maxDiffPixels: 100,
  });

  //--------------------------------
  // Clear Query
  //--------------------------------
  // SETUP for test 3
  const chatText = await page.locator(`[data-gramm_editor]`).textContent();

  // Click on history icon in chat
  await page.getByRole(`button`, { name: `history`, exact: true }).click({ timeout: 60 * 1000 });

  // Save a reference to the chat name
  const chatName = await page
    .locator(`div[class*="h-full w-full grid"] div[class*="text-sm text-foreground"]`)
    .innerText();

  // Click on history icon in chat to close
  await page.getByRole(`button`, { name: `history`, exact: true }).click({ timeout: 60 * 1000 });

  // Click the '+' button to start a new chat
  await page
    .getByRole(`button`, { name: `add` })
    .first()
    .click({ timeout: 60 * 1000 });

  // Assert new chat is present
  await expect(page.getByRole(`heading`, { name: `What can I help with?` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Give me sample data` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Generate code` })).toBeVisible({ timeout: 60 * 1000 });
  await expect(page.getByRole(`button`, { name: `Build a chart` })).toBeVisible({ timeout: 60 * 1000 });

  //--------------------------------
  // View History
  //--------------------------------
  // Click the history button in chat panel
  await page.getByRole(`button`, { name: `history`, exact: true }).click({ timeout: 60 * 1000 });
  // Assert the previous chat is visible
  await expect(page.getByText(`${chatName}`)).toBeVisible({ timeout: 60 * 1000 });

  // Click on the previous chat
  await page.getByText(`${chatName}`).click({ timeout: 60 * 1000 });

  // Assert this opens up the previous chat and contains its previous response
  const chatTextHistory = await page.locator(`[data-gramm_editor]`).textContent();

  expect(chatText).toContain(chatTextHistory);

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('AI Prompt - Create Chart using AI Prompt', async ({ page, context }) => {
  // Constants
  const fileName = 'Chat_File_For_AI_Prompt';
  const fileType = 'grid';
  const prompt = `Create a chart using sample data`;

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_prompt_chart` });

  // Create new team
  const teamName = `AI Prompt Chart - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up lingering files
  await cleanUpFiles(page, { fileName });

  // Create new file
  await uploadFile(page, { fileName, fileType });

  //--------------------------------
  // AI Prompt - Create Chart using AI Prompt
  //--------------------------------
  // Open the AI Chat
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Enter "Prompt" asking to create a chart using sample data
  await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(prompt);
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Wait until prompt is complete
  await expect(page.locator(`:text("Cancel generating")`).first()).toBeVisible();
  await expect(page.locator(`:text("Cancel generating")`).first()).not.toBeVisible({ timeout: 60 * 1000 });
  await page.waitForTimeout(2000);

  // Close Chat
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Zoom to origin
  await page.locator('button:has-text("100%")').click({ timeout: 60 * 1000 });
  await page.getByRole(`menuitem`, { name: `Move to origin` }).click({ timeout: 60 * 1000 });

  //--------------------------------
  // Assert:
  //--------------------------------
  // // Export File
  // Take screenshot buffer
  const buffer = await page.screenshot();
  const base64 = buffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  // Open image in a new page
  const imagePage = await context.newPage();
  await imagePage.setContent(`<img src="${dataUrl}" />`);

  // // Arrange file for GPT Assertion
  // const fileContent = base64; // base64 string of the image
  // const header = `data:image/png;base64,`;
  // const gptEndpoint = API_ENDPOINT;
  // const gptPrompt = 'Does image show a data table, a chart and no errors? Answer with only "Yes" or "No"';

  // // Use the vision-preview model, max tokens 4096 (default)
  // const data = JSON.stringify({
  //   base64_file: header + fileContent,
  //   prompt: gptPrompt,
  //   model: 'gpt-4o',
  //   api_key: process.env.QAWA_API_KEY,
  // });

  // const config = {
  //   method: 'post',
  //   maxBodyLength: Infinity,
  //   url: gptEndpoint,
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   data: data,
  // };

  // // Make the chatGPT request
  // const response = await axios.request(config);
  // const resData = response.data;

  // // Assert that the response is Yes
  // expect(resData).toEqual('Yes');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('AI Prompt - Insert value into a cell', async ({ page }) => {
  // Constants
  const fileName = 'AI_prompt_InsertValue';
  const aiPrompt = 'Put the value 10 in cell A1';

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_insert_value` });

  // Create new team
  const teamName = `AI Prompt Insert value - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Insert value into a cell
  //--------------------------------
  // Open the AI Chat
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Fill AI prompt
  await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(aiPrompt);

  // Submit prompt
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Wait for AI to finish
  await page.waitForTimeout(3 * 60 * 1000);

  // Screenshot assertion to make sure value 10 is in A1
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-A1-10`);

  // Copy cell and assert clipboard text
  await page.waitForTimeout(10 * 1000);
  await page.keyboard.press('Control+C'); // Copy the text in the cells
  await page.waitForTimeout(5 * 1000);
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('10');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('AI Prompt - Use Python Code to return a value in a cell', async ({ page }) => {
  // Constants
  const fileName = 'AI_prompt_InsertPython';
  const aiPrompt = 'Put python code to return the value 10 in cell A1';

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_python_code` });

  // Create new team
  const teamName = `AI Prompt Python Code - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Use Python Code to return a value in a cell
  //--------------------------------
  // Open the AI Chat
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Fill AI prompt
  await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(aiPrompt);

  // Submit prompt
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Screnshot assertion to make sure value 10 is in A1
  await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot(`${fileName}-A1-10.png`);

  // Copy cell and assert clipboard text
  await page.waitForTimeout(10000);
  await page.keyboard.press('Control+C'); // Copy the text in the cells
  await page.waitForTimeout(5000);
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); // Get clipboard content
  expect(clipboardText).toBe('10');
  await page.keyboard.press('Escape');

  // Open code editor
  await page.keyboard.press('/');

  // Assert Code Editor opens Python
  await expect(page.locator(`#QuadraticCodeEditorID button:has-text("Python")`)).toBeVisible();

  // Assert editor has 10
  await expect(page.locator(`#QuadraticCodeEditorID span:text-is("10") >> nth = 0`)).toBeVisible();

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('AI Sheet Data analysis', async ({ page }) => {
  // Constants
  const fileName = `AI Sheet Data analysis`;
  const prompt1 = `Count to 10 and fill the sheet with that data`;
  const prompt2 = `Copy the data from sheet 2 and put it into sheet 1`;
  const assertionPrompt = `Do the two sheets contain the same data? Respond only with Yes. or No.`;

  // Log in
  const teamName = `AI Sheet Data analysis - ${Date.now()}`;
  await logIn(page, { emailPrefix: `e2e_ai_sheet_data` });

  // Create new team
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Sheet Data analysis
  //--------------------------------
  // Add a sheet so we have two sheets
  // Click the element with the add button
  await page.locator('span.material-symbols-outlined:has-text("add")').click({ timeout: 60 * 1000 });

  // Click on the Chat icon in left sidebar
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Fill in prompt in chat
  await page.getByPlaceholder(`Ask a question...`).fill(prompt1);

  // Click the button with the "arrow_upward" icon to submit prompt
  await page.locator('span:has-text("arrow_upward")').click({ timeout: 60 * 1000 });

  await expect(page.getByText(`Cancel generating`)).toBeVisible();
  await expect(page.locator(`:text("Cancel generating")`).first()).not.toBeVisible({ timeout: 60 * 2 * 1000 });

  // Navigate to "Sheet 1" by clicking the "Sheet 1" div element
  await page.locator('div[data-title="Sheet1"]').click({ timeout: 60 * 1000 });

  // Click the "add" icon to add the new sheet to the chat
  await page.locator('span.material-symbols-outlined:has-text("add") >>nth=1').click({ timeout: 60 * 1000 });

  // Click the "Sheet2" menu item to add it to the chat context
  await page.locator('div[role="menuitemcheckbox"]:has-text("Sheet 2")').click({ timeout: 60 * 1000 });

  // Fill in prompt2 in chat
  await page.getByPlaceholder(`Ask a question...`).fill(prompt2);

  // Click the button with the "arrow_upward" icon to submit prompt
  await page.locator('span:has-text("arrow_upward")').click({ timeout: 60 * 1000 });

  await expect(page.getByText(`Cancel generating`)).toBeVisible();
  await expect(page.locator(`:text("Cancel generating")`).first()).not.toBeVisible({ timeout: 60 * 2 * 1000 });

  // Fill in prompt2 in chat
  await page.getByPlaceholder('Ask a question...').waitFor({ timeout: 120_000 });
  await page.getByPlaceholder('Ask a question...').fill(assertionPrompt);

  // Click the button with the "arrow_upward" icon to submit prompt
  await page.locator('span:has-text("arrow_upward")').click({ timeout: 60 * 1000 });

  await expect(page.getByText(`Cancel generating`)).toBeVisible();
  await expect(page.locator(`:text("Cancel generating")`).first()).not.toBeVisible({ timeout: 60 * 2 * 1000 });

  // Assert that the response for AI sheet comparison to contain "Yes." Meaning the AI transferred the data properly and can see both sheets
  await expect(page.locator('div[class="markdown"]').last()).toHaveText('Yes.');

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});

test.skip('Think Enabled Response', async ({ page }) => {
  // Constants
  const fileName = 'Think_Enabled_Response';
  const question = `What is 7 * 10?`;

  // Define expected chat responses without "Think" enabled
  const chatResponseWithoutThink = [`simple`, `70`];

  // Define expected chat responses with "Think" enabled
  const chatResponseWithThink = [`7 * 10`, `A1`, `70`];

  // Log in
  await logIn(page, { emailPrefix: `e2e_ai_think_enabled` });

  // Create new team
  const teamName = `Think Enabled Response - ${Date.now()}`;
  await createNewTeamByURL(page, { teamName });

  // Upgrade to Pro plan
  await upgradeToProPlan(page);

  // Clean up files created by this workflow
  await cleanUpFiles(page, { fileName });

  // Create new file
  await createFile(page, { fileName });

  // Navigate into new file
  await navigateIntoFile(page, { fileName });

  //--------------------------------
  // Think Enabled Response
  //--------------------------------
  // Click the "auto_awesome" button to enable a feature
  await page.getByRole(`button`, { name: `auto_awesome` }).click({ timeout: 60 * 1000 });

  // Fill the question textbox with the predefined question
  await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(question);

  // Click the send button to submit the question
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Assert that the "Show thinking" option is not visible initially
  await expect(page.locator('span.select-none:has-text("Show thinking")')).not.toBeVisible();

  // Verify that each expected response without "Think" is visible
  for (const response of chatResponseWithoutThink) {
    await expect(page.getByText(response)).toBeVisible();
  }

  // Locate the "Extended thinking" button
  const thinkButton = page.getByRole(`button`, { name: `Extended thinking` });

  // Click the "Extended thinking" button to enable it
  await thinkButton.click({ timeout: 60 * 1000 });

  // Assert that the "Extended thinking" button is pressed
  await expect(thinkButton).toHaveAttribute('aria-pressed', 'true');

  // Fill the question textbox again with the same question
  await page.getByRole(`textbox`, { name: `Ask a question...` }).fill(question);

  // Click the send button to submit the question again
  await page.getByRole(`button`, { name: `arrow_upward` }).click({ timeout: 60 * 1000 });

  // Assert that the "Cancel generating" option appears and then disappears
  await expect(page.getByText(`Cancel generating`)).toBeVisible();
  await expect(page.getByText(`Cancel generating`)).not.toBeVisible();

  // Assert that the "Show thinking" option is now visible
  await expect(page.locator('span.select-none:has-text("Show thinking")').first()).toBeVisible();

  // Click the "Show thinking" option to reveal additional information
  await page
    .getByText(`Show thinking`)
    .first()
    .click({ timeout: 60 * 1000 });

  // Locate the "Hide thinking" box to verify responses with "Think"
  const thinkBox = page.locator('span.select-none:has-text("Hide thinking")').first().locator('../..');

  // Verify that each expected response with "Think" is visible
  for (const response of chatResponseWithThink) {
    await expect(thinkBox.getByText(response).first()).toBeVisible();
  }

  //--------------------------------
  // Clean up:
  //--------------------------------
  // Cleanup newly created files
  await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
  await cleanUpFiles(page, { fileName });
});
