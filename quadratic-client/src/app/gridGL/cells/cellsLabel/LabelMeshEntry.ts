/**
 * A LabelMeshEntry is a Mesh of a specific font and style that holds the
 * vertices, uvs, and indices for the hashed region of text.
 *
 * There may be multiple LabelMeshEntries for a single font/style combination to
 * ensure that the webGL buffers do not exceed the maximum size. These meshes
 * are rendered.
 */

import * as shaderNoTint from '@/app/gridGL/cells/cellsLabel/cellLabelShader';
import { wgsl } from '@/app/gridGL/cells/cellsLabel/cellLabelShader';
import * as shaderTint from '@/app/gridGL/cells/cellsLabel/cellLabelShaderTint';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { BitmapFont, TextureShader } from 'pixi.js';
import { Assets, GlProgram, GpuProgram, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';

export class LabelMeshEntry extends Mesh {
  private fontName: string;
  private fontSize = 14;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new MeshGeometry({ positions: message.vertices, uvs: message.uvs, indices: message.indices });

    const shaderGL = message.hasColor ? shaderTint : shaderNoTint;
    if (shaderGL) console.log();

    // Get the font from Assets
    const font = Assets.get(message.fontName) as BitmapFont;
    if (!font) {
      throw new Error(`Font not found: ${message.fontName}`);
    }
    // Get the texture from the font's page textures
    const pages = font.pages;
    const page = pages.find((page) => page.texture.source.uid === message.textureUid);
    const texture = page?.texture;
    if (!texture) {
      throw new Error(`Texture not found for font: ${message.fontName} with uid: ${message.textureUid}`);
    }

    const localUniforms = new UniformGroup({
      uFWidth: { value: 0, type: 'f32' },
    });

    const shader = new Shader({
      glProgram: new GlProgram({
        vertex: shaderGL.msdfVert,
        fragment: shaderGL.msdfFrag,
      }),
      gpuProgram: GpuProgram.from({
        name: 'cellLabelShader',
        vertex: {
          source: wgsl,
          entryPoint: 'mainVertex',
        },
        fragment: { source: wgsl, entryPoint: 'mainFrag' },
      }),
      resources: {
        localUniforms,
        uTexture: texture.source,
        uSampler: texture.source.style,
      },
    });
    const shaderWithTexture = shader as TextureShader;
    shaderWithTexture.texture = texture;

    if (message.hasColor && message.colors) {
      geometry.addAttribute('aColors', { buffer: message.colors, size: 4 });
    }

    super({ geometry, shader: shaderWithTexture, texture });

    this.fontName = message.fontName;
    this.blendMode = 'normal-npm';
  }

  setUniforms(scale: number) {
    // Get font from Assets for uniform calculation
    const font = Assets.get(this.fontName);
    if (!font) {
      throw new Error(`Font not found: ${this.fontName}`);
    }
    const fontScale = this.fontSize / font.fontMetrics.fontSize;
    const ufWidth = font.distanceField.range * fontScale * scale;
    if (!this.shader) {
      throw new Error('Expected to find shader for LabelMeshEntry');
    }
    if (this.shader.resources.localUniforms?.uniforms) {
      this.shader.resources.localUniforms.uniforms.uFWidth = ufWidth;
    }
  }
}
