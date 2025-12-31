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
const SCALE_EMOJI = 0.81;

// Output directories
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'emojis');
const FONT_PATH = path.join(__dirname, 'Noto_Color_Emoji', 'NotoColorEmoji-Regular.ttf');

// Unicode emoji ranges and sequences
function getEmojiList() {
  const emojis = [];

  // Basic emoticons and symbols (Miscellaneous Symbols and Pictographs)
  for (let code = 0x1f300; code <= 0x1f5ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Emoticons
  for (let code = 0x1f600; code <= 0x1f64f; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Transport and map symbols
  for (let code = 0x1f680; code <= 0x1f6ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Supplemental Symbols and Pictographs
  for (let code = 0x1f900; code <= 0x1f9ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Symbols and Pictographs Extended-A
  for (let code = 0x1fa00; code <= 0x1fa6f; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Symbols and Pictographs Extended-A (more)
  for (let code = 0x1fa70; code <= 0x1faff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Dingbats
  for (let code = 0x2700; code <= 0x27bf; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Miscellaneous Symbols
  for (let code = 0x2600; code <= 0x26ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Arrows
  for (let code = 0x2190; code <= 0x21ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Mathematical Operators (some are used as emojis)
  for (let code = 0x2200; code <= 0x22ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Geometric Shapes
  for (let code = 0x25a0; code <= 0x25ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Common symbol characters used as emojis
  const additionalEmojis = [
    '©',
    '®',
    '™',
    '‼',
    '⁉',
    '#️⃣',
    '*️⃣',
    '0️⃣',
    '1️⃣',
    '2️⃣',
    '3️⃣',
    '4️⃣',
    '5️⃣',
    '6️⃣',
    '7️⃣',
    '8️⃣',
    '9️⃣',
    '🔟',
    '🏳️',
    '🏴',
    '🏁',
    '🚩',
    '🎌',
    '🏴‍☠️',
  ];

  emojis.push(...additionalEmojis);

  // Regional indicator symbols for flags (A-Z)
  for (let code = 0x1f1e6; code <= 0x1f1ff; code++) {
    emojis.push(String.fromCodePoint(code));
  }

  // Common country flag combinations
  const flagPairs = [
    'US',
    'GB',
    'CA',
    'AU',
    'DE',
    'FR',
    'IT',
    'ES',
    'JP',
    'CN',
    'KR',
    'IN',
    'BR',
    'MX',
    'RU',
    'NL',
    'BE',
    'CH',
    'AT',
    'SE',
    'NO',
    'DK',
    'FI',
    'PL',
    'CZ',
    'PT',
    'GR',
    'TR',
    'IL',
    'SA',
    'AE',
    'EG',
    'ZA',
    'NG',
    'KE',
    'AR',
    'CL',
    'CO',
    'PE',
    'VE',
    'NZ',
    'SG',
    'MY',
    'TH',
    'VN',
    'PH',
    'ID',
    'PK',
    'BD',
    'UA',
    'IE',
    'HU',
    'RO',
    'SK',
    'HR',
    'SI',
    'BG',
    'RS',
    'LT',
    'LV',
    'EE',
    'BY',
    'MD',
    'GE',
    'AM',
    'AZ',
    'KZ',
    'UZ',
    'TM',
    'KG',
    'TJ',
    'MN',
    'AF',
    'IQ',
    'IR',
    'SY',
    'LB',
    'JO',
    'KW',
    'QA',
    'BH',
    'OM',
    'YE',
    'HK',
    'TW',
    'MO',
    'EU',
  ];

  for (const pair of flagPairs) {
    const flag = String.fromCodePoint(0x1f1e6 + pair.charCodeAt(0) - 65, 0x1f1e6 + pair.charCodeAt(1) - 65);
    emojis.push(flag);
  }

  // Skin tone modifiers applied to common emojis
  const skinTones = [0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff];

  const skinToneEmojis = [
    0x1f44b, 0x1f44c, 0x1f44d, 0x1f44e, 0x1f44f, 0x1f64b, 0x1f64c, 0x1f64d, 0x1f64e, 0x1f64f, 0x1f466, 0x1f467, 0x1f468,
    0x1f469, 0x1f474, 0x1f475, 0x1f476, 0x1f471, 0x1f472, 0x1f473, 0x1f46e, 0x1f477, 0x1f478, 0x1f385, 0x1f936, 0x1f9d1,
    0x1f9d2, 0x1f9d3, 0x1f9d4,
  ];

  for (const baseEmoji of skinToneEmojis) {
    for (const skinTone of skinTones) {
      emojis.push(String.fromCodePoint(baseEmoji, skinTone));
    }
  }

  // ZWJ sequences
  const zwjSequences = [
    '👨‍👩‍👦',
    '👨‍👩‍👧',
    '👨‍👩‍👧‍👦',
    '👨‍👩‍👦‍👦',
    '👨‍👩‍👧‍👧',
    '👨‍👨‍👦',
    '👨‍👨‍👧',
    '👨‍👨‍👧‍👦',
    '👨‍👨‍👦‍👦',
    '👨‍👨‍👧‍👧',
    '👩‍👩‍👦',
    '👩‍👩‍👧',
    '👩‍👩‍👧‍👦',
    '👩‍👩‍👦‍👦',
    '👩‍👩‍👧‍👧',
    '👨‍👦',
    '👨‍👦‍👦',
    '👨‍👧',
    '👨‍👧‍👦',
    '👨‍👧‍👧',
    '👩‍👦',
    '👩‍👦‍👦',
    '👩‍👧',
    '👩‍👧‍👦',
    '👩‍👧‍👧',
    '👩‍❤️‍👨',
    '👨‍❤️‍👨',
    '👩‍❤️‍👩',
    '👩‍❤️‍💋‍👨',
    '👨‍❤️‍💋‍👨',
    '👩‍❤️‍💋‍👩',
    '👨‍⚕️',
    '👩‍⚕️',
    '👨‍🎓',
    '👩‍🎓',
    '👨‍🏫',
    '👩‍🏫',
    '👨‍⚖️',
    '👩‍⚖️',
    '👨‍🌾',
    '👩‍🌾',
    '👨‍🍳',
    '👩‍🍳',
    '👨‍🔧',
    '👩‍🔧',
    '👨‍🏭',
    '👩‍🏭',
    '👨‍💼',
    '👩‍💼',
    '👨‍🔬',
    '👩‍🔬',
    '👨‍💻',
    '👩‍💻',
    '👨‍🎤',
    '👩‍🎤',
    '👨‍🎨',
    '👩‍🎨',
    '👨‍✈️',
    '👩‍✈️',
    '👨‍🚀',
    '👩‍🚀',
    '👨‍🚒',
    '👩‍🚒',
    '🐻‍❄️',
    '🧑‍🤝‍🧑',
    '👭',
    '👫',
    '👬',
    '🏳️‍🌈',
    '🏳️‍⚧️',
    '👁️‍🗨️',
    '🧔‍♂️',
    '🧔‍♀️',
  ];

  emojis.push(...zwjSequences);

  const variationEmojis = ['☀️', '☁️', '☂️', '☃️', '☄️', '☎️', '⌚', '⌛', '⏰', '⏱️', '⏲️', '⏳'];
  emojis.push(...variationEmojis);

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

  // First, test which emojis actually render in the browser
  console.log('Testing which emojis render correctly...');
  await page.setContent(htmlTemplate);
  await page.waitForFunction(() => document.fonts.ready);

  // Test emojis in batches
  const validEmojis = [];
  const batchSize = 100;

  for (let i = 0; i < uniqueEmojis.length; i += batchSize) {
    const batch = uniqueEmojis.slice(i, i + batchSize);
    const results = await page.evaluate(
      (emojis, charSize) => {
        const valid = [];
        const canvas = document.createElement('canvas');
        canvas.width = charSize * 2;
        canvas.height = charSize * 2;
        const ctx = canvas.getContext('2d');
        ctx.font = `${charSize}px NotoColorEmoji`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const emoji of emojis) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillText(emoji, charSize, charSize);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let hasPixels = false;
          for (let j = 3; j < imageData.data.length; j += 4) {
            if (imageData.data[j] > 0) {
              hasPixels = true;
              break;
            }
          }
          if (hasPixels) {
            valid.push(emoji);
          }
        }
        return valid;
      },
      batch,
      CHARACTER_SIZE
    );

    validEmojis.push(...results);
    process.stdout.write(
      `\r  Tested ${Math.min(i + batchSize, uniqueEmojis.length)}/${uniqueEmojis.length} emojis, ${validEmojis.length} valid`
    );
  }
  console.log(`\n  ${validEmojis.length} emojis render correctly\n`);

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
