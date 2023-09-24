import { v4 as uuid } from 'uuid';

import { BLEND_MODES, BitmapFont, Mesh, MeshGeometry, MeshMaterial, Program, Renderer, Texture } from 'pixi.js';
import { debugShowCellHashesInfo } from '../../../debugFlags';
import * as shaderNoTint from './cellLabelShader';
import * as shaderTint from './cellLabelShaderTint';

export class LabelMesh extends Mesh {
  id: string;

  fontName: string;
  fontSize: number;

  index = 0;
  indexCount = 0;
  vertexCount = 0;
  uvsCount = 0;
  total = 1;

  hasColor: boolean;

  static textureCache = new Map<number, Texture>();

  indices!: Uint16Array;
  vertices!: Float32Array;
  uvs!: Float32Array;
  colors!: Float32Array;

  constructor(charTexture: Texture, fontName: string, fontSize: number, color: boolean) {
    const geometry = new MeshGeometry();
    let texture = LabelMesh.textureCache.get(charTexture.baseTexture.uid);
    if (!texture) {
      texture = new Texture(charTexture.baseTexture);
      LabelMesh.textureCache.set(charTexture.baseTexture.uid, texture);
    }
    const shader = color ? shaderTint : shaderNoTint;
    const material = new MeshMaterial(texture, {
      program: Program.from(shader.msdfVert, shader.msdfFrag),
      uniforms: { uFWidth: 0 },
    });
    super(geometry, material);
    this.hasColor = color;
    this.blendMode = BLEND_MODES.NORMAL_NPM;

    this.id = uuid();
    this.fontName = fontName;
    this.fontSize = fontSize;
  }

  prepare(): void {
    const total = this.total;
    this.vertices = new Float32Array(4 * 2 * total);
    this.uvs = new Float32Array(4 * 2 * total);
    this.indices = new Uint16Array(6 * total);
    this.size = 6 * total;

    if (this.hasColor) {
      this.colors = new Float32Array(4 * 4 * total);
      this.geometry.addAttribute('aColors', this.colors, 4);
    }
  }

  finalize(): void {
    const vertexBuffer = this.geometry.getBuffer('aVertexPosition');
    const textureBuffer = this.geometry.getBuffer('aTextureCoord');
    const indexBuffer = this.geometry.getIndex();

    vertexBuffer.data = this.vertices;
    textureBuffer.data = this.uvs;
    indexBuffer.data = this.indices;

    vertexBuffer.update();
    textureBuffer.update();
    indexBuffer.update();

    if (this.hasColor) {
      const colorBuffer = this.geometry.getBuffer('aColors');
      colorBuffer.data = this.colors;
      colorBuffer.update();
    }

    if (debugShowCellHashesInfo) {
      console.log(`[LabelMeshes] buffer size: ${this.size}`);
    }
  }

  specialRender(renderer: Renderer, scale: number): void {
    const { distanceFieldRange, size } = BitmapFont.available[this.fontName];
    const fontScale = this.fontSize / size;
    this.shader.uniforms.uFWidth = distanceFieldRange * fontScale * scale;
    this.render(renderer);
  }
}
