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

class Emojis {
  // Base textures for each spritesheet page
  private baseTextures: BaseTexture[] = [];

  // Cached textures for individual emojis (from spritesheets)
  private emojiTextures: Map<string, Texture> = new Map();

  // Track if emojis were requested before loading (to trigger re-render)
  private pendingEmojis = false;

  // Mapping from emoji string to location in spritesheet
  private mapping: EmojiMapping | null = null;

  // Loading state
  private loadingPromise: Promise<void> | null = null;
  private loaded = false;

  /**
   * Initialize by loading the mapping and spritesheet textures.
   * This is called lazily when emojis are first requested.
   */
  private async initialize(): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.load();
    await this.loadingPromise;
  }

  private async load(): Promise<void> {
    try {
      // Load the mapping JSON
      const response = await fetch('/emojis/emoji-mapping.json');
      if (!response.ok) {
        throw new Error(`Failed to load emoji mapping: ${response.status}`);
      }
      this.mapping = await response.json();

      if (!this.mapping) {
        throw new Error('Emoji mapping is empty');
      }

      // Load all spritesheet pages as base textures
      const loadPromises = this.mapping.pages.map(async (page, index) => {
        const texture = BaseTexture.from(`/emojis/${page.filename}`);
        this.baseTextures[index] = texture;
      });

      await Promise.all(loadPromises);

      this.loaded = true;

      if (debugFlags.getFlag('debugShowCellHashesInfo')) {
        console.log(
          `[Emojis] Loaded ${this.mapping.pages.length} spritesheet pages with ${Object.keys(this.mapping.emojis).length} emojis`
        );
      }

      // If emojis were requested before loading, trigger re-render
      if (this.pendingEmojis) {
        this.pendingEmojis = false;
        events.emit('emojiSpritesheetsLoaded');
      }
    } catch (error) {
      console.error('[Emojis] Failed to load emoji spritesheets:', error);
      this.loaded = true;
    }
  }

  /**
   * Get or create a texture for an emoji.
   * Returns Texture.EMPTY if spritesheets haven't loaded yet.
   * Returns undefined if the emoji is not in the spritesheet.
   */
  getCharacter(emoji: string): Texture | undefined {
    // Normalize emoji by stripping variation selectors for consistent lookup
    const normalizedEmoji = normalizeEmoji(emoji);

    // Start loading if not already started
    if (!this.loaded && !this.loadingPromise) {
      this.initialize();
    }

    // Check cache first (using normalized key)
    const cached = this.emojiTextures.get(normalizedEmoji);
    if (cached) {
      return cached;
    }

    // If still loading, return empty texture and mark that we need a re-render
    if (!this.loaded) {
      this.pendingEmojis = true;
      return Texture.EMPTY;
    }

    // Look up in mapping (using normalized key)
    const location = this.mapping?.emojis[normalizedEmoji];
    if (location && this.baseTextures[location.page]) {
      const texture = new Texture(
        this.baseTextures[location.page],
        new Rectangle(location.x, location.y, location.width, location.height)
      );
      this.emojiTextures.set(normalizedEmoji, texture);
      return texture;
    }

    // Emoji not in spritesheet
    if (debugFlags.getFlag('debugShowCellHashesInfo')) {
      console.log(`[Emojis] Emoji not in spritesheet: ${emoji} (normalized: ${normalizedEmoji})`);
    }
    return undefined;
  }

  /**
   * Preload emoji spritesheets. Call this early to avoid delays.
   */
  async preload(): Promise<void> {
    await this.initialize();
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
