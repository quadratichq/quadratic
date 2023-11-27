import { BLEND_MODES, Mesh, MeshGeometry, MeshMaterial, Program, Renderer } from 'pixi.js';
import { debugShowCellHashesInfo } from '../../../debugFlags';
import { LabelMesh } from './LabelMesh';
import * as shaderNoTint from './cellLabelShader';
import * as shaderTint from './cellLabelShaderTint';

export class LabelMeshEntry extends Mesh {
  private labelMesh: LabelMesh;
  private total: number;

  index = 0;
  vertexCount = 0;
  uvsCount = 0;

  // @ts-expect-error
  indices!: Uint16Array;
  vertices!: Float32Array;
  // @ts-expect-error
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
    this.blendMode = BLEND_MODES.NORMAL_NPM;
    this.labelMesh = labelMesh;
    this.total = total;
    this.clear();
  }

  // used to clear the buffers for reuse
  clear() {
    this.vertices = new Float32Array(4 * 2 * this.total);
    this.uvs = new Float32Array(4 * 2 * this.total);
    this.indices = new Uint16Array(6 * this.total);
    this.size = 6 * this.total;
    this.index = 0;

    if (this.labelMesh.hasColor) {
      this.colors = new Float32Array(4 * 4 * this.total);
      if (!this.geometry.attributes.aColors) {
        this.geometry.addAttribute('aColors', this.colors, 4);
      }
    }
  }

  // finalizes the buffers for rendering
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
