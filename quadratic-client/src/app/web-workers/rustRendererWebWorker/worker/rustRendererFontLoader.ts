/**
 * Font loader for the Rust renderer.
 *
 * Loads BMFont files (.fnt) and texture atlases (.png) from the server.
 * Font loading happens in parallel with WASM initialization to minimize
 * startup time - while WASM is compiling/initializing, fonts are being fetched.
 *
 * BMFont XML is parsed and converted to JSON format for the Rust renderer.
 */

// Font configuration (matches Rust constants)
const FONT_BASE_URL = '/fonts/opensans/';
const FONT_NAMES = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

/**
 * Loaded font texture data ready for upload to WebGL/WebGPU
 */
export interface FontTexture {
  textureUid: number;
  width: number;
  height: number;
  rgbaData: Uint8Array;
}

/**
 * Character frame in the texture atlas
 */
interface CharFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Character data for Rust renderer
 */
interface BitmapChar {
  texture_uid: number;
  x_advance: number;
  x_offset: number;
  y_offset: number;
  orig_width: number;
  texture_height: number;
  kerning: Record<number, number>;
  uvs: number[];
  frame: CharFrame;
}

/**
 * Font data in JSON format for Rust renderer
 */
interface BitmapFontJson {
  font: string;
  size: number;
  line_height: number;
  distance_range: number;
  chars: Record<number, BitmapChar>;
}

/**
 * Loaded font data ready for passing to Rust
 */
export interface LoadedFont {
  /** Font name (e.g., "OpenSans", "OpenSans-Bold") */
  fontName: string;
  /** JSON string in the format expected by Rust BitmapFont */
  fntContent: string;
  /** Texture pages with decoded RGBA data */
  textures: FontTexture[];
  /** Base texture UID for this font (assigned during loading) */
  textureUidBase: number;
}

/**
 * Result of loading all fonts
 */
export interface FontLoadResult {
  fonts: LoadedFont[];
  /** Total number of texture pages across all fonts */
  totalTextures: number;
}

/**
 * Parse BMFont XML attributes from a tag
 */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(tag)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/**
 * Parse the number of pages from a BMFont XML file.
 */
function extractPageCount(fntContent: string): number {
  const match = fntContent.match(/<common[^>]*pages="(\d+)"/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Parse BMFont XML and convert to JSON format for Rust renderer
 */
function parseBMFontXML(
  xmlContent: string,
  fontName: string,
  textureUidBase: number,
  textureWidths: number[],
  textureHeights: number[]
): BitmapFontJson {
  const chars: Record<number, BitmapChar> = {};
  const kernings: Map<number, Record<number, number>> = new Map();

  // Parse info tag for size
  const infoMatch = xmlContent.match(/<info[^>]*>/);
  const infoAttrs = infoMatch ? parseAttributes(infoMatch[0]) : {};
  const size = parseFloat(infoAttrs['size'] || '32');

  // Parse common tag for line height
  const commonMatch = xmlContent.match(/<common[^>]*>/);
  const commonAttrs = commonMatch ? parseAttributes(commonMatch[0]) : {};
  const lineHeight = parseFloat(commonAttrs['lineHeight'] || String(size));
  const scaleW = parseFloat(commonAttrs['scaleW'] || '1');
  const scaleH = parseFloat(commonAttrs['scaleH'] || '1');

  // Parse kerning pairs first
  const kerningRegex = /<kerning[^>]*>/g;
  let kerningMatch;
  while ((kerningMatch = kerningRegex.exec(xmlContent)) !== null) {
    const attrs = parseAttributes(kerningMatch[0]);
    const first = parseInt(attrs['first'] || '0', 10);
    const second = parseInt(attrs['second'] || '0', 10);
    const amount = parseFloat(attrs['amount'] || '0');

    if (!kernings.has(first)) {
      kernings.set(first, {});
    }
    kernings.get(first)![second] = amount;
  }

  // Parse char tags
  const charRegex = /<char[^>]*>/g;
  let charMatch;
  while ((charMatch = charRegex.exec(xmlContent)) !== null) {
    const attrs = parseAttributes(charMatch[0]);

    const id = parseInt(attrs['id'] || '0', 10);
    const x = parseFloat(attrs['x'] || '0');
    const y = parseFloat(attrs['y'] || '0');
    const width = parseFloat(attrs['width'] || '0');
    const height = parseFloat(attrs['height'] || '0');
    const xoffset = parseFloat(attrs['xoffset'] || '0');
    const yoffset = parseFloat(attrs['yoffset'] || '0');
    const xadvance = parseFloat(attrs['xadvance'] || '0');
    const page = parseInt(attrs['page'] || '0', 10);

    const textureUid = textureUidBase + page;

    // Get texture dimensions for this page
    const texWidth = textureWidths[page] || scaleW;
    const texHeight = textureHeights[page] || scaleH;

    // Calculate UV coordinates (normalized 0-1)
    const u0 = x / texWidth;
    const v0 = y / texHeight;
    const u1 = (x + width) / texWidth;
    const v1 = (y + height) / texHeight;

    // UVs for 4 corners: top-left, top-right, bottom-right, bottom-left
    const uvs = [u0, v0, u1, v0, u1, v1, u0, v1];

    chars[id] = {
      texture_uid: textureUid,
      x_advance: xadvance,
      x_offset: xoffset,
      y_offset: yoffset,
      orig_width: width,
      texture_height: height,
      kerning: kernings.get(id) || {},
      uvs,
      frame: { x, y, width, height },
    };
  }

  return {
    font: fontName,
    size,
    line_height: lineHeight,
    distance_range: 4.0, // Standard MSDF distance range
    chars,
  };
}

/**
 * Decode a PNG blob to RGBA pixel data using browser APIs.
 */
async function decodePngToRgba(pngBlob: Blob): Promise<{ width: number; height: number; data: Uint8Array }> {
  // Create ImageBitmap from the blob
  const bitmap = await createImageBitmap(pngBlob);
  const { width, height } = bitmap;

  // Draw to OffscreenCanvas to get pixel data
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context from OffscreenCanvas');
  }

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);

  return {
    width,
    height,
    data: new Uint8Array(imageData.data.buffer),
  };
}

/**
 * Load a single font and all its texture pages.
 */
async function loadFont(fontName: string, textureUidBase: number): Promise<LoadedFont | null> {
  try {
    // Fetch the .fnt file
    const fntUrl = `${FONT_BASE_URL}${fontName}.fnt`;
    const fntResponse = await fetch(fntUrl);
    if (!fntResponse.ok) {
      console.warn(`[fontLoader] Failed to fetch ${fntUrl}: ${fntResponse.status}`);
      return null;
    }
    const fntXmlContent = await fntResponse.text();

    // Determine number of texture pages from the .fnt file
    const pageCount = extractPageCount(fntXmlContent);

    // Fetch all texture pages in parallel
    const texturePromises: Promise<FontTexture | null>[] = [];
    for (let page = 0; page < pageCount; page++) {
      const textureUrl = `${FONT_BASE_URL}${fontName}.${page}.png`;
      const textureUid = textureUidBase + page;

      texturePromises.push(
        (async (): Promise<FontTexture | null> => {
          try {
            const response = await fetch(textureUrl);
            if (!response.ok) {
              console.warn(`[fontLoader] Failed to fetch ${textureUrl}: ${response.status}`);
              return null;
            }
            const blob = await response.blob();
            const { width, height, data } = await decodePngToRgba(blob);
            return {
              textureUid,
              width,
              height,
              rgbaData: data,
            };
          } catch (err) {
            console.warn(`[fontLoader] Error loading texture ${textureUrl}:`, err);
            return null;
          }
        })()
      );
    }

    const textureResults = await Promise.all(texturePromises);
    const textures = textureResults.filter((t): t is FontTexture => t !== null);

    // Get texture dimensions for UV calculation
    const textureWidths = textures.map((t) => t.width);
    const textureHeights = textures.map((t) => t.height);

    // Parse BMFont XML and convert to JSON format for Rust
    const fontJson = parseBMFontXML(fntXmlContent, fontName, textureUidBase, textureWidths, textureHeights);
    const fntContent = JSON.stringify(fontJson);

    return {
      fontName,
      fntContent,
      textures,
      textureUidBase,
    };
  } catch (err) {
    console.warn(`[fontLoader] Error loading font ${fontName}:`, err);
    return null;
  }
}

/**
 * Load all fonts. Call this at the same time as WASM init to parallelize loading.
 *
 * Returns a promise that resolves to all loaded font data, ready to be passed to Rust.
 */
export async function loadAllFonts(): Promise<FontLoadResult> {
  console.log('[fontLoader] Starting font loading...');
  const startTime = performance.now();

  // First, we need to fetch all .fnt files to determine page counts
  // Then we can assign texture UIDs and fetch textures
  // We'll do this sequentially for UID assignment, but textures load in parallel within each font

  const fonts: LoadedFont[] = [];
  let textureUidBase = 0;

  // Load fonts sequentially to maintain consistent texture UID assignment
  // (matches the Rust loading order for texture UID consistency)
  for (const fontName of FONT_NAMES) {
    const font = await loadFont(fontName, textureUidBase);
    if (font) {
      fonts.push(font);
      textureUidBase += font.textures.length;
      console.log(
        `[fontLoader] Loaded ${fontName}: ${font.textures.length} texture(s), UIDs ${font.textureUidBase}-${font.textureUidBase + font.textures.length - 1}`
      );
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(
    `[fontLoader] All fonts loaded in ${elapsed.toFixed(1)}ms (${fonts.length} fonts, ${textureUidBase} textures)`
  );

  return {
    fonts,
    totalTextures: textureUidBase,
  };
}

/**
 * Start loading all fonts immediately (returns a promise).
 * Use this to kick off font loading in parallel with WASM initialization.
 */
export function startFontLoading(): Promise<FontLoadResult> {
  return loadAllFonts();
}
