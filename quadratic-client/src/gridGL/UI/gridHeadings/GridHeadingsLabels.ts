// Draws Grid Heading Labels using as few meshes as possible.

import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { BitmapFont, Container, Loader, Texture } from 'pixi.js';
import { GRID_HEADER_FONT_SIZE } from './GridHeadings';
import { GridHeadingsLabel } from './GridHeadingsLabel';

const FONT_NAME = 'OpenSans';
const CHARACTERS = '0123456789';

export class GridHeadingsLabels extends Container<GridHeadingsLabel> {
  private gridHeadingsLabels: Map<string, GridHeadingsLabel> = new Map();

  constructor() {
    super();
    const resource = Loader.shared.resources[FONT_NAME];
    const bitmapFont = resource?.bitmapFont;
    if (!bitmapFont) throw new Error(`Texture not found for font: ${FONT_NAME}`);

    for (const char of CHARACTERS) {
      const charData = bitmapFont.chars[char.charCodeAt(0)];
      const baseTexture = charData.texture.baseTexture;
      if (!baseTexture) throw new Error(`Texture not found for font: ${FONT_NAME} with uid: ${char}`);
      const pageTexture = this.children.find((label) => label.texture.baseTexture.uid === baseTexture.uid);
      if (pageTexture) {
        this.gridHeadingsLabels.set(char, pageTexture);
      } else {
        const pageTexture = this.addChild(new GridHeadingsLabel(bitmapFont, new Texture(baseTexture)));
        this.gridHeadingsLabels.set(char, pageTexture);
      }
    }
  }

  clear() {
    this.gridHeadingsLabels.forEach((label) => label.clear());
  }

  add(text: string, x: number, y: number): void {
    let xPos = x;
    let yPos = y;
    for (const char of text) {
      const label = this.gridHeadingsLabels.get(char);
      if (!label) throw new Error(`Label not found for character: ${char} in GridHeadingsLabel`);
      if (label) {
        xPos += label.add(char, xPos, yPos);
      }
    }
  }

  update() {
    const { distanceFieldRange, size } = BitmapFont.available[FONT_NAME];
    const fontScale = GRID_HEADER_FONT_SIZE / size;
    const ufWidth = distanceFieldRange * fontScale * pixiApp.viewport.scale.x;
    this.children.forEach((label) => label.finalize(ufWidth));
  }
}
