import { v4 as uuid } from 'uuid';

import {
  BLEND_MODES,
  BitmapFont,
  Container,
  Mesh,
  MeshGeometry,
  MeshMaterial,
  Program,
  Renderer,
  Texture,
} from 'pixi.js';
import { debugShowCellHashesInfo } from '../../../debugFlags';
import * as shaderNoTint from './cellLabelShader';
import * as shaderTint from './cellLabelShaderTint';

const MAX_VERTICES = 65535;

class LabelMeshEntry extends Mesh {
  private labelMesh: LabelMesh;

  index = 0;
  indexCount = 0;
  vertexCount = 0;
  uvsCount = 0;

  indices!: Uint16Array;
  vertices!: Float32Array;
  uvs!: Float32Array;
  colors!: Float32Array;

  constructor(labelMesh: LabelMesh, total: number) {
    const geometry = new MeshGeometry();
    const shader = labelMesh.hasColor ? shaderTint : shaderNoTint;
    const material = new MeshMaterial(labelMesh.texture, {
      program: Program.from(shader.msdfVert, shader.msdfFrag),
      uniforms: { uFWidth: 0 },
    });
    super(geometry, material);
    this.labelMesh = labelMesh;
    this.blendMode = BLEND_MODES.NORMAL_NPM;
    this.vertices = new Float32Array(4 * 2 * total);
    this.uvs = new Float32Array(4 * 2 * total);
    this.indices = new Uint16Array(6 * total);
    this.size = 6 * total;

    if (labelMesh.hasColor) {
      this.colors = new Float32Array(4 * 4 * total);
      this.geometry.addAttribute('aColors', this.colors, 4);
    }
  }

  finalize() {
    const vertexBuffer = this.geometry.getBuffer('aVertexPosition');
    const textureBuffer = this.geometry.getBuffer('aTextureCoord');
    const indexBuffer = this.geometry.getIndex();

    vertexBuffer.data = this.vertices;
    textureBuffer.data = this.uvs;
    indexBuffer.data = this.indices;

    vertexBuffer.update();
    textureBuffer.update();
    indexBuffer.update();

    if (this.labelMesh.hasColor) {
      const colorBuffer = this.geometry.getBuffer('aColors');
      colorBuffer.data = this.colors;
      colorBuffer.update();
    }

    if (debugShowCellHashesInfo) {
      console.log(`[LabelMeshes] buffer size: ${this.size}`);
    }
  }

  reduceSize(delta: number) {
    this.size -= delta;
  }

  specialRender(renderer: Renderer, ufWidth: number) {
    this.shader.uniforms.uFWidth = ufWidth;
    this.render(renderer);
  }
}

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

  prepare(): void {
    this.removeChildren();
    this.currentEntry = 0;
    while (this.total > 0) {
      const size = this.total > MAX_VERTICES ? MAX_VERTICES : this.total;
      const entry = new LabelMeshEntry(this, size);
      this.addChild(entry);
      this.total -= size;
    }
  }

  getBuffer(): LabelMeshEntry {
    const entry = this.children[this.currentEntry];
    if (entry.index + 1 > MAX_VERTICES) {
      console.log('too large...');
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
