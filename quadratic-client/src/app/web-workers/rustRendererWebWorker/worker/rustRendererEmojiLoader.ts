/**
 * Emoji spritesheet loader for the Rust renderer.
 *
 * Loads the emoji mapping JSON once at startup.
 * Texture pages are loaded lazily by the Rust renderer when needed.
 */

// Emoji configuration
const EMOJI_BASE_URL = '/emojis/';
const EMOJI_MAPPING_FILE = 'emoji-mapping.json';

/**
 * Result of loading emoji mapping (textures are loaded lazily)
 */
export interface EmojiMappingResult {
  /** The emoji mapping JSON string (passed directly to Rust) */
  mappingJson: string;
}

/**
 * Load the emoji mapping JSON.
 * Returns the JSON string to pass to Rust's load_emoji_mapping().
 * Textures are loaded lazily when needed.
 */
export async function loadEmojiMapping(): Promise<EmojiMappingResult | null> {
  console.log('[emojiLoader] Loading emoji mapping...');
  const startTime = performance.now();

  try {
    const mappingUrl = `${EMOJI_BASE_URL}${EMOJI_MAPPING_FILE}`;
    const response = await fetch(mappingUrl);
    if (!response.ok) {
      console.warn(`[emojiLoader] Failed to fetch ${mappingUrl}: ${response.status}`);
      return null;
    }
    const mappingJson = await response.text();

    const elapsed = performance.now() - startTime;
    console.log(`[emojiLoader] Loaded emoji mapping in ${elapsed.toFixed(1)}ms`);

    return { mappingJson };
  } catch (err) {
    console.warn('[emojiLoader] Error loading emoji mapping:', err);
    return null;
  }
}

/**
 * Decode a PNG blob to RGBA pixel data using OffscreenCanvas.
 */
export async function decodePngToRgba(pngBlob: Blob): Promise<{ width: number; height: number; data: Uint8Array }> {
  const imageBitmap = await createImageBitmap(pngBlob);
  const { width, height } = imageBitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for emoji texture decoding');
  }

  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  imageBitmap.close();

  return {
    width,
    height,
    data: new Uint8Array(imageData.data.buffer),
  };
}

/**
 * Fetch and decode a single emoji page.
 * @param pageUrl - Full URL to the PNG file
 * @returns Decoded RGBA data or null on failure
 */
export async function fetchEmojiPage(
  pageUrl: string
): Promise<{ width: number; height: number; data: Uint8Array } | null> {
  try {
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.warn(`[emojiLoader] Failed to fetch ${pageUrl}: ${response.status}`);
      return null;
    }
    const blob = await response.blob();
    return await decodePngToRgba(blob);
  } catch (err) {
    console.warn(`[emojiLoader] Error loading ${pageUrl}:`, err);
    return null;
  }
}

/**
 * Start loading the emoji mapping immediately (returns a promise).
 * Use this to kick off emoji mapping load in parallel with WASM/font initialization.
 */
export function startEmojiLoading(): Promise<EmojiMappingResult | null> {
  return loadEmojiMapping();
}
