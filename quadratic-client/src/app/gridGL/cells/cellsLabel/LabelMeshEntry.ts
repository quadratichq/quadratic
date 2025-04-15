/**
 * A LabelMeshEntry is a Mesh of a specific font and style that holds the
 * vertices, uvs, and indices for the hashed region of text.
 *
 * There may be multiple LabelMeshEntries for a single font/style combination to
 * ensure that the webGL buffers do not exceed the maximum size. These meshes
 * are rendered.
 */

import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { Texture } from 'pixi.js';
import { Assets, MeshGeometry, MeshSimple } from 'pixi.js';

export class LabelMeshEntry extends MeshSimple {
  private fontName: string;
  private fontSize = 14;

  constructor(message: RenderClientLabelMeshEntry) {
    const geometry = new MeshGeometry({
      positions: message.vertices,
      uvs: message.uvs,
      indices: message.indices,
    });
    // const shader = message.hasColor ? shaderTint : shaderNoTint;

    // Get the font from Assets
    const font = Assets.get(message.fontName);
    if (!font) {
      throw new Error(`Font not found: ${message.fontName}`);
    }

    // Get the texture from the font's page textures
    const pages = font.pageTextures;
    let texture: Texture | undefined;
    for (const page in pages) {
      if (pages[page].source.uid === message.textureUid) {
        texture = pages[page];
      }
    }
    if (!texture) {
      throw new Error(`Texture not found for font: ${message.fontName} with uid: ${message.textureUid}`);
    }

    // const material = new MeshMaterial(texture, {
    //   program: Program.from(shader.msdfVert, shader.msdfFrag),
    //   uniforms: { uFWidth: 0 },
    // });

    // geometry.getBuffer('aVertexPosition').update(message.vertices);
    // geometry.getBuffer('aTextureCoord').update(message.uvs);
    // geometry.getIndex().update(message.indices);

    if (message.hasColor && message.colors) {
      geometry.addAttribute('aColors', { buffer: message.colors, size: 4 });
    }

    super({ texture, vertices: message.vertices, uvs: message.uvs, indices: message.indices });
    this.fontName = message.fontName;
    this.blendMode = 'normal-npm';
  }

  setUniforms(scale: number) {
    // Get font from Assets for uniform calculation
    const font = Assets.get(this.fontName);
    if (!font) {
      throw new Error(`Font not found: ${this.fontName}`);
    }
    // const fontScale = this.fontSize / font.size;
    // const ufWidth = font.distanceFieldRange * fontScale * scale;
    // this.shader.uniforms.uFWidth = ufWidth;
  }
}
