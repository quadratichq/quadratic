/**
 * Font loader for the Rust renderer.
 *
 * Loads BMFont files (.fnt) and texture atlases (.png) from the server.
 * Font loading happens in parallel with WASM initialization to minimize
 * startup time - while WASM is compiling/initializing, fonts are being fetched.
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
 * Loaded font data ready for passing to Rust
 */
export interface LoadedFont {
  /** Font name (e.g., "OpenSans", "OpenSans-Bold") */
  fontName: string;
  /** Raw .fnt file content (BMFont XML format) */
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
 * Parse the number of pages from a BMFont XML file.
 * We extract just the page count here; full parsing happens in Rust.
 */
function extractPageCount(fntContent: string): number {
  const match = fntContent.match(/<common[^>]*pages="(\d+)"/);
  return match ? parseInt(match[1], 10) : 1;
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
    const fntContent = await fntResponse.text();

    // Determine number of texture pages from the .fnt file
    const pageCount = extractPageCount(fntContent);

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
