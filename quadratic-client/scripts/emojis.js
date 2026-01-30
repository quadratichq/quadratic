/**
 * Emoji Spritesheet Generator
 *
 * Generates spritesheets from Noto Color Emoji font using Puppeteer.
 *
 * USAGE:
 *   First install puppeteer (one-time, not committed to package.json):
 *     npm install puppeteer
 *
 *   Then run the script:
 *     node scripts/emojis.js
 *
 * The generated spritesheets will be placed in public/emojis/
 */

import fse from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for puppeteer
let puppeteer;
try {
  puppeteer = await import('puppeteer');
  puppeteer = puppeteer.default;
} catch {
  console.error('Error: puppeteer is not installed.\n');
  console.error('This script requires puppeteer to render color emojis.');
  console.error('Puppeteer is intentionally not in package.json to avoid bloating node_modules.\n');
  console.error('To install puppeteer temporarily and run this script:');
  console.error('  npm install puppeteer && node scripts/emojis.js\n');
  console.error('Or to install it just for this session:');
  console.error('  npx --yes puppeteer node scripts/emojis.js\n');
  process.exit(1);
}

// Match the runtime constants from emojis.ts
const PAGE_SIZE = 1024;
const CHARACTER_SIZE = 125;
// Scale factor to fit emoji within cell (font renders at 1.245x the Em)
const SCALE_EMOJI = 0.81;

// Output directories
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'emojis');
const FONT_PATH = path.join(__dirname, 'Noto_Color_Emoji', 'NotoColorEmoji-Regular.ttf');
const EMOJI_METADATA_PATH = path.join(__dirname, 'emoji_metadata.json');

// Get emoji list from Google's official Noto Color Emoji metadata
function getEmojiList() {
  const metadata = JSON.parse(fse.readFileSync(EMOJI_METADATA_PATH, 'utf8'));
  const emojis = [];

  for (const group of metadata) {
    for (const emojiData of group.emoji) {
      // Add base emoji (convert code points array to string)
      const baseEmoji = String.fromCodePoint(...emojiData.base);
      emojis.push(baseEmoji);

      // Add all alternates (skin tones, genders, etc.)
      if (emojiData.alternates) {
        for (const alt of emojiData.alternates) {
          const altEmoji = String.fromCodePoint(...alt);
          emojis.push(altEmoji);
        }
      }
    }
  }

  return emojis;
}

async function generateSpritesheets() {
  console.log('Generating emoji spritesheets from Noto Color Emoji using Puppeteer...\n');

  // Ensure output directory exists
  await fse.ensureDir(OUTPUT_DIR);

  // Clean old files
  const existingFiles = await fse.readdir(OUTPUT_DIR);
  for (const file of existingFiles) {
    await fse.unlink(path.join(OUTPUT_DIR, file));
  }

  // Read the font file as base64 for embedding
  console.log('Loading Noto Color Emoji font...');
  const fontBuffer = await fse.readFile(FONT_PATH);
  const fontBase64 = fontBuffer.toString('base64');

  // Launch browser
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Get all emojis
  console.log('Scanning emoji ranges...');
  const allEmojis = getEmojiList();
  console.log(`  Found ${allEmojis.length} potential emojis`);

  // Filter to unique emojis
  const uniqueEmojis = [...new Set(allEmojis)];
  console.log(`  ${uniqueEmojis.length} unique emojis`);

  // Set up HTML template with embedded font
  const fontSize = Math.floor(CHARACTER_SIZE * SCALE_EMOJI);
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @font-face {
          font-family: 'NotoColorEmoji';
          src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
        }
        * {
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'NotoColorEmoji', sans-serif;
          background: transparent;
          /* Enable OpenType features for ligatures (skin tones, ZWJ sequences) */
          font-feature-settings: 'ccmp' 1, 'liga' 1;
          text-rendering: optimizeLegibility;
          -webkit-font-feature-settings: 'ccmp' 1, 'liga' 1;
        }
        .emoji-cell {
          width: ${CHARACTER_SIZE}px;
          height: ${CHARACTER_SIZE}px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: ${fontSize}px;
          line-height: 1;
          box-sizing: border-box;
          font-feature-settings: 'ccmp' 1, 'liga' 1;
        }
        .page {
          width: ${PAGE_SIZE}px;
          height: ${PAGE_SIZE}px;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
        }
      </style>
    </head>
    <body>
      <div class="page" id="page"></div>
    </body>
    </html>
  `;

  // Calculate layout
  const emojisPerRow = Math.floor(PAGE_SIZE / CHARACTER_SIZE);
  const emojisPerPage = emojisPerRow * emojisPerRow;

  // Set up the page with the font
  console.log('Loading font in browser...');
  await page.setContent(htmlTemplate);
  await page.waitForFunction(() => document.fonts.ready);

  // The emoji metadata from Google is authoritative - all emojis in it are valid
  // No additional filtering needed since we're using the official Noto Color Emoji metadata
  const validEmojis = uniqueEmojis;
  console.log(`  Using ${validEmojis.length} emojis from official metadata`);

  const totalPages = Math.ceil(validEmojis.length / emojisPerPage);
  console.log(`Layout: ${emojisPerRow}x${emojisPerRow} = ${emojisPerPage} emojis per ${PAGE_SIZE}x${PAGE_SIZE} page`);
  console.log(`Total pages needed: ${totalPages}\n`);

  // Mapping data
  const mapping = {
    pageSize: PAGE_SIZE,
    characterSize: CHARACTER_SIZE,
    scaleEmoji: SCALE_EMOJI,
    pages: [],
    emojis: {},
  };

  let emojiIndex = 0;

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    console.log(`Generating page ${pageNum + 1}/${totalPages}...`);

    const pageEmojis = validEmojis.slice(emojiIndex, emojiIndex + emojisPerPage);

    // Create HTML for this page
    const cellsHtml = pageEmojis.map((emoji) => `<div class="emoji-cell">${emoji}</div>`).join('');

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @font-face {
            font-family: 'NotoColorEmoji';
            src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
          }
          * { margin: 0; padding: 0; }
          body {
            font-family: 'NotoColorEmoji', sans-serif;
            background: transparent;
            font-feature-settings: 'ccmp' 1, 'liga' 1;
            text-rendering: optimizeLegibility;
            -webkit-font-feature-settings: 'ccmp' 1, 'liga' 1;
          }
          .emoji-cell {
            width: ${CHARACTER_SIZE}px;
            height: ${CHARACTER_SIZE}px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: ${fontSize}px;
            line-height: 1;
            box-sizing: border-box;
            font-feature-settings: 'ccmp' 1, 'liga' 1;
          }
          .page {
            width: ${PAGE_SIZE}px;
            height: ${PAGE_SIZE}px;
            display: flex;
            flex-wrap: wrap;
            align-content: flex-start;
          }
        </style>
      </head>
      <body>
        <div class="page" id="page">${cellsHtml}</div>
      </body>
      </html>
    `);

    // Wait for font to load
    await page.waitForFunction(() => document.fonts.ready);
    // Small delay to ensure rendering is complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Screenshot the page element
    const pageElement = await page.$('#page');
    const screenshot = await pageElement.screenshot({
      type: 'png',
      omitBackground: true,
    });

    // Save page image
    const pageFilename = `emoji-${pageNum}.png`;
    const pagePath = path.join(OUTPUT_DIR, pageFilename);
    await fse.writeFile(pagePath, screenshot);

    // Update mapping
    for (let i = 0; i < pageEmojis.length; i++) {
      const emoji = pageEmojis[i];
      const col = i % emojisPerRow;
      const row = Math.floor(i / emojisPerRow);
      mapping.emojis[emoji] = {
        page: pageNum,
        x: col * CHARACTER_SIZE,
        y: row * CHARACTER_SIZE,
        width: CHARACTER_SIZE,
        height: CHARACTER_SIZE,
      };
    }

    mapping.pages.push({
      filename: pageFilename,
      emojiCount: pageEmojis.length,
    });

    emojiIndex += pageEmojis.length;
    console.log(`  Saved ${pageFilename} with ${pageEmojis.length} emojis`);
  }

  await browser.close();

  // Save mapping JSON
  const mappingPath = path.join(OUTPUT_DIR, 'emoji-mapping.json');
  await fse.writeFile(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nSaved mapping to emoji-mapping.json`);

  console.log(`\nComplete! Generated ${totalPages} spritesheet(s) with ${validEmojis.length} emojis.`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

generateSpritesheets().catch((error) => {
  console.error('Error generating spritesheets:', error);
  process.exit(1);
});
