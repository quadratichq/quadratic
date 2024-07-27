/**
 * A LabelMeshEntry is a Mesh of a specific font and style that holds the
 * vertices, uvs, and indices for the hashed region of text.
 *
 * There may be multiple LabelMeshEntries for a single font/style combination to
 * ensure that the webGL buffers do not exceed the maximum size. These meshes
 * are rendered.
 */

import { BLEND_MODES, BitmapFont, Loader, Mesh, MeshGeometry, MeshMaterial, Program } from 'pixi.js';
import type { Texture } from 'pixi.js';

import * as shaderNoTint from '@/app/gridGL/cells/cellsLabel/cellLabelShader';
import * as shaderTint from '@/app/gridGL/cells/cellsLabel/cellLabelShaderTint';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';

export class LabelMeshEntry extends Mesh {
  private fontName: string;
  private fontSize = 14;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new MeshGeometry();
    const shader = message.hasColor ? shaderTint : shaderNoTint;
    const resource = Loader.shared.resources[message.fontName]; // Texture.WHITE; //Texture.from(message.fontName);
    if (!resource?.bitmapFont) {
      throw new Error(`Texture not found for font: ${message.fontName}`);
    }
    const pages = resource.bitmapFont.pageTextures;
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

    geometry.getBuffer('aVertexPosition').update(message.vertices);
    geometry.getBuffer('aTextureCoord').update(message.uvs);
    geometry.getIndex().update(message.indices);

    if (message.hasColor && message.colors) {
      geometry.addAttribute('aColors', message.colors, 4);
    }

    super(geometry, material);
    this.fontName = message.fontName;
    this.blendMode = BLEND_MODES.NORMAL_NPM;
  }

  setUniforms(scale: number) {
    // Inject the shader code with the correct value
    const { distanceFieldRange, size } = BitmapFont.available[this.fontName];
    const fontScale = this.fontSize / size;
    const ufWidth = distanceFieldRange * fontScale * scale;
    this.shader.uniforms.uFWidth = ufWidth;
  }
}
