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

  /**
   * Preload the emoji mapping JSON. Called by loadAssets.
   * The mapping is small; actual spritesheet pages are loaded on-demand.
   */
  async preload(): Promise<void> {
    try {
      const response = await fetch('/emojis/emoji-mapping.json');
      if (!response.ok) {
        throw new Error(`Failed to load emoji mapping: ${response.status}`);
      }
      this.mapping = await response.json();

      if (!this.mapping) {
        throw new Error('Emoji mapping is empty');
      }

      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(
          `[Emojis] Loaded mapping with ${this.mapping.pages.length} pages, ${Object.keys(this.mapping.emojis).length} emojis`
        );
      }
    } catch (error) {
      console.error('[Emojis] Failed to load emoji mapping:', error);
    }
  }

  /**
   * Load a specific spritesheet page on-demand.
   * Creates the BaseTexture immediately and triggers re-render when loaded.
   */
  private loadPage(pageIndex: number): BaseTexture | undefined {
    if (this.baseTextures.has(pageIndex)) {
      return this.baseTextures.get(pageIndex);
    }
    if (this.loadingPages.has(pageIndex)) {
      return undefined;
    }
    if (!this.mapping) return undefined;

    const page = this.mapping.pages[pageIndex];
    if (!page) return undefined;

    this.loadingPages.add(pageIndex);
    const texture = BaseTexture.from(`/emojis/${page.filename}`);
    this.baseTextures.set(pageIndex, texture);

    const onLoaded = () => {
      this.loadingPages.delete(pageIndex);
      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(`[Emojis] Loaded page ${pageIndex}: ${page.filename}`);
      }
      // Trigger re-render - textures will auto-fill from the now-loaded BaseTexture
      events.emit('setDirty', { viewport: true });
    };

    if (texture.valid) {
      onLoaded();
    } else {
      texture.once('loaded', onLoaded);
    }

    return texture;
  }

  /**
   * Get or create a texture for an emoji.
   * Returns undefined if the emoji is not in the spritesheet or mapping not loaded.
   * Pre-creates textures immediately; they auto-fill when the page loads.
   */
  getCharacter(emoji: string): Texture | undefined {
    // Check cache first
    const cached = this.emojiTextures.get(emoji);
    if (cached) {
      return cached;
    }

    // If mapping not loaded, can't look up emoji
    if (!this.mapping) {
      return undefined;
    }

    // Look up in mapping - try original first, then without variation selectors.
    // The render worker may send emojis with variation selectors (e.g., ❤️) but the
    // spritesheet stores them without (e.g., ❤), so we need to try both.
    let location = this.mapping.emojis[emoji];
    if (!location) {
      const stripped = stripVariationSelectors(emoji);
      if (stripped !== emoji) {
        location = this.mapping.emojis[stripped];
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
      // Start loading this page and get the BaseTexture
      baseTexture = this.loadPage(location.page);
      if (!baseTexture) {
        return undefined;
      }
    }

    // Create and cache the texture - it will auto-fill when BaseTexture loads
    const texture = new Texture(baseTexture, new Rectangle(location.x, location.y, location.width, location.height));
    this.emojiTextures.set(emoji, texture);
    return texture;
  }

  /**
   * Check if an emoji is available in the spritesheet.
   */
  hasEmoji(emoji: string): boolean {
    if (!this.mapping) return false;
    if (this.mapping.emojis[emoji] !== undefined) return true;
    const stripped = stripVariationSelectors(emoji);
    return stripped !== emoji && this.mapping.emojis[stripped] !== undefined;
  }
}

export const emojis = new Emojis();
