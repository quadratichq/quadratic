import { Container, Renderer, Texture } from 'pixi.js';
import { LabelMesh } from './LabelMesh';

export class LabelMeshes extends Container<LabelMesh> {
  clear() {
    this.removeChildren();
  }

  add(fontName: string, fontSize: number, texture: Texture, color: boolean): string {
    const existing = this.children.find(
      (labelMesh) =>
        labelMesh.texture.baseTexture.uid === texture.baseTexture.uid &&
        labelMesh.fontName === fontName &&
        labelMesh.fontSize === fontSize &&
        labelMesh.hasColor === color
    );
    if (existing) {
      existing.total++;
      return existing.id;
    }
    const labelMesh = this.addChild(new LabelMesh(texture, fontName, fontSize, color));
    return labelMesh.id;
  }

  get(id: string): LabelMesh {
    const mesh = this.children.find((labelMesh) => labelMesh.id === id);
    if (!mesh) throw new Error('Expected to find LabelMesh based on id');
    return mesh;
  }

  // prepares the buffers for each labelMesh
  prepare(reuseBuffers: boolean): void {
    this.children.forEach((labelMesh) => labelMesh.prepare(reuseBuffers));
  }

  // finalizes the buffers after populated
  finalize(): void {
    this.children.forEach((labelMesh) => labelMesh.finalize());
  }

  render(renderer: Renderer): void {
    // Inject the shader code with the correct value
    const { a, b, c, d } = this.transform.worldTransform;

    const dx = Math.sqrt(a * a + b * b);
    const dy = Math.sqrt(c * c + d * d);
    const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
    const resolution = renderer.resolution;

    for (const child of this.children) {
      child.specialRender(renderer, worldScale * resolution);
    }
  }
}
