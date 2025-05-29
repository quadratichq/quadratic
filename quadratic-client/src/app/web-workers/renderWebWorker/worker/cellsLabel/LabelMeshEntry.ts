/**
 * A LabelMeshEntry is a Mesh of a specific font and style that holds the
 * vertices, uvs, and indices for the hashed region of text.
 *
 * There may be multiple LabelMeshEntries for a single font/style combination to
 * ensure that the webGL buffers do not exceed the maximum size. These meshes
 * are rendered.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { LabelMesh } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMesh';
import { renderClient } from '@/app/web-workers/renderWebWorker/worker/renderClient';

export class LabelMeshEntry {
  private labelMesh: LabelMesh;
  private total: number;
  memory: number;

  index = 0;
  vertexCount = 0;
  uvsCount = 0;
  size = 0;

  indices?: Uint16Array;
  vertices?: Float32Array;
  uvs?: Float32Array;
  colors?: Float32Array;

  constructor(labelMesh: LabelMesh, total: number) {
    this.labelMesh = labelMesh;
    this.total = total;
    this.clear();
    this.memory = 0;
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
    }
  }

  // finalizes the buffers for rendering
  finalize() {
    if (!this.vertices || !this.uvs || !this.indices) {
      throw new Error('Expected LabelMeshEntries.finalize to have buffers');
    }
    const message: RenderClientLabelMeshEntry = {
      type: 'renderClientLabelMeshEntry',
      sheetId: this.labelMesh.sheetId,
      hashX: this.labelMesh.hashX,
      hashY: this.labelMesh.hashY,
      fontName: this.labelMesh.fontName,
      fontSize: this.labelMesh.fontSize,
      textureUid: this.labelMesh.textureUid,
      hasColor: this.labelMesh.hasColor,
      vertices: this.vertices,
      uvs: this.uvs,
      indices: this.indices,
    };
    if (this.labelMesh.hasColor) {
      if (!this.colors) {
        throw new Error('Expected LabelMeshEntries.finalize to have colors');
      }
      message.colors = this.colors;
      this.memory = this.vertices.byteLength + this.uvs.byteLength + this.indices.byteLength + this.colors.byteLength;
      renderClient.sendLabelMeshEntry(message, [
        this.vertices.buffer as ArrayBuffer,
        this.uvs.buffer as ArrayBuffer,
        this.indices.buffer as ArrayBuffer,
        this.colors.buffer as ArrayBuffer,
      ]);
    } else {
      this.memory = this.vertices.byteLength + this.uvs.byteLength + this.indices.byteLength;
      renderClient.sendLabelMeshEntry(message, [
        this.vertices.buffer as ArrayBuffer,
        this.uvs.buffer as ArrayBuffer,
        this.indices.buffer as ArrayBuffer,
      ]);
    }

    if (debugFlag('debugShowCellHashesInfo')) {
      console.log(`[LabelMeshes] buffer size: ${this.size}`);
    }
  }

  reduceSize(delta: number) {
    this.size -= delta;
  }
}
