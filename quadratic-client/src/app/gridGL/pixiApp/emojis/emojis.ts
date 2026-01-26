import { debugFlags } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { BaseTexture, Rectangle, Texture } from 'pixi.js';

// These constants are calculated based on the font metrics for Noto Color Emoji
// SCALE_EMOJI: height ratio (1200/1024 = 1.172, inverted for scaling: 16/14 / 1.172 ≈ 0.918)
export const SCALE_EMOJI = 0.918;
// EMOJI_ADVANCE_RATIO: advance width / height ratio (1275/1200 = 1.0625)
export const EMOJI_ADVANCE_RATIO = 1.0625;
// EMOJI_X_OFFSET_RATIO: horizontal offset as fraction of emoji size (moves emoji right)
export const EMOJI_X_OFFSET_RATIO = 0.03;
// EMOJI_Y_OFFSET_RATIO: vertical offset as fraction of lineHeight (moves emoji up when reduced)
export const EMOJI_Y_OFFSET_RATIO = 0.1;

// Normalize emoji by stripping variation selectors (U+FE0F, U+FE0E)
// This allows lookups like 🅰️ (with VS16) to find 🅰 (without) in the spritesheet
function normalizeEmoji(emoji: string): string {
  return emoji.replace(/[\uFE0E\uFE0F]/g, '');
}

interface EmojiLocation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EmojiMapping {
  pageSize: number;
  characterSize: number;
  scaleEmoji: number;
  pages: { filename: string; emojiCount: number }[];
  emojis: Record<string, EmojiLocation>;
}

type PageState = 'not_loaded' | 'loading' | 'loaded' | 'failed';

class Emojis {
  // Base textures for each spritesheet page (sparse array, loaded on demand)
  private baseTextures: (BaseTexture | undefined)[] = [];

  // Track loading state for each page
  private pageStates: PageState[] = [];

  // Cached textures for individual emojis (from spritesheets)
  private emojiTextures: Map<string, Texture> = new Map();

  // Track if emojis were requested while their page was loading
  private pendingEmojis = false;

  // Mapping from emoji string to location in spritesheet
  private mapping: EmojiMapping | null = null;

  // Loading state for the mapping JSON
  private mappingPromise: Promise<void> | null = null;
  private mappingLoaded = false;

  /**
   * Initialize by loading only the mapping JSON (not the spritesheet pages).
   * Pages are loaded on-demand when an emoji from that page is requested.
   */
  private async initializeMapping(): Promise<void> {
    if (this.mappingLoaded) return;
    if (this.mappingPromise) return this.mappingPromise;

    this.mappingPromise = this.loadMapping();
    await this.mappingPromise;
  }

  private async loadMapping(): Promise<void> {
    try {
      const response = await fetch('/emojis/emoji-mapping.json');
      if (!response.ok) {
        throw new Error(`Failed to load emoji mapping: ${response.status}`);
      }
      this.mapping = await response.json();

      if (!this.mapping) {
        throw new Error('Emoji mapping is empty');
      }

      // Initialize page states array
      this.pageStates = new Array(this.mapping.pages.length).fill('not_loaded');

      this.mappingLoaded = true;

      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(
          `[Emojis] Loaded mapping with ${this.mapping.pages.length} pages and ${Object.keys(this.mapping.emojis).length} emojis`
        );
      }

      // If emojis were requested before mapping loaded, trigger re-render
      if (this.pendingEmojis) {
        this.pendingEmojis = false;
        events.emit('emojiSpritesheetsLoaded');
      }
    } catch (error) {
      console.error('[Emojis] Failed to load emoji mapping:', error);
      this.mappingLoaded = true;
    }
  }

  /**
   * Load a specific page on demand.
   */
  private async loadPage(pageIndex: number): Promise<void> {
    if (!this.mapping || pageIndex < 0 || pageIndex >= this.mapping.pages.length) {
      return;
    }

    const state = this.pageStates[pageIndex];
    if (state === 'loaded' || state === 'loading' || state === 'failed') {
      return;
    }

    this.pageStates[pageIndex] = 'loading';

    try {
      const page = this.mapping.pages[pageIndex];
      const texture = BaseTexture.from(`/emojis/${page.filename}`);

      // Wait for the texture to actually load
      await new Promise<void>((resolve, reject) => {
        if (texture.valid) {
          resolve();
        } else {
          texture.once('loaded', () => resolve());
          texture.once('error', () => reject(new Error(`Failed to load emoji page ${pageIndex}`)));
        }
      });

      this.baseTextures[pageIndex] = texture;
      this.pageStates[pageIndex] = 'loaded';

      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(`[Emojis] Loaded page ${pageIndex}: ${page.filename}`);
      }

      // Trigger re-render for emojis that were waiting for this page
      if (this.pendingEmojis) {
        this.pendingEmojis = false;
        events.emit('emojiSpritesheetsLoaded');
      }
    } catch (error) {
      console.error(`[Emojis] Failed to load page ${pageIndex}:`, error);
      this.pageStates[pageIndex] = 'failed';
    }
  }

  /**
   * Get or create a texture for an emoji.
   * Returns Texture.EMPTY if the page hasn't loaded yet.
   * Returns undefined if the emoji is not in the spritesheet.
   */
  getCharacter(emoji: string): Texture | undefined {
    const normalizedEmoji = normalizeEmoji(emoji);

    // Start loading mapping if not already started
    if (!this.mappingLoaded && !this.mappingPromise) {
      this.initializeMapping();
    }

    // Check cache first
    const cached = this.emojiTextures.get(normalizedEmoji);
    if (cached) {
      return cached;
    }

    // If mapping still loading, return empty texture
    if (!this.mappingLoaded) {
      this.pendingEmojis = true;
      return Texture.EMPTY;
    }

    // Look up emoji location
    const location = this.mapping?.emojis[normalizedEmoji];
    if (!location) {
      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(`[Emojis] Emoji not in spritesheet: ${emoji} (normalized: ${normalizedEmoji})`);
      }
      return undefined;
    }

    // Check if page is loaded
    const pageState = this.pageStates[location.page];
    if (pageState === 'not_loaded') {
      // Start loading the page on demand
      this.loadPage(location.page);
      this.pendingEmojis = true;
      return Texture.EMPTY;
    }

    if (pageState === 'loading') {
      this.pendingEmojis = true;
      return Texture.EMPTY;
    }

    if (pageState === 'failed') {
      return undefined;
    }

    // Page is loaded, create texture
    const baseTexture = this.baseTextures[location.page];
    if (baseTexture) {
      const texture = new Texture(baseTexture, new Rectangle(location.x, location.y, location.width, location.height));
      this.emojiTextures.set(normalizedEmoji, texture);
      return texture;
    }

    return undefined;
  }

  /**
   * Preload emoji mapping. Call this early to avoid delays.
   * Note: This only loads the mapping, not the spritesheet pages.
   */
  async preload(): Promise<void> {
    await this.initializeMapping();
  }

  /**
   * Check if an emoji is available in the spritesheet.
   */
  hasEmoji(emoji: string): boolean {
    return this.mapping?.emojis[emoji] !== undefined;
  }

  /**
   * Debug: visualize the loaded spritesheets
   */
  test(): void {
    const GAP = 10;
    for (let index = 0; index < this.baseTextures.length; index++) {
      const baseTexture = this.baseTextures[index];
      if (!baseTexture) continue;
      const resource = baseTexture.resource as any;
      const source = resource?.source as HTMLImageElement | HTMLCanvasElement;
      if (source && source instanceof HTMLImageElement) {
        const img = source.cloneNode() as HTMLImageElement;
        img.style.position = 'absolute';
        img.style.top = `${index * GAP}px`;
        img.style.left = `${index * GAP}px`;
        img.style.border = '1px solid red';
        img.style.background = 'white';
        img.style.maxWidth = '512px';
        document.body.appendChild(img);
      }
    }
  }
}

export const emojis = new Emojis();
