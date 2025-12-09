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
import type { Texture } from 'pixi.js';
import { BitmapFont, BLEND_MODES, Mesh, MeshGeometry, MeshMaterial, Program } from 'pixi.js';

export class LabelMeshEntry extends Mesh {
  private fontName: string;
  private fontSize: number;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new MeshGeometry();
    const shader = message.hasColor ? shaderTint : shaderNoTint;

    const font = BitmapFont.available[message.fontName];
    if (!font) {
      throw new Error(`Font not found: ${message.fontName}`);
    }

    // Get the texture from the font's page textures
    const pages = font.pageTextures;
    let texture: Texture | undefined;
    for (const page in pages) {
      if (pages[page].baseTexture.uid === message.textureUid) {
        texture = pages[page];
      }
    }
    if (!texture) {
      throw new Error(`Texture not found for font: ${message.fontName} with uid: ${message.textureUid}`);
    }

    const material = new MeshMaterial(texture, {
      program: Program.from(shader.msdfVert, shader.msdfFrag),
      uniforms: { uFWidth: 0 },
    });

    geometry.addAttribute('aVertexPosition', message.vertices, 2);
    geometry.addAttribute('aTextureCoord', message.uvs, 2);
    geometry.addIndex(Array.from(message.indices));

    if (message.hasColor && message.colors) {
      geometry.addAttribute('aColors', message.colors, 4);
    }
    super(geometry, material);
    this.fontName = message.fontName;
    this.fontSize = message.fontSize;
    this.blendMode = BLEND_MODES.NORMAL_NPM;
  }

  setUniforms(scale: number) {
    const font = BitmapFont.available[this.fontName];
    if (!font) {
      throw new Error(`Font not found: ${this.fontName}`);
    }
    const fontScale = this.fontSize / font.size;
    const ufWidth = font.distanceFieldRange * fontScale * scale;
    this.shader.uniforms.uFWidth = ufWidth;
  }
}
