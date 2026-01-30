import { debugFlags } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { BaseTexture, Rectangle, Texture } from 'pixi.js';

export { EMOJI_ADVANCE_RATIO, EMOJI_X_OFFSET_RATIO, EMOJI_Y_OFFSET_RATIO, SCALE_EMOJI } from './emojiConstants';

// Strip variation selectors (U+FE0F, U+FE0E) from emoji
function stripVariationSelectors(emoji: string): string {
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

class Emojis {
  // Base textures for each spritesheet page (loaded on-demand)
  private baseTextures: Map<number, BaseTexture> = new Map();

  // Track which pages are currently loading
  private loadingPages: Set<number> = new Set();

  // Cached textures for individual emojis (from spritesheets)
  private emojiTextures: Map<string, Texture> = new Map();

  // Mapping from emoji string to location in spritesheet
  private mapping: EmojiMapping | null = null;

  // Loading state for the mapping JSON
  private mappingPromise: Promise<void> | null = null;
  private mappingLoaded = false;

  /**
   * Load the emoji mapping JSON. This is called lazily when emojis are first requested.
   * The mapping is small; actual spritesheet pages are loaded on-demand.
   */
  private async loadMapping(): Promise<void> {
    if (this.mappingLoaded) return;
    if (this.mappingPromise) return this.mappingPromise;

    this.mappingPromise = this.fetchMapping();
    await this.mappingPromise;
  }

  private async fetchMapping(): Promise<void> {
    try {
      const response = await fetch('/emojis/emoji-mapping.json');
      if (!response.ok) {
        throw new Error(`Failed to load emoji mapping: ${response.status}`);
      }
      this.mapping = await response.json();

      if (!this.mapping) {
        throw new Error('Emoji mapping is empty');
      }

      this.mappingLoaded = true;

      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(
          `[Emojis] Loaded mapping with ${this.mapping.pages.length} pages, ${Object.keys(this.mapping.emojis).length} emojis`
        );
      }

      // Trigger re-render now that mapping is available
      events.emit('setDirty', { viewport: true });
    } catch (error) {
      console.error('[Emojis] Failed to load emoji mapping:', error);
      this.mappingLoaded = true;
    }
  }

  /**
   * Load a specific spritesheet page on-demand.
   */
  private loadPage(pageIndex: number): void {
    if (this.baseTextures.has(pageIndex) || this.loadingPages.has(pageIndex)) {
      return;
    }
    if (!this.mapping) return;

    const page = this.mapping.pages[pageIndex];
    if (!page) return;

    this.loadingPages.add(pageIndex);
    const texture = BaseTexture.from(`/emojis/${page.filename}`);
    this.baseTextures.set(pageIndex, texture);

    const onLoaded = () => {
      this.loadingPages.delete(pageIndex);
      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(`[Emojis] Loaded page ${pageIndex}: ${page.filename}`);
      }
      events.emit('setDirty', { viewport: true });
    };

    if (texture.valid) {
      onLoaded();
    } else {
      texture.once('loaded', onLoaded);
    }
  }

  /**
   * Get or create a texture for an emoji.
   * Returns Texture.EMPTY if the mapping hasn't loaded yet.
   * Returns undefined if the emoji is not in the spritesheet.
   * If the page is still loading, returns a Texture that will auto-fill when ready.
   */
  getCharacter(emoji: string): Texture | undefined {
    // Start loading mapping if not already started
    if (!this.mappingLoaded && !this.mappingPromise) {
      this.loadMapping();
    }

    // Check cache first
    const cached = this.emojiTextures.get(emoji);
    if (cached) {
      return cached;
    }

    // If mapping still loading, return empty texture
    if (!this.mappingLoaded) {
      return Texture.EMPTY;
    }

    // Look up in mapping - try original first, then without variation selectors.
    // The render worker may send emojis with variation selectors (e.g., ❤️) but the
    // spritesheet stores them without (e.g., ❤), so we need to try both.
    let location = this.mapping?.emojis[emoji];
    if (!location) {
      const stripped = stripVariationSelectors(emoji);
      if (stripped !== emoji) {
        location = this.mapping?.emojis[stripped];
      }
    }
    if (!location) {
      // Emoji not in spritesheet
      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(`[Emojis] Not in spritesheet: ${emoji}`);
      }
      return undefined;
    }

    // Get or create the base texture for this page
    let baseTexture = this.baseTextures.get(location.page);
    if (!baseTexture) {
      // Start loading this page
      this.loadPage(location.page);
      baseTexture = this.baseTextures.get(location.page);
      if (!baseTexture) {
        return Texture.EMPTY;
      }
    }

    // Create and cache the texture - it will auto-fill when BaseTexture loads
    const texture = new Texture(baseTexture, new Rectangle(location.x, location.y, location.width, location.height));
    this.emojiTextures.set(emoji, texture);
    return texture;
  }

  /**
   * Preload the emoji mapping. Call this early to avoid delays.
   * Spritesheet pages are loaded on-demand when specific emojis are requested.
   */
  async preload(): Promise<void> {
    await this.loadMapping();
  }

  /**
   * Check if an emoji is available in the spritesheet.
   */
  hasEmoji(emoji: string): boolean {
    if (this.mapping?.emojis[emoji] !== undefined) return true;
    const stripped = stripVariationSelectors(emoji);
    return stripped !== emoji && this.mapping?.emojis[stripped] !== undefined;
  }
}

export const emojis = new Emojis();
