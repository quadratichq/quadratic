import { v4 as uuid } from 'uuid';

import { BitmapFont, Container, Renderer, Texture } from 'pixi.js';
import { LabelMeshEntry } from './LabelMeshEntry';

// experimental value (recommended to be maximum of 100,000, with x6 for each label)
const MAX_VERTICES = 15000;

export class LabelMesh extends Container<LabelMeshEntry> {
  static textureCache = new Map<number, Texture>();

  id: string;
  texture: Texture;

  fontName: string;
  fontSize: number;
  hasColor: boolean;

  total = 1;

  private currentEntry = 0;

  constructor(charTexture: Texture, fontName: string, fontSize: number, color: boolean) {
    super();
    let texture = LabelMesh.textureCache.get(charTexture.baseTexture.uid);
    if (!texture) {
      texture = new Texture(charTexture.baseTexture);
      LabelMesh.textureCache.set(charTexture.baseTexture.uid, texture);
    }
    this.texture = texture;
    this.hasColor = color;

    this.id = uuid();
    this.fontName = fontName;
    this.fontSize = fontSize;
  }

  // if reuseBuffers is true, then the buffers are cleared for reuse; otherwise they are removed and recreated.
  prepare(reuseBuffers: boolean): void {
    if (reuseBuffers) {
      this.currentEntry = 0;
      this.children.forEach((entry) => entry.clear());
    } else {
      this.removeChildren();
      this.currentEntry = 0;
      while (this.total > 0) {
        const size = this.total > MAX_VERTICES ? MAX_VERTICES : this.total;
        this.addChild(new LabelMeshEntry(this, size));
        this.total -= size;
      }
    }
  }

  getBuffer(): LabelMeshEntry {
    if (this.children.length === 0) {
      throw new Error("Expected LabelMesh's children to be initialized");
    }
    const entry = this.children[this.currentEntry];
    if (entry.index + 1 > MAX_VERTICES) {
      this.currentEntry++;

      // this should never happen
      if (this.currentEntry >= this.children.length) {
        throw new Error('LabelMeshEntries out of bounds');
      }
    }
    return entry;
  }

  finalize(): void {
    this.children.forEach((entry) => entry.finalize());
  }

  specialRender(renderer: Renderer, scale: number): void {
    const { distanceFieldRange, size } = BitmapFont.available[this.fontName];
    const fontScale = this.fontSize / size;
    const ufWidth = distanceFieldRange * fontScale * scale;
    this.children.forEach((entry) => entry.specialRender(renderer, ufWidth));
  }
}
