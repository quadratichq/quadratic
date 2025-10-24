import { emojiCodePoints } from '@/app/gridGL/pixiApp/emojis/emojiMap';
import { BaseTexture, Rectangle, Texture } from 'pixi.js';

const PAGE_SIZE = 1024;
const CHARACTER_SIZE = 125;
const FONT_NAME = 'OpenSans';

// this scales the emoji to ensure it fits in the cell
export const SCALE_EMOJI = 0.81;

// This holds the location to place the next requested emoji
interface CurrentLocation {
  baseTexture: number;
  x: number;
  y: number;
}

class Emojis {
  // we keep pages of base textures using the PAGE_SIZE x PAGE_SIZE canvas(es)
  private baseTextures: BaseTexture[] = [];

  // this holds individual character textures
  private emojiTextures: Map<number, Texture> = new Map();

  // this tracks the current location in the base textures
  private currentLocation: CurrentLocation = { baseTexture: -1, x: 0, y: 0 };

  // this needs to be called the first time to ensure the emoji font is loaded
  // (this is called before every ensureCharacter because we don't want to load
  // the emoji font unless the user has emojis in their document)
  private initialize() {
    if (this.baseTextures.length > 0) return;
    this.newBaseTexture();
  }

  private newBaseTexture(): number {
    const page = document.createElement('canvas');
    page.width = PAGE_SIZE;
    page.height = PAGE_SIZE;

    // Create the BaseTexture from the canvas
    const baseTexture = BaseTexture.from(page);
    this.currentLocation = { baseTexture: this.currentLocation.baseTexture + 1, x: 0, y: 0 };
    this.baseTextures.push(baseTexture);
    return this.baseTextures.length - 1;
  }

  ensureCharacter(character: number): Texture | undefined {
    this.initialize();

    let texture = this.emojiTextures.get(character);
    if (texture) {
      return texture;
    }

    // The canvas for a PixiJS Texture created from a <canvas> element can be accessed via .baseTexture.resource.source
    const { x, y, baseTexture } = this.currentLocation;
    const resource = this.baseTextures[baseTexture].resource as any;
    const canvas = resource.source as HTMLCanvasElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) throw new Error('Expected canvas and context in ensureCharacter');

    // Set up font and alignment for drawing emoji
    // Use slightly smaller font size to prevent clipping
    const fontSize = CHARACTER_SIZE * SCALE_EMOJI;
    context.font = `${fontSize}px ${FONT_NAME}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw the emoji character centered in the cell
    const emoji = String.fromCodePoint(character);
    context.clearRect(x, y, CHARACTER_SIZE, CHARACTER_SIZE);
    context.fillText(emoji, x + CHARACTER_SIZE / 2, y + CHARACTER_SIZE / 2);

    this.baseTextures[baseTexture].update();

    // Create a new Texture from the baseTexture at the specific location
    texture = new Texture(this.baseTextures[baseTexture], new Rectangle(x, y, CHARACTER_SIZE, CHARACTER_SIZE));
    this.emojiTextures.set(character, texture);

    let newBaseTexture = baseTexture;
    let nextX = x + CHARACTER_SIZE;
    let nextY = y;
    if (nextX + CHARACTER_SIZE > PAGE_SIZE) {
      nextX = 0;
      nextY += CHARACTER_SIZE;
      if (nextY + CHARACTER_SIZE > PAGE_SIZE) {
        newBaseTexture = this.newBaseTexture();
        nextX = 0;
        nextY = 0;
      }
    }
    this.currentLocation = { baseTexture: newBaseTexture, x: nextX, y: nextY };
    return texture;
  }

  getCharacter(character: number): Texture | undefined {
    this.initialize();
    return this.ensureCharacter(character);
  }

  // call this to see the base textures in the browser
  test() {
    this.initialize();

    for (const character of emojiCodePoints) {
      this.ensureCharacter(character);
    }
    const GAP = 10;
    for (let index = 0; index < this.baseTextures.length; index++) {
      const baseTexture = this.baseTextures[index];
      const canvas = (baseTexture.resource as any).source as HTMLCanvasElement;
      canvas.style.position = 'absolute';
      canvas.style.top = `${index * GAP}px`;
      canvas.style.left = `${index * GAP}px`;
      canvas.style.border = '1px solid red';
      canvas.style.background = 'white';
      document.body.appendChild(canvas);
    }
  }
}

export const emojis = new Emojis();
