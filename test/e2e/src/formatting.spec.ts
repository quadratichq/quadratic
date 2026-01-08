import test, { expect } from '@playwright/test';
import { logIn } from './helpers/auth.helpers';
import { cleanUpFiles, createFile } from './helpers/file.helpers';
import { copyToClipboard, gotoCells, pasteFromClipboard, sheetRefreshPage } from './helpers/sheet.helper';

// =============================================================================
// CELL-LEVEL FORMATTING (Fill Color, Copy/Paste)
// =============================================================================

test.describe('Cell-Level Formatting', () => {

  test('Tile paste formatting', async ({ page }) => {
    const fileName = 'Tile_Paste_Formatting';
    await logIn(page, { emailPrefix: `e2e_tile_paste_fmt` });
    await cleanUpFiles(page, { fileName });
    await createFile(page, { fileName, skipNavigateBack: true });

    await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
    await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
    await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
    await page.keyboard.press('Shift+ArrowDown', { delay: 250 });
    await page.keyboard.press('Shift+ArrowDown', { delay: 250 });

    await page.locator(`[data-testid="format_fill_color"]`).click({ timeout: 60 * 1000 });
    await page.locator(`[aria-label="Select color #F9D2CE"]`).click({ timeout: 60 * 1000 });
    await page.waitForTimeout(5 * 1000);

    await copyToClipboard(page, 'A1:A6');
    await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
    await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
    await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
    await page.keyboard.press('Shift+ArrowRight', { delay: 250 });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape', { delay: 250 });

    await expect(page.locator(`#QuadraticCanvasID`)).toHaveScreenshot(`tile_paste_formatting.png`, {
      maxDiffPixelRatio: 0.01,
    });

    // Cleanup newly created files
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// TEXT FORMATTING (Bold, Italic, Underline, Strikethrough)
// =============================================================================

test.describe('Text Formatting', () => {

  test('Partial Text Bold/Italic', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Formatting';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_formatting` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Bold formatting on partial text
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This is a test sentence', { delay: 100 });
    await page.waitForTimeout(500);

    // Select the word "test" by moving cursor and using shift+arrow keys
    // Move cursor to the beginning of the cell content
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Move to the start of "test" (after "This is a ")
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select the word "test" (4 characters)
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(250);

    // Apply bold formatting with Ctrl+B
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify bold formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Italic formatting on partial text
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('Hello world example', { delay: 100 });
    await page.waitForTimeout(500);

    // Move cursor to the beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Move to the start of "world" (after "Hello ")
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select the word "world" (5 characters)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply italic formatting with Ctrl+I
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify italic formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Combined bold and italic on different words
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('Mixed formatting text here', { delay: 100 });
    await page.waitForTimeout(500);

    // Move cursor to the beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Select "Mixed" (5 characters) and make it bold
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Move cursor to start of "text" (after "Mixed formatting ")
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 17; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "text" (4 characters) and make it italic
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify combined formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Combined_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Strikethrough', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Strikethrough';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_strike` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Strikethrough formatting on partial text
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This has strikethrough text here', { delay: 100 });
    await page.waitForTimeout(500);

    // Move cursor to select "strikethrough"
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "strikethrough" (13 characters)
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply strikethrough with Ctrl+5
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify strikethrough formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Strikethrough.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Text Color on Partial Text', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Color';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_color` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Apply text color to partial text
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('Red word and blue word here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "Red" and apply red color
    await page.keyboard.press('Home');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click text color button and select red
    await page.locator('[data-testid="format_text_color"]').click({ timeout: 60 * 1000 });
    await page.locator('[aria-label="Select color #E74C3C"]').click({ timeout: 60 * 1000 });
    await page.waitForTimeout(500);

    // Now select "blue" and apply blue color
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click text color button and select blue
    await page.locator('[data-testid="format_text_color"]').click({ timeout: 60 * 1000 });
    await page.locator('[aria-label="Select color #3498DB"]').click({ timeout: 60 * 1000 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify text colors
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Colors.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Toggle Formatting Off', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Toggle_Off';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_toggle` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Toggle bold off
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This word is bold here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold" and make it bold
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot with bold text
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Toggle_Bold_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and toggle bold off
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "bold" again
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Press Ctrl+B again to toggle bold off
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot - bold should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Toggle_Bold_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Toggle italic off
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This word is italic here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "italic" and make it italic
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot with italic text
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Toggle_Italic_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and toggle italic off
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "italic" again
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Press Ctrl+I again to toggle italic off
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot - italic should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Toggle_Italic_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Toggle underline off
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This word is underline here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "underline" and make it underlined
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot with underlined text
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Toggle_Underline_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and toggle underline off
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "underline" again
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Press Ctrl+U again to toggle underline off
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot - underline should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Toggle_Underline_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 4: Toggle strikethrough off
    //--------------------------------

    // Navigate to cell A4 and enter edit mode
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This word is strike here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "strike" and make it strikethrough
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot with strikethrough text
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Toggle_Strike_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and toggle strikethrough off
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select "strike" again
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Press Ctrl+5 again to toggle strikethrough off
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot - strikethrough should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Toggle_Strike_Off.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Underline Formatting on Partial Text', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Underline';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_underline` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Underline formatting on partial text
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This text has underlined words here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "underlined" and apply underline
    await page.keyboard.press('Home');
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply underline with Ctrl+U
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify underline formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Underline.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Undo/Redo Rich Text Formatting', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Undo_Redo';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_undo` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Undo bold formatting
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Undo this bold text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold" and make it bold
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode to commit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before undo
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Undo the formatting
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    // Take a screenshot after undo - bold should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Redo the formatting
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    // Take a screenshot after redo - bold should return
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Undo/Redo italic formatting
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Undo this italic text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "italic" and make it italic
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode to commit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before undo
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Italic_Before_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Undo the formatting
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    // Take a screenshot after undo - italic should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Italic_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Redo the formatting
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    // Take a screenshot after redo - italic should return
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Italic_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Undo/Redo underline formatting
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Undo this underline text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "underline" and make it underlined
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    // Exit edit mode to commit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before undo
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Underline_Before_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Undo the formatting
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    // Take a screenshot after undo - underline should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Underline_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Redo the formatting
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    // Take a screenshot after redo - underline should return
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Underline_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 4: Undo/Redo strikethrough formatting
    //--------------------------------

    // Navigate to cell A4 and enter edit mode
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Undo this strike text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "strike" and make it strikethrough
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(500);

    // Exit edit mode to commit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before undo
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Strike_Before_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Undo the formatting
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    // Take a screenshot after undo - strikethrough should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Strike_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Redo the formatting
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    // Take a screenshot after redo - strikethrough should return
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Strike_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 5: Undo hyperlink creation
    //--------------------------------

    // Navigate to cell A5 and enter edit mode
    await gotoCells(page, { a1: 'A5' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Undo this link here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "link" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput = page.locator('#link-url');
    await urlInput.fill('https://undo-test.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before undo
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_Before_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Undo the hyperlink
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    // Take a screenshot after undo - hyperlink should be removed
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_After_Undo.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Redo the hyperlink
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    // Take a screenshot after redo - hyperlink should return
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_After_Redo.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Clear All Formatting', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Clear_Formatting';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_clear` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create a cell with ALL formatting types
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text with words for each format type
    await page.keyboard.type('Bold italic underline strike color', { delay: 100 });
    await page.waitForTimeout(500);

    // Make "Bold" bold (characters 0-4)
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Make "italic" italic (characters 5-11)
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(250);

    // Make "underline" underlined (characters 12-21)
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(250);

    // Make "strike" strikethrough (characters 22-28)
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(250);

    // Make "color" red (characters 29-34)
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 29; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click text color button and select red
    await page.locator('[data-testid="format_text_color"]').click({ timeout: 60 * 1000 });
    await page.locator('[aria-label="Select color #E74C3C"]').click({ timeout: 60 * 1000 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before clearing - shows all 5 format types
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Clear_All.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test: Clear all formatting using keyboard shortcut
    //--------------------------------

    // Select the cell and use Format > Clear formatting
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    // Use keyboard shortcut for clear formatting (Ctrl+\)
    await page.keyboard.press('Control+\\');
    await page.waitForTimeout(1000);

    // Take a screenshot after clearing - text should remain, ALL formatting should be gone
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Clear_All.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// COPY/PASTE (Formatting Preservation)
// =============================================================================

test.describe('Copy/Paste Formatting', () => {

  test('Copy Paste Preserves Formatting', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Copy_Paste';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_copy_paste` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create a cell with mixed rich-text formatting
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('Copy this bold and italic text', { delay: 100 });
    await page.waitForTimeout(500);

    // Move cursor to the beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Move to "bold" (after "Copy this ")
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "bold" (4 characters) and make it bold
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Move to "italic" (after "Copy this bold and ")
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 19; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "italic" (6 characters) and make it italic
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot of the source cell
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Copy_Paste_Source.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 1: Copy and paste to another cell
    //--------------------------------

    // Copy cell A1
    await copyToClipboard(page, 'A1');

    // Navigate to cell B1 and paste
    await gotoCells(page, { a1: 'B1' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify formatting is preserved in B1
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Copy_Paste_Single_Cell.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Copy and paste to multiple cells (paste range)
    //--------------------------------

    // Create another cell with formatting in A3
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Underlined text here', { delay: 100 });
    await page.waitForTimeout(500);

    // Move to beginning and select "Underlined"
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Select "Underlined" (10 characters) and apply underline
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Select both A1 and A3 (A1:A3 range)
    await copyToClipboard(page, 'A1:A3');

    // Paste to C1
    await gotoCells(page, { a1: 'C1' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify formatting is preserved in the pasted range
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Copy_Paste_Range.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Copy and paste cell with hyperlink
    //--------------------------------

    // Create a cell with hyperlink in A5
    await gotoCells(page, { a1: 'A5' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Check out this link now', { delay: 100 });
    await page.waitForTimeout(500);

    // Move to "link" (after "Check out this ")
    await page.keyboard.press('Home');
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "link" (4 characters)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog with Alt+K
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Copy cell A5
    await copyToClipboard(page, 'A5');

    // Paste to B5
    await gotoCells(page, { a1: 'B5' });
    await pasteFromClipboard(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify hyperlink is preserved
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Copy_Paste_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// STACKING & EXTENDING FORMATS
// =============================================================================

test.describe('Stacking and Extending Formats', () => {

  test('Stacked Formats (Bold and Italic)', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Stacked';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_stacked` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Apply both bold and italic to same text
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence
    await page.keyboard.type('This text is bold and italic', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold and italic"
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply bold
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Apply italic (to the same selection)
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify both bold and italic applied
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Bold_And_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: All four styles on same text
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('All styles applied here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "All styles"
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply all four styles
    await page.keyboard.press('Control+b'); // Bold
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+i'); // Italic
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+u'); // Underline
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+5'); // Strikethrough
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify all styles applied
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_All_Styles.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Extending Formatted Text', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Extend';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_extend` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Type at end of bold text to see if formatting extends
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text and make part of it bold
    await page.keyboard.type('Start bold', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold" and make it bold
    await page.keyboard.press('Home');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Move cursor to end of "bold" (right after the bold text)
    await page.keyboard.press('End');
    await page.waitForTimeout(250);

    // Type more text - this tests if formatting extends
    await page.keyboard.type(' more text added', { delay: 100 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to see how formatting behaves when extending
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Extended_Formatting.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// HYPERLINKS (Creation, Editing, Formatting,Removal)
// =============================================================================

test.describe('Hyperlinks', () => {

  test('Create Hyperlinks in Text', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Hyperlinks';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_hyperlinks` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Hyperlink on selected text within a sentence
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a sentence with text that will become a hyperlink
    await page.keyboard.type('Visit our website for more info', { delay: 100 });
    await page.waitForTimeout(500);

    // Move cursor to the beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Move to the start of "website" (after "Visit our ")
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select the word "website" (7 characters)
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog with Alt+K (Windows shortcut)
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Wait for the hyperlink popup to appear and fill in the URL
    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(250);

    // Submit the hyperlink by clicking the Save button
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify hyperlink formatting
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_In_Text.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Insert hyperlink without pre-selected text
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type some text first
    await page.keyboard.type('Click here: ', { delay: 100 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog without selection (will insert new hyperlink)
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Wait for the hyperlink popup to appear
    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.fill('https://google.com');
    await page.waitForTimeout(250);

    // Fill in the display text
    const textInput = page.locator('#link-text');
    await textInput.fill('Google');
    await page.waitForTimeout(250);

    // Submit the hyperlink by clicking the Save button
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Continue typing after the hyperlink
    await page.keyboard.type(' for search', { delay: 100 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify inserted hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_Inserted.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Edit Existing Hyperlink', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Edit_Hyperlink';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_edit_link` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Edit an existing hyperlink's URL
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text and create a hyperlink
    await page.keyboard.type('Click this link here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "link" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the original URL
    const urlInput1 = page.locator('#link-url');
    await urlInput1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput1.fill('https://original-url.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before editing
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_Before_Edit.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and position cursor on the hyperlink
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1000);

    // Click Edit button in the popup
    const editButton = page.getByRole('button', { name: 'Edit' });
    await editButton.waitFor({ state: 'visible', timeout: 10000 });
    await editButton.click();
    await page.waitForTimeout(1000);

    // Change the URL
    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.clear();
    await urlInput2.fill('https://updated-url.com');
    await page.waitForTimeout(250);

    // Save the updated hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot after editing (visual should be same, but URL changed)
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_After_Edit.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });  

  test('Partial Formatting on Hyperlinked Text', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Hyperlink_Formatting';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_hyperlink_fmt` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Create hyperlink then apply bold to part of it
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text that will become a hyperlink
    await page.keyboard.type('Click here to visit', { delay: 100 });
    await page.waitForTimeout(500);

    // Select all the text to make it a hyperlink
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(250);

    // Open hyperlink dialog with Alt+K
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput1 = page.locator('#link-url');
    await urlInput1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput1.fill('https://example.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Now select part of the hyperlinked text and make it bold
    // Move cursor to the beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    // Move to "here" (after "Click ")
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "here" (4 characters)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply bold formatting
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify bold formatting on hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Hyperlink_With_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Create hyperlink with italic formatting
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Important link here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "Important" and make it italic first
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);

    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(250);

    // Now select "link" and make it a hyperlink
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(250);

    // Select "link" (4 characters)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.fill('https://google.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify mixed italic and hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Italic_And_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Hyperlink with multiple formatting styles
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Bold italic underline link', { delay: 100 });
    await page.waitForTimeout(500);

    // Make "Bold" bold
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Make "italic" italic
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(250);

    // Make "underline" underlined
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+u');
    await page.waitForTimeout(250);

    // Make "link" a hyperlink
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput3 = page.locator('#link-url');
    await urlInput3.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput3.fill('https://example.org');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify all formatting styles together
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Multiple_Formats_With_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 4: Bold and italic on same hyperlink text
    //--------------------------------

    // Navigate to cell A4 and enter edit mode
    await gotoCells(page, { a1: 'A4' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Click this styled link now', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "styled link" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput4 = page.locator('#link-url');
    await urlInput4.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput4.fill('https://styled-link.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Now apply bold to "styled" within the hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Apply italic to "link" within the hyperlink
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify bold and italic within hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Bold_Italic_In_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Remove Hyperlinks', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Remove_Hyperlinks';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_remove_link` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Remove hyperlink from cell - text should remain
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text that will become a hyperlink
    await page.keyboard.type('Visit our website today', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "website" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog with Alt+K
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput1 = page.locator('#link-url');
    await urlInput1.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput1.fill('https://example.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before removing the hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Remove_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and position cursor on the hyperlink
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text "website"
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1000);

    // The hyperlink popup should appear - click Remove button
    const removeButton = page.getByRole('button', { name: 'Remove' });
    await removeButton.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton.click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot after removing the hyperlink - text should remain but not be a link
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Remove_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Remove hyperlink that has formatting - formatting should remain
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Click this bold link here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold link" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in the URL
    const urlInput2 = page.locator('#link-url');
    await urlInput2.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput2.fill('https://bold-link.com');
    await page.waitForTimeout(250);

    // Save the hyperlink
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Now apply bold to "bold" within the hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before removing - should show bold hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Bold_Hyperlink_Before_Remove.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and position cursor on the hyperlink
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text
    await page.keyboard.press('Home');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1000);

    // Click Remove button
    const removeButton2 = page.getByRole('button', { name: 'Remove' });
    await removeButton2.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton2.click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot after removing - bold formatting should remain, hyperlink should be gone
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Bold_After_Remove_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Remove one hyperlink when multiple exist in cell
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text with two words that will become hyperlinks
    await page.keyboard.type('First link and second link here', { delay: 100 });
    await page.waitForTimeout(500);

    // Make "First link" a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput3 = page.locator('#link-url');
    await urlInput3.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput3.fill('https://first-link.com');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Make "second link" a hyperlink
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput4 = page.locator('#link-url');
    await urlInput4.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput4.fill('https://second-link.com');
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot with both hyperlinks
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Two_Hyperlinks.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Enter edit mode and remove only the first hyperlink
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the first hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1000);

    // Click Remove button
    const removeButton3 = page.getByRole('button', { name: 'Remove' });
    await removeButton3.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton3.click();
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot - first hyperlink removed, second should remain
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_One_Hyperlink_Removed.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Formula-Based Hyperlinks (HYPERLINK Function)', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Formula_Hyperlink';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_formula_link` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Create hyperlink using HYPERLINK formula
    //--------------------------------

    // Navigate to cell A1 and enter the HYPERLINK formula
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type the HYPERLINK formula
    await page.keyboard.type('=HYPERLINK("https://formula-link.com", "Formula Link")', { delay: 50 });
    await page.waitForTimeout(500);

    // Exit edit mode to execute formula
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot of the formula hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Formula_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Verify popup shows for formula hyperlink but Edit/Remove are hidden
    //--------------------------------

    // Enter edit mode and position cursor on the hyperlink
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Move cursor into the hyperlink area
    await page.keyboard.press('Home');
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1500);

    // Verify Open and Copy buttons are visible
    const openButton = page.getByRole('button', { name: 'Open' });
    await expect(openButton).toBeVisible({ timeout: 10000 });

    const copyButton = page.getByRole('button', { name: 'Copy' });
    await expect(copyButton).toBeVisible();

    // Verify Edit button is NOT visible for formula hyperlinks
    const editButton = page.getByRole('button', { name: 'Edit' });
    await expect(editButton).not.toBeVisible();

    // Verify Remove button is NOT visible for formula hyperlinks
    const removeButton = page.getByRole('button', { name: 'Remove' });
    await expect(removeButton).not.toBeVisible();

    // Take a screenshot of the popup for formula hyperlink
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Formula_Hyperlink_Popup.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test 3: Create hyperlink with just URL (no display text)
    //--------------------------------

    // Navigate to cell A2 and enter simple HYPERLINK formula
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('=HYPERLINK("https://url-only.com")', { delay: 50 });
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Formula_Hyperlink_URL_Only.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// URL HANDLING
// =============================================================================

test.describe('URL Handling', () => {

  test('Naked URL vs Manual Hyperlink', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_URL_Types';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_url_types` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Naked URL (typed directly, auto-detected)
    //--------------------------------

    // Navigate to cell A1 and type a naked URL
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('https://naked-url.com', { delay: 100 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test 2: Manual hyperlink with custom display text
    //--------------------------------

    // Navigate to cell A2 and create a manual hyperlink
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type display text
    await page.keyboard.type('Custom Link Text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select all and create hyperlink
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://manual-hyperlink.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test 3: Naked URL in middle of text (should not become link)
    //--------------------------------

    // Navigate to cell A3 and type text with URL embedded
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Visit https://embedded.com today', { delay: 100 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to compare the three types
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_URL_Types_Comparison.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Empty Selection Hyperlink', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Empty_Selection_Link';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_empty_link` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Create hyperlink with no text selected (inserts URL as text)
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type some text first
    await page.keyboard.type('Check this: ', { delay: 100 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog WITHOUT selecting any text
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Fill in URL only (no text selected)
    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://inserted-link.com');
    await page.waitForTimeout(250);

    // Fill in display text
    const textInput = page.locator('#link-text');
    await textInput.fill('Inserted Link');
    await page.waitForTimeout(250);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Continue typing after the inserted link
    await page.keyboard.type(' and more text', { delay: 100 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Empty_Selection_Hyperlink.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// UI AND POPUP VALIDATION
// =============================================================================

test.describe('UI and Popup Validation', () => {

  test('Hyperlink Popup View Mode - Displays All Elements', async ({ page }) => {
    // Constants
    const fileName = 'UI_Hyperlink_Popup_View';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_popup_view` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create a cell with a hyperlink
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Visit our website', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "website" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test: Verify popup view mode elements appear when hovering hyperlink
    //--------------------------------

    // Enter edit mode and position cursor on the hyperlink
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1500);

    // Verify the popup appears with all expected elements
    // Open button
    const openButton = page.getByRole('button', { name: 'Open' });
    await expect(openButton).toBeVisible({ timeout: 10000 });

    // Copy button
    const copyButton = page.getByRole('button', { name: 'Copy' });
    await expect(copyButton).toBeVisible();

    // Edit button
    const editButton = page.getByRole('button', { name: 'Edit' });
    await expect(editButton).toBeVisible();

    // Remove button
    const removeButton = page.getByRole('button', { name: 'Remove' });
    await expect(removeButton).toBeVisible();

    // URL should be displayed
    await expect(page.getByText('https://example.com')).toBeVisible();

    // Take a screenshot of the popup
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Hyperlink_Popup_View_Mode.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Hyperlink Popup Edit Mode - Input Fields and Buttons', async ({ page }) => {
    // Constants
    const fileName = 'UI_Hyperlink_Popup_Edit';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_popup_edit` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Verify edit mode shows URL and Text fields when creating new hyperlink
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Some text here', { delay: 100 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog without selection (insert mode)
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Verify URL input field is visible with correct placeholder
    const urlInput = page.locator('#link-url');
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    await expect(urlInput).toHaveAttribute('placeholder', 'https://example.com');

    // Verify Text input field is visible with correct placeholder
    const textInput = page.locator('#link-text');
    await expect(textInput).toBeVisible();
    await expect(textInput).toHaveAttribute('placeholder', 'Link text (optional)');

    // Verify Save button is disabled when URL is empty
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // Verify Cancel button is visible
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();

    // Fill in URL and verify Save becomes enabled
    await urlInput.fill('https://test-url.com');
    await page.waitForTimeout(250);
    await expect(saveButton).toBeEnabled();

    // Take a screenshot of the edit popup
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Hyperlink_Popup_Edit_Mode.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Cancel and exit
    await cancelButton.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Hyperlink Popup Keyboard Navigation', async ({ page }) => {
    // Constants
    const fileName = 'UI_Hyperlink_Keyboard_Nav';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_keyboard_nav` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Keyboard navigation in hyperlink popup
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Test keyboard navigation', { delay: 100 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // URL input should be auto-focused
    const urlInput = page.locator('#link-url');
    await expect(urlInput).toBeFocused({ timeout: 10000 });

    // Type in URL
    await page.keyboard.type('https://keyboard-test.com', { delay: 50 });
    await page.waitForTimeout(250);

    // Tab to text input
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);

    const textInput = page.locator('#link-text');
    await expect(textInput).toBeFocused();

    // Type display text
    await page.keyboard.type('Keyboard Link', { delay: 50 });
    await page.waitForTimeout(250);

    // Press Enter to save (should work from any field)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Verify hyperlink was created
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Hyperlink_Keyboard_Created.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test: Escape key cancels the popup
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Escape test', { delay: 100 });
    await page.waitForTimeout(500);

    // Open hyperlink dialog
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    // Verify popup is open
    await expect(page.locator('#link-url')).toBeVisible();

    // Type something
    await page.keyboard.type('https://will-be-cancelled.com', { delay: 50 });
    await page.waitForTimeout(250);

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Popup should be closed - URL input should not be visible
    await expect(page.locator('#link-url')).not.toBeVisible();

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Toolbar Button States Reflect Selection Formatting', async ({ page }) => {
    // Constants
    const fileName = 'UI_Toolbar_Button_States';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_toolbar_states` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create cells with different formatting
    //--------------------------------

    // Cell A1: Bold text
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Bold text', { delay: 100 });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Cell A2: Italic text
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Italic text', { delay: 100 });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+i');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Cell A3: Plain text
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Plain text', { delay: 100 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    //--------------------------------
    // Test: Navigate to bold cell and check toolbar state
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.waitForTimeout(500);

    // Take screenshot showing toolbar state for bold cell
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Bold_Cell_Selected.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test: Navigate to italic cell and check toolbar state
    //--------------------------------
    await gotoCells(page, { a1: 'A2' });
    await page.waitForTimeout(500);

    // Take screenshot showing toolbar state for italic cell
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Italic_Cell_Selected.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test: Navigate to plain cell and check toolbar state
    //--------------------------------
    await gotoCells(page, { a1: 'A3' });
    await page.waitForTimeout(500);

    // Take screenshot showing toolbar state for plain cell
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Plain_Cell_Selected.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Hyperlink Copy Button Functionality', async ({ page, context }) => {
    // Constants
    const fileName = 'UI_Hyperlink_Copy';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_copy_link` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    //--------------------------------
    // Setup: Create a cell with a hyperlink
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Copy this link', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "link" and make it a hyperlink
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput = page.locator('#link-url');
    await urlInput.fill('https://copy-test-url.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test: Click Copy button and verify clipboard content
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Position cursor on the hyperlinked text
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(1500);

    // Click the Copy button
    const copyButton = page.getByRole('button', { name: 'Copy' });
    await copyButton.waitFor({ state: 'visible', timeout: 10000 });
    await copyButton.click();
    await page.waitForTimeout(500);

    // Verify clipboard contains the URL
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe('https://copy-test-url.com');

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Inline Editor Shows Formatting Decorations', async ({ page }) => {
    // Constants
    const fileName = 'UI_Inline_Editor_Decorations';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_decorations` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create a cell with mixed formatting
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('Bold italic link text', { delay: 100 });
    await page.waitForTimeout(500);

    // Make "Bold" bold
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(250);

    // Make "italic" italic
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(250);

    // Make "link" a hyperlink
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);

    const urlInput = page.locator('#link-url');
    await urlInput.fill('https://example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Move cursor to beginning to see all decorations
    await page.keyboard.press('Home');
    await page.waitForTimeout(500);

    // Take a screenshot of the inline editor showing decorations
    // Note: The inline editor should show bold as bold, italic as italic, and hyperlink as blue underlined
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Inline_Editor_Decorations.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Test: Re-enter edit mode and verify decorations persist
    //--------------------------------
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Take another screenshot to verify decorations show when re-entering edit mode
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Inline_Editor_Decorations_Reopen.png', {
      maxDiffPixelRatio: 0.01,
    });

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });

  test('Format Via Toolbar Button Click', async ({ page }) => {
    // Constants
    const fileName = 'UI_Toolbar_Click_Format';

    // Log in
    await logIn(page, { emailPrefix: `e2e_ui_toolbar_click` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test 1: Apply bold via toolbar button while editing
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Click to make this bold', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "bold" (characters 19-23)
    await page.keyboard.press('Home');
    for (let i = 0; i < 19; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click the Bold button in the toolbar
    await page.locator('[data-testid="TextFormatting"] button').first().click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify bold was applied via toolbar click
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Click_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Apply italic via toolbar button while editing
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Click to make this italic', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "italic" (characters 19-25)
    await page.keyboard.press('Home');
    for (let i = 0; i < 19; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click the Italic button in the toolbar (second button)
    await page.locator('[data-testid="TextFormatting"] button').nth(1).click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify italic was applied via toolbar click
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Click_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 3: Apply underline via toolbar button while editing
    //--------------------------------

    // Navigate to cell A3 and enter edit mode
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Click to underline this', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "underline" (characters 9-18)
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Click the Underline button in the toolbar (third button)
    await page.locator('[data-testid="TextFormatting"] button').nth(2).click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot to verify underline was applied via toolbar click
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('UI_Toolbar_Click_Underline.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// PERSISTENCE & DATA INTEGRITY
// =============================================================================

test.describe('Persistence and Data Integrity', () => {
  
  test('Persistence After Reload', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Persistence';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_persist` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Setup: Create cells with various rich text formatting
    //--------------------------------

    // Cell A1: Bold text
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('This has bold text', { delay: 100 });
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Cell A2: Italic text
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('This has italic text', { delay: 100 });
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Cell A3: Hyperlink
    await gotoCells(page, { a1: 'A3' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.type('Click this link here', { delay: 100 });
    await page.keyboard.press('Home');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.keyboard.press('Alt+k');
    await page.waitForTimeout(1000);
    const urlInput = page.locator('#link-url');
    await urlInput.waitFor({ state: 'visible', timeout: 10000 });
    await urlInput.fill('https://persist-test.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot before reload
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Before_Reload.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Reload the page
    //--------------------------------
    await sheetRefreshPage(page);
    await page.waitForTimeout(2000);

    // Take a screenshot after reload - formatting should persist
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_After_Reload.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

test.describe('Edge Cases', () => {

  test('Partial Word Formatting', async ({ page }) => {
    // Constants
    const fileName = 'Rich_Text_Partial_Word';

    // Log in
    await logIn(page, { emailPrefix: `e2e_rich_text_partial` });

    // Clean up lingering files
    await cleanUpFiles(page, { fileName });

    // Create a new file
    await createFile(page, { fileName, skipNavigateBack: true });

    //--------------------------------
    // Test: Format only part of a word (not whole word)
    //--------------------------------

    // Navigate to cell A1 and enter edit mode
    await gotoCells(page, { a1: 'A1' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type a word
    await page.keyboard.type('Highlighting partial text', { delay: 100 });
    await page.waitForTimeout(500);

    // Select only "light" from "Highlighting" (characters 4-8)
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply bold to just "light"
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Partial_Word_Bold.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Test 2: Format across word boundary
    //--------------------------------

    // Navigate to cell A2 and enter edit mode
    await gotoCells(page, { a1: 'A2' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type('Word boundary test here', { delay: 100 });
    await page.waitForTimeout(500);

    // Select "ry te" (end of "boundary" + space + start of "test")
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await page.waitForTimeout(250);

    // Apply italic across word boundary
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(500);

    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Take a screenshot
    await expect(page.locator('#QuadraticCanvasID')).toHaveScreenshot('Rich_Text_Cross_Word_Italic.png', {
      maxDiffPixelRatio: 0.01,
    });

    //--------------------------------
    // Clean up:
    //--------------------------------
    await page.locator(`nav a svg`).click({ timeout: 60 * 1000 });
    await cleanUpFiles(page, { fileName });
  });
});