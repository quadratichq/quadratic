import * as fontKit from 'fontkit';
import fse from 'fs-extra';
import generateBMFont from 'msdf-bmfont-xml';
import path from 'path';
import { exit } from 'process';
import xml2js from 'xml2js';

const fontDirectory = path.join('public', 'fonts');
const fontFamilies = ['opensans'];
const fontFiles = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

// Map Open Sans font names to Noto Sans equivalents
const notoSansFontMap = {
  OpenSans: 'NotoSans-Regular',
  'OpenSans-Bold': 'NotoSans-Bold',
  'OpenSans-Italic': 'NotoSans-Italic',
  'OpenSans-BoldItalic': 'NotoSans-BoldItalic',
};

async function cleanOldFiles() {
  console.log('Removing old files...');
  for (const family of fontFamilies) {
    const files = await fse.readdir(path.join(fontDirectory, family));
    for (const file of files) {
      if (file.includes('.png') || file.includes('.fnt')) {
        await fse.unlink(path.join(fontDirectory, family, file));
      }
    }
  }
}

async function writeFontFiles(textures, fontData) {
  for (const texture of textures) {
    try {
      // texture.filename already includes .png extension, don't add it again
      const filename = texture.filename.endsWith('.png') ? texture.filename : `${texture.filename}.png`;
      console.log(`Writing ${filename}...`);
      await fse.writeFile(filename, texture.texture);
    } catch (e) {
      console.error(e);
      exit(1);
    }
  }
  try {
    console.log(`Writing ${fontData.filename}...`);
    await fse.writeFile(fontData.filename, fontData.data);
  } catch (e) {
    console.error(e);
    exit(1);
  }
}

function convertFont(family, font) {
  return new Promise(async (resolve) => {
    console.log(`  ${font}...`);
    const openSansFontFile = path.join(fontDirectory, family, `${font}.ttf`);
    const notoSansFontName = notoSansFontMap[font];
    const notoSansFontFile = path.join(fontDirectory, 'Noto_Sans', 'static', `${notoSansFontName}.ttf`);

    const { openSansChars, missingChars } = await outputGlyphs(openSansFontFile, notoSansFontFile);

    // Generate Open Sans font with only characters it supports
    generateBMFont(
      openSansFontFile,
      { 'smart-size': true, charset: openSansChars },
      async (error, openSansTextures, openSansFontData) => {
        if (error) {
          console.error(error);
          exit(1);
        }

        // If there are missing characters, generate them from Noto Sans and merge
        if (missingChars.length > 0) {
          console.log(`    Merging ${missingChars.length} missing characters from Noto Sans...`);
          await mergeNotoSansGlyphs(notoSansFontFile, missingChars, openSansTextures, openSansFontData);
        }

        await writeFontFiles(openSansTextures, openSansFontData);
        resolve();
      }
    );
  });
}

async function mergeNotoSansGlyphs(notoSansFontFile, missingChars, existingTextures, existingFontData) {
  return new Promise((resolve, reject) => {
    generateBMFont(
      notoSansFontFile,
      { 'smart-size': true, charset: missingChars },
      async (error, notoTextures, notoFontData) => {
        if (error) {
          console.error(`Warning: Could not generate Noto Sans fallback glyphs: ${error.message}`);
          resolve(); // Continue without merging
          return;
        }

        // Parse both font XML files
        const { parseString, Builder } = xml2js;

        parseString(existingFontData.data, (err, existingFont) => {
          if (err) {
            console.error(`Warning: Could not parse existing font XML: ${err.message}`);
            resolve();
            return;
          }

          parseString(notoFontData.data, (err, notoFont) => {
            if (err) {
              console.error(`Warning: Could not parse Noto Sans font XML: ${err.message}`);
              resolve();
              return;
            }

            // Merge characters from Noto Sans into existing font
            const existingChars = existingFont.font.chars[0].char || [];
            const notoChars = notoFont.font.chars[0].char || [];

            // Update page references for Noto Sans characters
            const pageOffset = existingTextures.length;
            notoChars.forEach((char) => {
              char.$.page = String(parseInt(char.$.page) + pageOffset);
            });

            // Add Noto Sans characters to existing font
            existingFont.font.chars[0].char = [...existingChars, ...notoChars];

            // Update character count
            existingFont.font.chars[0].$.count = String(existingFont.font.chars[0].char.length);

            // Merge textures - update filenames to match page numbers
            // Extract base filename without page number and extension
            const firstExistingFilename = existingTextures[0].filename;
            // Remove the page number pattern (e.g., ".0.png", ".1.png") from the end
            // Handle both cases: with and without .png extension
            // Pattern: remove ".N.png" or ".N" at the end where N is a digit
            let baseFilename = firstExistingFilename;
            // Try to match ".N.png" pattern first
            baseFilename = baseFilename.replace(/\.\d+\.png$/i, '');
            // If that didn't match, try ".N" pattern (in case .png was already removed)
            if (baseFilename === firstExistingFilename) {
              baseFilename = baseFilename.replace(/\.\d+$/i, '');
            }
            // Remove .png if it's still there (shouldn't happen, but be safe)
            baseFilename = baseFilename.replace(/\.png$/i, '');

            // Update page elements with new filenames and IDs
            // Extract the base name from the first existing page file (e.g., "OpenSans" from "OpenSans.0.png")
            const firstExistingPageFile = existingFont.font.pages[0].page[0].$.file || '';
            const basePageName = firstExistingPageFile.replace(/\.\d+\.png$/i, '').replace(/\.png$/i, '');

            const updatedNotoPages = notoFont.font.pages[0].page.map((page, idx) => {
              const newPageNumber = pageOffset + idx;
              // Create new filename matching the Open Sans naming convention
              const newFileName = `${basePageName}.${newPageNumber}.png`;
              return {
                $: {
                  ...page.$,
                  id: String(parseInt(page.$.id) + pageOffset),
                  file: newFileName,
                },
              };
            });

            // Update page count
            existingFont.font.pages[0].page = [...existingFont.font.pages[0].page, ...updatedNotoPages];

            // Update total page count in common element
            const totalPages = existingFont.font.pages[0].page.length;
            existingFont.font.common[0].$.pages = String(totalPages);

            notoTextures.forEach((texture, idx) => {
              // Construct new filename with correct page number
              // pageOffset is the number of existing textures, so new pages start at that number
              const newPageNumber = pageOffset + idx;
              texture.filename = `${baseFilename}.${newPageNumber}.png`;
              existingTextures.push(texture);
            });

            // Rebuild XML
            const builder = new Builder({ headless: true });
            existingFontData.data = builder.buildObject(existingFont);

            resolve();
          });
        });
      }
    );
  });
}

async function outputGlyphs(openSansFontFile, notoSansFontFile) {
  const openSansFont = await fontKit.open(openSansFontFile);
  const notoSansFont = await fontKit.open(notoSansFontFile);

  // Currency symbols that we need to ensure are included
  // From quadratic-core/src/values/cellvalue.rs: "$", "€", "£", "¥", "₹", "₩", "₺", "₽"
  const requiredCurrencySymbols = ['$', '€', '£', '¥', '₹', '₩', '₺', '₽'];

  // Get all characters from Open Sans that have actual glyph data
  const openSansChars = [];
  openSansFont.characterSet.forEach((value) => {
    if (value && value !== ' ' && openSansFont.hasGlyphForCodePoint(value)) {
      const glyph = openSansFont.getGlyph(value);
      if (glyph && glyph.path && glyph.path.commands && glyph.path.commands.length > 0) {
        openSansChars.push(String.fromCharCode(value));
      }
    }
  });

  // Only include currency symbols that are missing from Open Sans
  const openSansCharsSet = new Set(openSansChars);
  const missingChars = [];

  // Check each required currency symbol
  for (const currencySymbol of requiredCurrencySymbols) {
    if (!openSansCharsSet.has(currencySymbol)) {
      const codePoint = currencySymbol.codePointAt(0);
      if (codePoint && notoSansFont.hasGlyphForCodePoint(codePoint)) {
        missingChars.push(currencySymbol);
      }
    }
  }

  console.log(`    Open Sans: ${openSansChars.length} characters`);
  console.log(`    Noto Sans fallback: ${missingChars.length} characters`);

  return { openSansChars, missingChars };
}

async function convertFonts() {
  console.log('\nConverting fonts from ttf to msdf format...');

  await cleanOldFiles();

  for (const family of fontFamilies) {
    console.log(` ${family}/`);
    for (const font of fontFiles) {
      await convertFont(family, font);
    }
  }

  console.log('Conversion complete.\n');
  exit(0);
}

convertFonts();
