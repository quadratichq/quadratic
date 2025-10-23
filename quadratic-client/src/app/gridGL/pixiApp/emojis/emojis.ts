import { BaseTexture } from 'pixi.js';

const PAGE_SIZE = 1024;
const CHARACTER_SIZE = 100;
const FONT_NAME = 'NotoColorEmoji';
const FONT_FILE = '/fonts/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf';

// This holds the location to place the next requested emoji
interface CurrentLocation {
  baseTexture: number;
  x: number;
  y: number;
}

class Emojis {
  private initialized = false;

  private activeEmojis = new Set<number>();

  private baseTextures: BaseTexture[] = [];
  private currentLocation: CurrentLocation = { baseTexture: -1, x: 0, y: 0 };
  private characterToLocation = new Map<number, { baseTexture: number; x: number; y: number }>();

  private async initialize() {
    if (this.initialized) return;
    const font = new FontFace(FONT_NAME, `url(${FONT_FILE})`);
    await font.load();
    document.fonts.add(font);

    this.newBaseTexture();

    setTimeout(() => {}, 3000);
  }

  private newBaseTexture() {
    const page = document.createElement('canvas');
    page.width = PAGE_SIZE;
    page.height = PAGE_SIZE;

    // Create the BaseTexture from the canvas
    const baseTexture = BaseTexture.from(page);
    this.currentLocation = { baseTexture: this.currentLocation.baseTexture + 1, x: 0, y: 0 };
    this.baseTextures.push(baseTexture);
    this.initialized = true;

    setTimeout(() => {
      console.log(this.baseTextures[this.currentLocation.baseTexture].resource);
      document.body.appendChild((this.baseTextures[this.currentLocation.baseTexture].resource as any).source);
    }, 2000);
  }

  async ensureCharacter(character: number) {
    await this.initialize();

    if (this.activeEmojis.has(character)) {
      return;
    }

    // The canvas for a PixiJS Texture created from a <canvas> element can be accessed via .baseTexture.resource.source
    const resource = this.baseTextures[this.currentLocation.baseTexture].resource as any;
    const canvas = resource.source as HTMLCanvasElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) throw new Error('Expected canvas and context in ensureCharacter');

    // Set up font and alignment for drawing emoji
    context.font = `${CHARACTER_SIZE}px ${FONT_NAME}`;
    context.textAlign = 'left';
    context.textBaseline = 'top';

    // Calculate position to draw in current cell
    const { x, y } = this.currentLocation;

    // Draw the emoji character
    const emoji = String.fromCodePoint(character);
    context.clearRect(x, y, CHARACTER_SIZE, CHARACTER_SIZE);
    context.fillText(emoji, x, y, CHARACTER_SIZE);
  }

  getCharacter(character: number) {
    if (!this.initialized) throw new Error('Expected emojis to be initialized');

    if (this.activeEmojis.has(character)) {
      return this.baseTextures[this.characterToLocation.get(character)?.baseTexture ?? -1];
    }

    return null;
  }
}

export const emojis = new Emojis();
