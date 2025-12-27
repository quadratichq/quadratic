/**
 * Font Manager
 *
 * Manages loading and registering multiple bitmap fonts with the Rust renderer.
 * Handles global texture ID assignment to avoid conflicts between different fonts.
 *
 * Texture ID Scheme:
 * - Each font is assigned a unique font index (0, 1, 2, ...)
 * - Global texture ID = fontIndex * MAX_TEXTURES_PER_FONT + localPageId
 * - This ensures texture IDs never collide between fonts
 */

import { CharData, FontData, loadFontTextures, parseBMFont } from './font-loader';

/** Maximum texture pages per font (BMFont typically uses 1-10 pages) */
const MAX_TEXTURES_PER_FONT = 16;

/** Font style variants matching Rust's BitmapFonts::get_font_name() */
export type FontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic';

/** Font variant configuration */
export interface FontVariant {
  style: FontStyle;
  fntPath: string;
}

/** Loaded font with remapped texture IDs */
interface LoadedFont {
  fontIndex: number;
  fontData: FontData;
  textures: HTMLImageElement[];
  globalTextureIds: number[];
}

/** Message sender interface for communicating with the worker */
export interface FontManagerMessageSender {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

/**
 * FontManager handles loading multiple fonts and ensuring their textures
 * use globally unique IDs when passed to the Rust renderer.
 */
export class FontManager {
  private loadedFonts: Map<string, LoadedFont> = new Map();
  private nextFontIndex = 0;
  private messageSender: FontManagerMessageSender | null = null;
  private basePath: string;

  constructor(basePath = './fonts') {
    this.basePath = basePath;
  }

  /**
   * Set the message sender (worker) for communicating with the renderer
   */
  setMessageSender(sender: FontManagerMessageSender): void {
    this.messageSender = sender;
  }

  /**
   * Get the expected Rust font name for a given style.
   * Must match Rust's BitmapFonts::get_font_name()
   */
  static getFontName(style: FontStyle): string {
    switch (style) {
      case 'regular':
        return 'OpenSans';
      case 'bold':
        return 'OpenSans-Bold';
      case 'italic':
        return 'OpenSans-Italic';
      case 'boldItalic':
        return 'OpenSans-BoldItalic';
    }
  }

  /**
   * Calculate global texture ID from font index and local page ID
   */
  private getGlobalTextureId(fontIndex: number, localPageId: number): number {
    return fontIndex * MAX_TEXTURES_PER_FONT + localPageId;
  }

  /**
   * Remap a font's local texture IDs to global IDs
   */
  private remapTextureIds(fontData: FontData, fontIndex: number): FontData {
    const remappedChars: Record<number, CharData> = {};

    for (const [charCode, charData] of Object.entries(fontData.chars)) {
      remappedChars[Number(charCode)] = {
        ...charData,
        texture_uid: this.getGlobalTextureId(fontIndex, charData.texture_uid),
      };
    }

    return {
      ...fontData,
      chars: remappedChars,
    };
  }

  /**
   * Load a single font variant
   *
   * @param fntPath Path to the .fnt file (relative to basePath or absolute)
   * @param style The font style (used for naming if font name not in file)
   * @returns The font name as registered with the renderer
   */
  async loadFont(fntPath: string, style: FontStyle = 'regular'): Promise<string> {
    // Parse the font file
    const rawFontData = await parseBMFont(fntPath);

    // Use expected name format for Rust compatibility
    const fontName = FontManager.getFontName(style);

    // Check if already loaded
    if (this.loadedFonts.has(fontName)) {
      console.warn(`Font "${fontName}" already loaded, skipping`);
      return fontName;
    }

    // Assign font index and remap texture IDs
    const fontIndex = this.nextFontIndex++;
    const remappedFontData = this.remapTextureIds(rawFontData, fontIndex);

    // Override font name to match Rust expectations
    remappedFontData.font = fontName;

    // Load texture images
    const basePath = fntPath.substring(0, fntPath.lastIndexOf('/'));
    const textures = await loadFontTextures(rawFontData, basePath || this.basePath);

    // Calculate global texture IDs for each page
    const globalTextureIds: number[] = [];
    for (let i = 0; i < rawFontData.pages.length; i++) {
      globalTextureIds[i] = this.getGlobalTextureId(fontIndex, i);
    }

    // Store loaded font
    this.loadedFonts.set(fontName, {
      fontIndex,
      fontData: remappedFontData,
      textures,
      globalTextureIds,
    });

    console.log(
      `Loaded font "${fontName}" (index ${fontIndex}) with ${textures.length} textures, ` +
        `global IDs: [${globalTextureIds.join(', ')}]`
    );

    return fontName;
  }

  /**
   * Load all standard font variants (regular, bold, italic, boldItalic)
   *
   * @param variants Array of font variants to load
   */
  async loadFonts(variants: FontVariant[]): Promise<void> {
    for (const variant of variants) {
      await this.loadFont(variant.fntPath, variant.style);
    }
  }

  /**
   * Register all loaded fonts with the Rust renderer.
   * Call this after loadFont/loadFonts and before using the fonts.
   */
  async registerWithRenderer(): Promise<void> {
    if (!this.messageSender) {
      throw new Error('Message sender not set. Call setMessageSender() first.');
    }

    for (const [fontName, loadedFont] of this.loadedFonts) {
      // Send font metadata to Rust (with remapped texture IDs)
      this.messageSender.postMessage({
        type: 'addFont',
        fontJson: JSON.stringify(loadedFont.fontData),
        fontName,
      });

      // Upload each texture with its global ID
      for (let i = 0; i < loadedFont.textures.length; i++) {
        const img = loadedFont.textures[i];
        if (!img) continue;

        const globalId = loadedFont.globalTextureIds[i];
        const bitmap = await createImageBitmap(img);

        this.messageSender.postMessage(
          {
            type: 'uploadFontTexture',
            textureUid: globalId,
            bitmap,
          },
          [bitmap]
        );
      }

      console.log(`Registered font "${fontName}" with renderer`);
    }
  }

  /**
   * Convenience method to load fonts and register them in one call
   */
  async loadAndRegister(variants: FontVariant[]): Promise<void> {
    await this.loadFonts(variants);
    await this.registerWithRenderer();
  }

  /**
   * Check if a font is loaded
   */
  isLoaded(style: FontStyle): boolean {
    return this.loadedFonts.has(FontManager.getFontName(style));
  }

  /**
   * Get all loaded font names
   */
  getLoadedFontNames(): string[] {
    return Array.from(this.loadedFonts.keys());
  }

  /**
   * Get the number of loaded fonts
   */
  get fontCount(): number {
    return this.loadedFonts.size;
  }

  /**
   * Get total number of textures across all fonts
   */
  get textureCount(): number {
    let count = 0;
    for (const font of this.loadedFonts.values()) {
      count += font.textures.filter((t) => t != null).length;
    }
    return count;
  }
}

/**
 * Create a font manager pre-configured with standard OpenSans variants
 */
export function createStandardFontManager(basePath = './fonts'): FontManager {
  return new FontManager(basePath);
}

/**
 * Standard font variants for OpenSans
 */
export const STANDARD_FONT_VARIANTS: FontVariant[] = [
  { style: 'regular', fntPath: './fonts/OpenSans.fnt' },
  { style: 'bold', fntPath: './fonts/OpenSans-Bold.fnt' },
  { style: 'italic', fntPath: './fonts/OpenSans-Italic.fnt' },
  { style: 'boldItalic', fntPath: './fonts/OpenSans-BoldItalic.fnt' },
];
