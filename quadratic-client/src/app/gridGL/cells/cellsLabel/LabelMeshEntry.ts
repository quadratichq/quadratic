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
import { Assets, Geometry, GpuProgram, Mesh, Shader, UniformGroup } from 'pixi.js';

export class LabelMeshEntry extends Mesh<Geometry, TextureShader> {
  private fontName: string;
  private fontSize = 14;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new Geometry();

    geometry.addAttribute('aPosition', { buffer: message.vertices, size: 2 });
    geometry.addAttribute('aUV', { buffer: message.uvs, size: 2 });
    geometry.addIndex(message.indices);

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
      // gl: {
      //   vertex: shaderGL.msdfVert,
      //   fragment: shaderGL.msdfFrag,
      // },
      gpuProgram: GpuProgram.from({
        vertex: {
          source: wgsl,
          entryPoint: 'mainVertex',
        },
        fragment: { source: wgsl, entryPoint: 'mainFrag' },
      }),
      resources: {
        localUniforms,
      },
    });
    const shaderWithTexture = shader as TextureShader;
    shaderWithTexture.texture = texture;

    if (message.hasColor && message.colors) {
      geometry.addAttribute('aColors', { buffer: message.colors, size: 4 });
    }

    super({ geometry, shader: shaderWithTexture, texture });

    console.log(this);

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
