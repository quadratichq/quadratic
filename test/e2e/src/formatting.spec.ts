import test, { expect } from '@playwright/test';
import { typeInCell } from './helpers/app.helper';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import {
  applyCellLevelFormats,
  applyFormatsToSelection,
  clickBold,
  clickClearFormatting,
  clickItalic,
  clickStrikeThrough,
  clickTextColor,
  clickUnderline,
} from './helpers/format.helper';
import {
  copyToClipboard,
  gotoCells,
  pasteFromClipboard,
  positionCursorInEditor,
  selectTextInEditor,
  sheetRefreshPage,
} from './helpers/sheet.helper';

// =============================================================================
// TEXT FORMATTING (Bold, Italic, Underline, Strikethrough, Text Color)
// =============================================================================

test.describe('Text Formatting', () => {
  // Run tests in serial mode to share browser context and reduce login overhead
  test.describe.configure({ mode: 'serial' });

  test('Cell-Level and Inline Text Formatting', async ({ page }) => {
    const fileName = 'Text_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_formatting` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // =========================================================================
    // COLUMN A: Cell-Level Formatting (formatting applied to entire cell)
    // =========================================================================

    //--------------------------------
    // A1: Bold formatting on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A1', text: 'Bold entire cell' });
    await applyCellLevelFormats(page, ['bold'], { a1: 'A1' });

    //--------------------------------
    // A2: Italic formatting on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A2', text: 'Italic entire cell' });
    await applyCellLevelFormats(page, ['italic'], { a1: 'A2' });

    //--------------------------------
    // A3: Underline formatting on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A3', text: 'Underline entire cell' });
    await applyCellLevelFormats(page, ['underline'], { a1: 'A3' });

    //--------------------------------
    // A4: Strikethrough formatting on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A4', text: 'Strikethrough entire cell' });
    await applyCellLevelFormats(page, ['strike'], { a1: 'A4' });

    //--------------------------------
    // A5: Text color on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A5', text: 'Colored entire cell' });
    await applyCellLevelFormats(page, ['color'], { a1: 'A5' });

    //--------------------------------
    // A6: All formats combined on entire cell
    //--------------------------------
    await typeInCell(page, { a1: 'A6', text: 'All formats entire cell' });
    await applyCellLevelFormats(page, ['bold', 'italic', 'underline', 'strike', 'color'], { a1: 'A6' });
    await page.waitForTimeout(300);

    // Screenshot: Cell-level formatting complete
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Level_Text_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // COLUMN B: Inline Formatting (formatting applied to selected text only)
    // =========================================================================

    //--------------------------------
    // B1: Bold formatting on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'B1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal BOLD normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply bold formatting to "BOLD" (position 7, length 4)
    await applyFormatsToSelection(page, 7, 4, ['bold']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B2: Italic formatting on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'B2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal ITALIC normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply italic formatting to "ITALIC" (position 7, length 6)
    await applyFormatsToSelection(page, 7, 6, ['italic']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B3: Underline formatting on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'B3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal UNDERLINE normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply underline formatting to "UNDERLINE" (position 7, length 9)
    await applyFormatsToSelection(page, 7, 9, ['underline']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B4: Strikethrough formatting on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'B4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal STRIKE normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply strikethrough formatting to "STRIKE" (position 7, length 6)
    await applyFormatsToSelection(page, 7, 6, ['strike']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B5: Text color on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'B5' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal COLORED normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply text color to "COLORED" (position 7, length 7)
    await applyFormatsToSelection(page, 7, 7, ['color']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B6: All five formats combined on same word
    //--------------------------------
    await gotoCells(page, { a1: 'B6' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Normal STYLED normal', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "STYLED" (starts at position 7, length 6) and apply all formats
    await applyFormatsToSelection(page, 7, 6, ['bold', 'italic', 'underline', 'strike', 'color']);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    // Screenshot: Both columns with all formatting
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Inline_Text_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // COLUMN C: Cell-Level Toggle Clears Inline Formatting
    // Verifies that toggling off cell-level formatting clears the format
    // for the entire cell, including any inline-formatted text.
    // =========================================================================

    //--------------------------------
    // C1: Inline bold → Cell-level bold → Toggle off → Entire cell cleared
    //--------------------------------
    await gotoCells(page, { a1: 'C1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Inline BOLD then cell toggle', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply inline bold to "BOLD" (position 7, length 4)
    await selectTextInEditor(page, 7, 4);
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Apply cell-level bold (not in edit mode)
    await gotoCells(page, { a1: 'C1' });
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);

    // Toggle off cell-level bold (should clear entire cell)
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    //--------------------------------
    // C2: Inline italic → Cell-level italic → Toggle off → Entire cell cleared
    //--------------------------------
    await gotoCells(page, { a1: 'C2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Inline ITALIC then cell toggle', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply inline italic to "ITALIC" (position 7, length 6)
    await selectTextInEditor(page, 7, 6);
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(300);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Apply cell-level italic (not in edit mode)
    await gotoCells(page, { a1: 'C2' });
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(300);

    // Toggle off cell-level italic (should clear entire cell)
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    //--------------------------------
    // C3: Inline underline → Cell-level underline → Toggle off → Entire cell cleared
    //--------------------------------
    await gotoCells(page, { a1: 'C3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Inline UNDERLINE then toggle', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply inline underline to "UNDERLINE" (position 7, length 9)
    await selectTextInEditor(page, 7, 9);
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(300);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Apply cell-level underline (not in edit mode)
    await gotoCells(page, { a1: 'C3' });
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(300);

    // Toggle off cell-level underline (should clear entire cell)
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    //--------------------------------
    // C4: Inline strikethrough → Cell-level strikethrough → Toggle off → Entire cell cleared
    //--------------------------------
    await gotoCells(page, { a1: 'C4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Inline STRIKE then cell toggle', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply inline strikethrough to "STRIKE" (position 7, length 6)
    await selectTextInEditor(page, 7, 6);
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(300);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Apply cell-level strikethrough (not in edit mode)
    await gotoCells(page, { a1: 'C4' });
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(300);

    // Toggle off cell-level strikethrough (should clear entire cell)
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(500);

    //--------------------------------
    // C5: Inline text color → Cell-level text color → Clear → Entire cell cleared
    //--------------------------------
    await gotoCells(page, { a1: 'C5' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Inline COLORED then cell clear', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply inline text color to "COLORED" (position 7, length 7)
    await selectTextInEditor(page, 7, 7);
    await clickTextColor(page, '#E74C3C');
    await page.waitForTimeout(300);

    // Save and exit edit mode
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Apply cell-level text color (not in edit mode)
    await gotoCells(page, { a1: 'C5' });
    await clickTextColor(page, '#E74C3C');
    await page.waitForTimeout(300);

    // Clear text color by clicking "Clear" in color picker
    await clickTextColor(page);
    await page.waitForTimeout(500);

    // Screenshot: Column C should show all text without formatting
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Level_Toggle_Clears_Inline.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART: Persistence - Verify formatting survives page reload
    // =========================================================================
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Text_Formatting_Before_Reload.png', {
      maxDiffPixelRatio: 0.01,
    });

    await sheetRefreshPage(page);
    await page.waitForTimeout(2000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Text_Formatting_After_Reload.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Clear Formatting', async ({ page }) => {
    const fileName = 'Clear_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_toggle` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // =========================================================================
    // Setup: Create 4 cells with formatting to test all clear scenarios
    // A1: Inline formatting - clear with keyboard (Ctrl+\)
    // A2: Inline formatting - clear with toolbar button
    // B1: Cell-level formatting - clear with keyboard (Ctrl+\)
    // B2: Cell-level formatting - clear with toolbar button
    // =========================================================================

    //--------------------------------
    // A1: Inline formatting (to be cleared with keyboard)
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Inline KEYBOARD clear', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply all formats to "KEYBOARD" (position 7, length 8)
    await applyFormatsToSelection(page, 7, 8, ['bold', 'italic', 'underline', 'strike', 'color']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A2: Inline formatting (to be cleared with toolbar button)
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Inline BUTTON clear', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply all formats to "BUTTON" (position 7, length 6)
    await applyFormatsToSelection(page, 7, 6, ['bold', 'italic', 'underline', 'strike', 'color']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B1: Cell-level formatting (to be cleared with keyboard)
    //--------------------------------
    await typeInCell(page, { a1: 'B1', text: 'Cell KEYBOARD clear' });
    await applyCellLevelFormats(page, ['bold', 'italic', 'underline', 'strike', 'color'], { a1: 'B1' });
    await page.waitForTimeout(300);

    //--------------------------------
    // B2: Cell-level formatting (to be cleared with toolbar button)
    //--------------------------------
    await typeInCell(page, { a1: 'B2', text: 'Cell BUTTON clear' });
    await applyCellLevelFormats(page, ['bold', 'italic', 'underline', 'strike', 'color'], { a1: 'B2' });
    await page.waitForTimeout(300);

    // Screenshot: Before clear formatting
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Before_Clear_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // Clear formatting using all 4 methods
    // =========================================================================

    //--------------------------------
    // A1: Clear inline formatting with keyboard (Ctrl+\)
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "KEYBOARD" (position 7, length 8)
    await selectTextInEditor(page, 7, 8);
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+\\');
    await page.waitForTimeout(500);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A2: Clear inline formatting with toolbar button
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "BUTTON" (position 7, length 6)
    await selectTextInEditor(page, 7, 6);
    await page.waitForTimeout(300);

    // Click the clear formatting button in the toolbar
    await clickClearFormatting(page);
    await page.waitForTimeout(500);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // B1: Clear cell-level formatting with keyboard (Ctrl+\)
    //--------------------------------
    await gotoCells(page, { a1: 'B1' });
    await page.keyboard.press('Control+\\');
    await page.waitForTimeout(500);

    //--------------------------------
    // B2: Clear cell-level formatting with toolbar button
    //--------------------------------
    await gotoCells(page, { a1: 'B2' });
    await clickClearFormatting(page);
    await page.waitForTimeout(500);

    // Screenshot: After clear formatting (all 4 cells should have no formatting)
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('After_Clear_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// HYPERLINKS
// =============================================================================

test.describe('Hyperlinks', () => {
  // Run tests in serial mode to share browser context and reduce login overhead
  test.describe.configure({ mode: 'serial' });

  test('Create and Remove Hyperlinks', async ({ page }) => {
    const fileName = 'Hyperlinks';

    await logIn(page, { emailPrefix: `e2e_rich_text_hyperlinks` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // =========================================================================
    // PART 1: Create Hyperlinks and Verify Navigation
    // =========================================================================

    //--------------------------------
    // A1: Hyperlink on selected text
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Visit our website for more info', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "website" (starts at position 10, length 7)
    await selectTextInEditor(page, 10, 7);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput1 = page.locator('#link-url');
    await urlInput1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput1.fill('https://www.quadratichq.com');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlink_On_Selected_Text.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // A2: Insert hyperlink without pre-selected text
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Click here: ', { delay: 50 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog without selection
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.fill('https://google.com');
    await page.waitForTimeout(250);

    const textInput = page.locator('#link-text');
    await textInput.fill('Google');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.type(' for search', { delay: 50 });
    await page.waitForTimeout(500);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlink_Inserted_With_Text.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 2: Remove Hyperlinks
    // =========================================================================

    //--------------------------------
    // A3: Create hyperlink to remove with Remove button
    //--------------------------------
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Remove this website link', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "website" (position 12, length 7)
    await selectTextInEditor(page, 12, 7);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput3 = page.locator('#link-url');
    await urlInput3.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput3.fill('https://example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A4: Create hyperlink to remove with clear formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Clear this hyperlink text', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "hyperlink" (position 11, length 9)
    await selectTextInEditor(page, 11, 9);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput4 = page.locator('#link-url');
    await urlInput4.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput4.fill('https://example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlinks_Before_Remove.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Remove hyperlink from A3 using Remove button
    //--------------------------------
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text to show popup
    await positionCursorInEditor(page, 14);
    await page.waitForTimeout(1000);

    // Click Remove button
    const removeButton = page.getByRole('button', { name: 'Remove' });
    await removeButton.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton.click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // Remove hyperlink from A4 using clear formatting (Ctrl+\)
    //--------------------------------
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "hyperlink" (position 11, length 9)
    await selectTextInEditor(page, 11, 9);
    await page.waitForTimeout(300);

    // Clear formatting with keyboard shortcut (should remove hyperlink)
    await page.keyboard.press('Control+\\');
    await page.waitForTimeout(500);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlinks_After_Remove.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Edit Hyperlinks', async ({ page }) => {
    const fileName = 'Edit_Hyperlinks';

    // Reuse existing user since e2e_edit_hyperlinks is not registered in auth system
    await logIn(page, { emailPrefix: `e2e_rich_text_hyperlinks` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // =========================================================================
    // PART 1: Edit Hyperlink URL
    // =========================================================================

    //--------------------------------
    // A1: Create hyperlink, then edit its URL
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Visit our website for info', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "website" (position 10, length 7)
    await selectTextInEditor(page, 10, 7);

    // Create initial hyperlink
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput1 = page.locator('#link-url');
    await urlInput1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput1.fill('https://old-url.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Enter edit mode and position cursor on hyperlink to show popup
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await positionCursorInEditor(page, 12);
    await page.waitForTimeout(1000);

    // Click Edit button in popup (use exact: true to avoid matching file name "Edit_Hyperlinks")
    const editButton1 = page.getByRole('button', { name: 'Edit', exact: true });
    await editButton1.waitFor({ state: 'visible', timeout: 10000 });
    await editButton1.click();
    await page.waitForTimeout(1000);

    // Modify the URL
    const urlInputEdit1 = page.locator('#link-url');
    await urlInputEdit1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInputEdit1.clear();
    await urlInputEdit1.fill('https://www.quadratichq.com');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlink_URL_Edited.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 2: Edit Hyperlink Text via UI Popup
    // =========================================================================

    //--------------------------------
    // A2: Create hyperlink, then edit its text via popup
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Click here: ', { delay: 50 });
    await page.waitForTimeout(500);

    // Create hyperlink with text
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.fill('https://example.com');
    await page.waitForTimeout(250);

    const textInput2 = page.locator('#link-text');
    await textInput2.fill('Old Link Text');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Enter edit mode and position cursor on hyperlink to show popup
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await positionCursorInEditor(page, 14);
    await page.waitForTimeout(1000);

    // Click Edit button in popup (use exact: true to avoid matching file name)
    const editButton2 = page.getByRole('button', { name: 'Edit', exact: true });
    await editButton2.waitFor({ state: 'visible', timeout: 10000 });
    await editButton2.click();
    await page.waitForTimeout(1000);

    // Modify the link text
    const textInputEdit2 = page.locator('#link-text');
    await textInputEdit2.waitFor({ state: 'visible', timeout: 10000 });
    await textInputEdit2.clear();
    await textInputEdit2.fill('New Link Text');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlink_Text_Edited.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 3: Apply RTF Formatting to Hyperlinks
    // =========================================================================

    //--------------------------------
    // A3: Create hyperlink with bold formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('This is a bold link here', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "bold link" (position 10, length 9)
    await selectTextInEditor(page, 10, 9);

    // Create hyperlink
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput3 = page.locator('#link-url');
    await urlInput3.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput3.fill('https://example.com/bold');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Apply bold formatting to "bold link" (position 10, length 9)
    await applyFormatsToSelection(page, 10, 9, ['bold']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A4: Create hyperlink with italic formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('This is an italic link here', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "italic link" (position 11, length 11)
    await selectTextInEditor(page, 11, 11);

    // Create hyperlink
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput4 = page.locator('#link-url');
    await urlInput4.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput4.fill('https://example.com/italic');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Apply italic formatting to "italic link" (position 11, length 11)
    await applyFormatsToSelection(page, 11, 11, ['italic']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A5: Create hyperlink with strikethrough formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A5' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('This is a struck link here', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "struck link" (position 10, length 11)
    await selectTextInEditor(page, 10, 11);

    // Create hyperlink
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput5 = page.locator('#link-url');
    await urlInput5.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput5.fill('https://example.com/strike');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Apply strikethrough formatting to "struck link" (position 10, length 11)
    await applyFormatsToSelection(page, 10, 11, ['strike']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A6: Create hyperlink with all three formats (bold, italic, strikethrough)
    //--------------------------------
    await gotoCells(page, { a1: 'A6' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('This is a styled link here', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "styled link" (position 10, length 11)
    await selectTextInEditor(page, 10, 11);

    // Create hyperlink
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput6 = page.locator('#link-url');
    await urlInput6.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput6.fill('https://example.com/styled');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Apply bold, italic, and strikethrough to the hyperlink
    await applyFormatsToSelection(page, 10, 11, ['bold', 'italic', 'strike']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlinks_With_RTF_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// COPY/PASTE FORMATTING
// =============================================================================

test.describe('Copy/Paste/Undo/Redo Formatting', () => {
  // Run tests in serial mode to share browser context and reduce login overhead
  test.describe.configure({ mode: 'serial' });

  test('Copy Paste and Move Preserves Formatting', async ({ page }) => {
    const fileName = 'Copy_Paste_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_copy_paste` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // =========================================================================
    // PART 1: Inline Formatting Copy/Paste
    // =========================================================================

    //--------------------------------
    // A1: Create cell with inline formatting (bold, italic, underline, strikethrough, color)
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Inline bold italic underline strike color text', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply bold to "bold" (position 7, length 4)
    await applyFormatsToSelection(page, 7, 4, ['bold']);

    // Apply italic to "italic" (position 12, length 6)
    await applyFormatsToSelection(page, 12, 6, ['italic']);

    // Apply underline to "underline" (position 19, length 9)
    await applyFormatsToSelection(page, 19, 9, ['underline']);

    // Apply strikethrough to "strike" (position 29, length 6)
    await applyFormatsToSelection(page, 29, 6, ['strike']);

    // Apply color to "color" (position 36, length 5)
    await applyFormatsToSelection(page, 36, 5, ['color']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Copy A1 inline formatting to A2
    //--------------------------------
    await copyToClipboard(page, 'A1');
    await gotoCells(page, { a1: 'A2' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Inline_Formatting_Copy_Paste.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 2: Cell-Level Formatting Copy/Paste
    // =========================================================================

    //--------------------------------
    // A3: Create cell with cell-level formatting
    //--------------------------------
    await typeInCell(page, { a1: 'A3', text: 'Cell-level bold italic underline strike' });
    await gotoCells(page, { a1: 'A3' });
    await clickBold(page);
    await page.waitForTimeout(300);

    //--------------------------------
    // A4: Create cell with cell-level italic
    //--------------------------------
    await typeInCell(page, { a1: 'A4', text: 'Cell-level italic text here' });
    await gotoCells(page, { a1: 'A4' });
    await clickItalic(page);
    await page.waitForTimeout(300);

    //--------------------------------
    // A5: Create cell with cell-level underline
    //--------------------------------
    await typeInCell(page, { a1: 'A5', text: 'Cell-level underline text' });
    await gotoCells(page, { a1: 'A5' });
    await clickUnderline(page);
    await page.waitForTimeout(300);

    //--------------------------------
    // A6: Create cell with cell-level strikethrough
    //--------------------------------
    await typeInCell(page, { a1: 'A6', text: 'Cell-level strikethrough' });
    await gotoCells(page, { a1: 'A6' });
    await clickStrikeThrough(page);
    await page.waitForTimeout(500);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Level_Formatting_Source.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Copy A3:A6 cell-level formatting to B3:B6
    //--------------------------------
    // Use range notation in goto box to select A3:A6
    await gotoCells(page, { a1: 'A3:A6' });
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);

    await gotoCells(page, { a1: 'B3' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Cell_Level_Formatting_Copy_Paste.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 3: Move Cells (Cut/Paste) Preserves Formatting
    // =========================================================================

    //--------------------------------
    // A8: Create cell with mixed formatting to move
    //--------------------------------
    await gotoCells(page, { a1: 'A8' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Move this formatted text', { delay: 50 });
    await page.waitForTimeout(500);

    // Make "formatted" bold and italic (position 10, length 9)
    await applyFormatsToSelection(page, 10, 9, ['bold', 'italic']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Before_Move_Formatted_Cell.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Cut A8 and paste to C8 (move with formatting preserved)
    //--------------------------------
    await gotoCells(page, { a1: 'A8' });
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(500);

    await gotoCells(page, { a1: 'C8' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('After_Move_Formatted_Cell.png', {
      maxDiffPixelRatio: 0.01,
    });

    // =========================================================================
    // PART 4: Hyperlink Copy/Paste Preserves Link
    // =========================================================================

    //--------------------------------
    // A10: Create cell with hyperlink
    //--------------------------------
    await gotoCells(page, { a1: 'A10' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Visit our website for info', { delay: 50 });
    await page.waitForTimeout(500);

    // Select "website" (position 10, length 7) and create hyperlink
    await selectTextInEditor(page, 10, 7);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const hyperlinkUrlInput = page.locator('#link-url');
    await hyperlinkUrlInput.waitFor({ state: 'visible', timeout: 10000 });
    await hyperlinkUrlInput.fill('https://www.quadratichq.com');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Copy A10 to B10
    //--------------------------------
    await copyToClipboard(page, 'A10');
    await gotoCells(page, { a1: 'B10' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A10' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Hyperlink_Copy_Paste.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Verify the pasted hyperlink still works by checking popup shows URL
    //--------------------------------
    await gotoCells(page, { a1: 'B10' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on hyperlink to show popup
    await positionCursorInEditor(page, 12);
    await page.waitForTimeout(1000);

    // Verify popup buttons are visible (confirming hyperlink exists)
    await expect(page.getByRole('button', { name: 'Open' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Undo Redo Formatting', async ({ page }) => {
    const fileName = 'Undo_Redo_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_copy_paste` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // A1: Create text and apply all formats to a word
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Test STYLED word here', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply all formats to "STYLED" (position 5, length 6)
    await applyFormatsToSelection(page, 5, 6, ['bold', 'italic', 'underline', 'strike', 'color']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Undo_Redo_All_Formats_Applied.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Undo all formatting (5 undos for 5 formats)
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Undo_Redo_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Redo all formatting (5 redos)
    //--------------------------------
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Undo_Redo_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

test.describe('Edge Cases', () => {
  // Run tests in serial mode to share browser context and reduce login overhead
  test.describe.configure({ mode: 'serial' });

  test('Partial Word Formatting', async ({ page }) => {
    const fileName = 'Rich_Text_Partial_Word';

    await logIn(page, { emailPrefix: `e2e_rich_text_partial` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    // Format part of a word
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Highlighting partial text', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply bold to "light" from "Highlighting" (position 4, length 5)
    await applyFormatsToSelection(page, 4, 5, ['bold']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Word_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Format across word boundary
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Word boundary test here', { delay: 50 });
    await page.waitForTimeout(500);

    // Apply italic to "ry te" (end of "boundary" + space + start of "test", position 12, length 5)
    await applyFormatsToSelection(page, 12, 5, ['italic']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Cross_Word_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Multi-Cell Range Formatting', async ({ page }) => {
    const fileName = 'Multi_Cell_Range_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_partial` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Create multiple cells with text
    //--------------------------------
    await typeInCell(page, { a1: 'A1', text: 'Cell one text' });
    await typeInCell(page, { a1: 'A2', text: 'Cell two text' });
    await typeInCell(page, { a1: 'A3', text: 'Cell three text' });
    await typeInCell(page, { a1: 'A4', text: 'Cell four text' });

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Multi_Cell_Before_Range_Format.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Select range A1:A4 and apply bold to all cells at once
    //--------------------------------
    await applyCellLevelFormats(page, ['bold'], { a1: 'A1:A4' });

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Multi_Cell_Range_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Select range A1:A4 and apply italic on top of bold
    //--------------------------------
    await applyCellLevelFormats(page, ['italic'], { a1: 'A1:A4' });

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Multi_Cell_Range_Bold_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Overlapping Format Ranges', async ({ page }) => {
    const fileName = 'Overlapping_Formats';

    await logIn(page, { emailPrefix: `e2e_rich_text_partial` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // A1: Create overlapping bold and italic ranges
    // Text: "This is overlapping format test"
    // Bold on "is overlapping" (positions 5-18)
    // Italic on "overlapping format" (positions 8-25)
    // Result: "is" should be bold only, "overlapping" bold+italic, "format" italic only
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.keyboard.type('This is overlapping format test', { delay: 50 });
    await page.waitForTimeout(300);

    // Apply bold to "is overlapping" (position 5, length 14)
    await applyFormatsToSelection(page, 5, 14, ['bold']);

    // Apply italic to "overlapping format" (position 8, length 18)
    await applyFormatsToSelection(page, 8, 18, ['italic']);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Overlapping_Format_Ranges.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // A2: Paste formatted text into cell with existing formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.keyboard.type('Existing bold text here', { delay: 50 });
    await page.waitForTimeout(300);

    // Apply bold to "bold" (position 9, length 4)
    await applyFormatsToSelection(page, 9, 4, ['bold']);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Copy A1 (with overlapping formats) and paste into A3
    await copyToClipboard(page, 'A1');
    await gotoCells(page, { a1: 'A3' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Paste_Formatted_Into_Formatted.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Empty Cell Pre-Formatting', async ({ page }) => {
    const fileName = 'Empty_Cell_Formatting';

    await logIn(page, { emailPrefix: `e2e_rich_text_partial` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // A1: Apply bold to empty cell, then type
    //--------------------------------
    await applyCellLevelFormats(page, ['bold'], { a1: 'A1' });

    // Now enter edit mode and type - text should be bold
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.type('Pre-formatted bold', { delay: 50 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A2: Apply italic to empty cell, then type
    //--------------------------------
    await applyCellLevelFormats(page, ['italic'], { a1: 'A2' });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.type('Pre-formatted italic', { delay: 50 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    //--------------------------------
    // A3: Apply multiple formats to empty cell, then type
    //--------------------------------
    await applyCellLevelFormats(page, ['bold', 'italic', 'underline', 'strike'], { a1: 'A3' });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.type('Pre-formatted all styles', { delay: 50 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    await gotoCells(page, { a1: 'A1' });
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Empty_Cell_Pre_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});
