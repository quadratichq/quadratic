import { debugFlags } from '@/app/debugFlags/debugFlags';
import { BaseTexture, Rectangle, Texture } from 'pixi.js';

// These constants match the spritesheet generator (scripts/emojis.js)
const PAGE_SIZE = 1024;
const CHARACTER_SIZE = 125;

// this scales the emoji to ensure it fits in the cell
export const SCALE_EMOJI = 0.81;

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

  // Cached textures for individual emojis
  private emojiTextures: Map<string, Texture> = new Map();

  // Mapping from emoji string to location in spritesheet
  private mapping: EmojiMapping | null = null;

  // Loading state
  private loadingPromise: Promise<void> | null = null;
  private loaded = false;

  // Fallback for emojis not in the spritesheet (JIT rendering)
  private fallbackCanvas: HTMLCanvasElement | null = null;
  private fallbackBaseTexture: BaseTexture | null = null;
  private fallbackLocation = { x: 0, y: 0 };

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
    } catch (error) {
      console.error('[Emojis] Failed to load emoji spritesheets:', error);
      // Continue without spritesheets - will use fallback JIT rendering
      this.loaded = true;
    }
  }

  /**
   * Get or create a texture for an emoji.
   * Returns undefined if the emoji is not available.
   */
  getCharacter(emoji: string): Texture | undefined {
    // Start loading if not already started
    if (!this.loaded && !this.loadingPromise) {
      this.initialize();
    }

    // Check cache first
    let texture = this.emojiTextures.get(emoji);
    if (texture) {
      return texture;
    }

    // If still loading, use fallback
    if (!this.loaded) {
      return this.getFallbackTexture(emoji);
    }

    // Look up in mapping
    const location = this.mapping?.emojis[emoji];
    if (location && this.baseTextures[location.page]) {
      texture = new Texture(
        this.baseTextures[location.page],
        new Rectangle(location.x, location.y, location.width, location.height)
      );
      this.emojiTextures.set(emoji, texture);
      return texture;
    }

    // Emoji not in spritesheet - use fallback JIT rendering
    return this.getFallbackTexture(emoji);
  }

  /**
   * Fallback JIT rendering for emojis not in the spritesheet.
   * This handles edge cases like new emojis or uncommon sequences.
   */
  private getFallbackTexture(emoji: string): Texture | undefined {
    // Check if already rendered as fallback
    const cached = this.emojiTextures.get(emoji);
    if (cached) return cached;

    // Create fallback canvas if needed
    if (!this.fallbackCanvas) {
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.width = PAGE_SIZE;
      this.fallbackCanvas.height = PAGE_SIZE;
      this.fallbackBaseTexture = BaseTexture.from(this.fallbackCanvas);
    }

    const context = this.fallbackCanvas.getContext('2d');
    if (!context || !this.fallbackBaseTexture) return undefined;

    const { x, y } = this.fallbackLocation;

    // Set up font and draw emoji
    const fontSize = CHARACTER_SIZE * SCALE_EMOJI;
    context.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.clearRect(x, y, CHARACTER_SIZE, CHARACTER_SIZE);
    context.fillText(emoji, x + CHARACTER_SIZE / 2, y + CHARACTER_SIZE / 2);

    this.fallbackBaseTexture.update();

    // Create texture
    const texture = new Texture(this.fallbackBaseTexture, new Rectangle(x, y, CHARACTER_SIZE, CHARACTER_SIZE));
    this.emojiTextures.set(emoji, texture);

    // Advance fallback location
    let nextX = x + CHARACTER_SIZE;
    let nextY = y;
    if (nextX + CHARACTER_SIZE > PAGE_SIZE) {
      nextX = 0;
      nextY += CHARACTER_SIZE;
      if (nextY + CHARACTER_SIZE > PAGE_SIZE) {
        // Fallback canvas is full - create a new one
        // For now, just wrap around (unlikely to hit this limit)
        nextX = 0;
        nextY = 0;
      }
    }
    this.fallbackLocation = { x: nextX, y: nextY };

    if (debugFlags.getFlag('debugShowCellHashesInfo')) {
      console.log(`[Emojis] Fallback rendered: ${emoji}`);
    }

    return texture;
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
