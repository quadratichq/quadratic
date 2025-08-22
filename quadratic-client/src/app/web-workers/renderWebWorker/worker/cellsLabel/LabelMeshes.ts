/**
 * LabelMeshes is a container for the LabelMesh objects.
 *
 * It contains LabelMesh children. LabelMeshes are rendered meshes for each font and style.
 */

import { LabelMesh } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMesh';

export class LabelMeshes {
  private labelMeshes: LabelMesh[] = [];
  private sheetId: string;
  private hashX: number;
  private hashY: number;

  constructor(sheetId: string, hashX: number, hashY: number) {
    this.sheetId = sheetId;
    this.hashX = hashX;
    this.hashY = hashY;
  }

  clear() {
    this.labelMeshes = [];
  }

  add(fontName: string, fontSize: number, textureUid: number, color: boolean): string {
    const existing = this.labelMeshes.find(
      (labelMesh) =>
        labelMesh.textureUid === textureUid &&
        labelMesh.fontName === fontName &&
        labelMesh.fontSize === fontSize &&
        labelMesh.hasColor === color
    );
    if (existing) {
      existing.total++;
      return existing.id;
    }
    const labelMesh = new LabelMesh({
      sheetId: this.sheetId,
      hashX: this.hashX,
      hashY: this.hashY,
      textureUid,
      fontName,
      fontSize,
      color,
    });
    this.labelMeshes.push(labelMesh);
    return labelMesh.id;
  }

  get(id: string): LabelMesh {
    const mesh = this.labelMeshes.find((labelMesh) => labelMesh.id === id);
    if (!mesh) throw new Error('Expected to find LabelMesh based on id');
    return mesh;
  }

  // prepares the buffers for each labelMesh
  prepare() {
    this.labelMeshes.forEach((labelMesh) => labelMesh.prepare());
  }

  // finalizes the buffers after populated
  finalize() {
    this.labelMeshes.forEach((labelMesh) => labelMesh.finalize());
  }

  totalMemory(): number {
    return this.labelMeshes.reduce((acc, labelMesh) => acc + labelMesh.memory, 0);
  }
}
