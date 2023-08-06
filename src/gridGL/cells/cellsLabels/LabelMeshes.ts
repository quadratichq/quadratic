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
import { msdfFrag, msdfVert } from './cellLabelShader';

class LabelMesh extends Mesh {
  id: string;

  fontName: string;
  fontSize: number;

  index = 0;
  indexCount = 0;
  vertexCount = 0;
  uvsCount = 0;
  total = 1;

  static textureCache = new Map<number, Texture>();

  indices!: Uint16Array;
  vertices!: Float32Array;
  uvs!: Float32Array;
  colors!: Float32Array;

  constructor(charTexture: Texture, fontName: string, fontSize: number) {
    const geometry = new MeshGeometry();
    let texture = LabelMesh.textureCache.get(charTexture.baseTexture.uid);
    if (!texture) {
      texture = new Texture(charTexture.baseTexture);
      LabelMesh.textureCache.set(charTexture.baseTexture.uid, texture);
    }
    const material = new MeshMaterial(texture, {
      program: Program.from(msdfVert, msdfFrag),
      uniforms: { uFWidth: 0 },
    });
    super(geometry, material);
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
    this.colors = new Float32Array(4 * 4 * total);
    this.geometry.addAttribute('aColors', this.colors, 4);
    this.size = 6 * total;
  }

  finalize(): void {
    const vertexBuffer = this.geometry.getBuffer('aVertexPosition');
    const textureBuffer = this.geometry.getBuffer('aTextureCoord');
    const colorBuffer = this.geometry.getBuffer('aColors');
    const indexBuffer = this.geometry.getIndex();

    vertexBuffer.data = this.vertices;
    textureBuffer.data = this.uvs;
    colorBuffer.data = this.colors;
    indexBuffer.data = this.indices;

    vertexBuffer.update();
    textureBuffer.update();
    colorBuffer.update();
    indexBuffer.update();

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

export class LabelMeshes extends Container<LabelMesh> {
  clear() {
    this.removeChildren();
  }

  add(fontName: string, fontSize: number, texture: Texture): string {
    const existing = this.children.find(
      (labelMesh) =>
        labelMesh.texture.baseTexture.uid === texture.baseTexture.uid &&
        labelMesh.fontName === fontName &&
        labelMesh.fontSize === fontSize
    );
    if (existing) {
      existing.total++;
      return existing.id;
    }
    const labelMesh = this.addChild(new LabelMesh(texture, fontName, fontSize));
    return labelMesh.id;
  }

  get(id: string): LabelMesh {
    const mesh = this.children.find((labelMesh) => labelMesh.id === id);
    if (!mesh) throw new Error('Expected to find LabelMesh based on id');
    return mesh;
  }

  prepare(): void {
    this.children.forEach((labelMesh) => labelMesh.prepare());
  }

  finalize(): void {
    this.children.forEach((labelMesh) => labelMesh.finalize());
  }

  render(renderer: Renderer): void {
    // Inject the shader code with the correct value
    const { a, b, c, d } = this.transform.worldTransform;

    const dx = Math.sqrt(a * a + b * b);
    const dy = Math.sqrt(c * c + d * d);
    const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
    const resolution = renderer.resolution;

    for (const child of this.children) {
      child.specialRender(renderer, worldScale * resolution);
    }
  }
}
