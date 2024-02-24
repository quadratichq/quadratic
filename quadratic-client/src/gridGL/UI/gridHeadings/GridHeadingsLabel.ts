import {
  BLEND_MODES,
  BitmapFont,
  IBitmapFontCharacter,
  Mesh,
  MeshGeometry,
  MeshMaterial,
  Program,
  Texture,
} from 'pixi.js';
import { GRID_HEADER_FONT_SIZE } from './GridHeadings';
import * as shader from './gridHeadingsShader';

interface Character {
  character: string;
  x: number;
  y: number;
  entry: IBitmapFontCharacter;
}

export class GridHeadingsLabel extends Mesh {
  private bitmapFont: BitmapFont;
  private characters: Character[];

  constructor(bitmapFont: BitmapFont, texture: Texture) {
    const geometry = new MeshGeometry();
    const material = new MeshMaterial(texture, {
      program: Program.from(shader.msdfVert, shader.msdfFrag),
      uniforms: { uFWidth: 0 },
    });
    super(geometry, material);
    this.blendMode = BLEND_MODES.NORMAL_NPM;
    this.bitmapFont = bitmapFont;
    this.characters = [];
  }

  clear() {
    this.characters = [];
  }

  add(character: string, x: number, y: number): number {
    const entry = this.bitmapFont.chars[character];
    this.characters.push({ character, x, y, entry });
    if (!entry) throw new Error(`Character not found in bitmapFont: ${character}`);
    return entry.xAdvance;
  }

  finalize(ufWidth: number) {
    this.material.uniforms.uFWidth = ufWidth;
    const size = this.characters.length;
    const vertices = new Float32Array(4 * 2 * size);
    const uvs = new Float32Array(4 * 2 * size);
    const indices = new Uint16Array(6 * size);

    /** Adds the glyphs to the GridHeadingsLabel */
    let index = 0;
    for (const char of this.characters) {
      const scale = GRID_HEADER_FONT_SIZE / this.bitmapFont.size;
      const textureFrame = char.entry.texture.frame;
      const textureUvs = char.entry.texture._uvs.uvsFloat32;
      const xPos = char.x;
      const yPos = char.y;
      const right = xPos + textureFrame.width * scale;
      const bottom = yPos + textureFrame.height * scale;

      indices[index * 6 + 0] = 0 + index * 4;
      indices[index * 6 + 1] = 1 + index * 4;
      indices[index * 6 + 2] = 2 + index * 4;
      indices[index * 6 + 3] = 0 + index * 4;
      indices[index * 6 + 4] = 2 + index * 4;
      indices[index * 6 + 5] = 3 + index * 4;

      vertices[index * 8 + 0] = xPos;
      vertices[index * 8 + 1] = yPos;
      vertices[index * 8 + 2] = right;
      vertices[index * 8 + 3] = yPos;
      vertices[index * 8 + 4] = right;
      vertices[index * 8 + 5] = bottom;
      vertices[index * 8 + 6] = xPos;
      vertices[index * 8 + 7] = bottom;

      uvs[index * 8 + 0] = textureUvs[0];
      uvs[index * 8 + 1] = textureUvs[1];
      uvs[index * 8 + 2] = textureUvs[2];
      uvs[index * 8 + 3] = textureUvs[3];
      uvs[index * 8 + 4] = textureUvs[4];
      uvs[index * 8 + 5] = textureUvs[5];
      uvs[index * 8 + 6] = textureUvs[6];
      uvs[index * 8 + 7] = textureUvs[7];

      index++;
    }
  }
}
