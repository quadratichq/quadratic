/**
 * LabelMeshes is a container for the LabelMesh objects.
 *
 * It contains LabelMesh children. LabelMeshes are rendered meshes for each font and style.
 */

import { LabelMesh } from './LabelMesh';

export class LabelMeshes {
  private labelMeshes: LabelMesh[] = [];

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
    const labelMesh = new LabelMesh(textureUid, fontName, fontSize, color);
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
}
