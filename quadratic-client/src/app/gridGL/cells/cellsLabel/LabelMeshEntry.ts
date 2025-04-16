/**
 * A LabelMeshEntry is a Mesh of a specific font and style that holds the
 * vertices, uvs, and indices for the hashed region of text.
 *
 * There may be multiple LabelMeshEntries for a single font/style combination to
 * ensure that the webGL buffers do not exceed the maximum size. These meshes
 * are rendered.
 */

import * as shaderNoTint from '@/app/gridGL/cells/cellsLabel/cellLabelShader';
import * as shaderTint from '@/app/gridGL/cells/cellsLabel/cellLabelShaderTint';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { Texture, TextureShader } from 'pixi.js';
import { Assets, Mesh, MeshGeometry, Shader } from 'pixi.js';

export class LabelMeshEntry extends Mesh {
  private fontName: string;
  private fontSize = 14;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new MeshGeometry({
      positions: message.vertices,
      uvs: message.uvs,
      indices: message.indices,
    });
    const shaderGL = message.hasColor ? shaderTint : shaderNoTint;

    // Get the font from Assets
    const font = Assets.get(message.fontName);
    if (!font) {
      throw new Error(`Font not found: ${message.fontName}`);
    }

    // Get the texture from the font's page textures
    const pages = font.pages;
    let texture: Texture | undefined;
    for (const page in pages) {
      if (pages[page].texture.source.uid === message.textureUid) {
        texture = pages[page].texture;
      }
    }
    if (!texture) {
      throw new Error(`Texture not found for font: ${message.fontName} with uid: ${message.textureUid}`);
    }

    const shader = Shader.from({
      gl: {
        vertex: shaderGL.msdfVert,
        fragment: shaderGL.msdfFrag,
      },
      resources: {
        uFWidth: 0,
        uTexture: texture.source,
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
    this.shader.resources.uFWidth = ufWidth;
  }
}
