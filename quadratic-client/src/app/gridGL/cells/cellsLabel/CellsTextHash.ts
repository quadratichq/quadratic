/**
 * CellsTextHash is the parent container for the text of cells in a hashed
 * region of the sheet.
 *
 * It contains LabelMeshes children. LabelMeshes are rendered meshes for each
 * font and style combination. LabelMeshes are populated using the data within
 * each CellLabel within the hashed region. LabelMeshes may contain multiple
 * LabelMesh children of the same font/style combination to ensure that the
 * webGL buffers do not exceed the maximum size.
 *
 * The data calculations occur in renderWebWorker::CellsTextHash.ts.
 */

import { BitmapText, Container, Rectangle } from 'pixi.js';
import type { Graphics, Renderer } from 'pixi.js';

import { LabelMeshEntry } from '@/app/gridGL/cells/cellsLabel/LabelMeshEntry';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash extends Container<LabelMeshEntry> {
  // holds replacement LabelMeshEntry objects that will replace the current children once we receive them all
  private newChildren: LabelMeshEntry[] = [];

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // received from render web worker and used for culling
  viewRectangle: Rectangle;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  constructor(hashX: number, hashY: number, viewRectangle: Rectangle) {
    super();
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    this.viewRectangle = viewRectangle;
    this.hashX = hashX;
    this.hashY = hashY;
  }

  clear() {
    this.removeChildren();
  }

  addLabelMeshEntry(message: RenderClientLabelMeshEntry) {
    this.newChildren.push(new LabelMeshEntry(message));
  }

  finalizeLabelMeshEntries() {
    this.removeChildren();
    this.newChildren.forEach((child) => this.addChild(child));
    this.newChildren = [];
  }

  clearMeshEntries(viewRectangle: Rectangle) {
    this.viewRectangle = viewRectangle;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  // overrides container's render function
  render(renderer: Renderer) {
    if (this.visible && this.worldAlpha > 0 && this.renderable) {
      const { a, b, c, d } = this.transform.worldTransform;
      const dx = Math.sqrt(a * a + b * b);
      const dy = Math.sqrt(c * c + d * d);
      const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
      const resolution = renderer.resolution;
      const scale = worldScale * resolution;
      this.children.forEach((child) => child.setUniforms(scale));
      super.render(renderer);
    }
  }

  drawDebugBox(g: Graphics, c: Container) {
    const screen = this.viewRectangle;
    g.beginFill(this.debugColor, 0.25);
    g.drawShape(screen);
    g.endFill();
    const text = c.addChild(new BitmapText(`${this.hashX},${this.hashY}`, { fontName: 'OpenSans', fontSize: 12 }));
    text.tint = 0xff0000;
    text.position.set(screen.x, screen.y);
  }

  adjust(hashX: number | undefined, hashY: number | undefined, delta: number) {
    if (hashX !== undefined) {
      if (hashX < 0 && this.hashX < hashX) {
        this.x -= delta;
        this.viewRectangle.x -= delta;
      } else if (hashX >= 0 && this.hashX > hashX) {
        this.x += delta;
        this.viewRectangle.x += delta;
      }
    }
    if (hashY !== undefined) {
      if (hashY < 0 && this.hashY < hashY) {
        this.y -= delta;
        this.viewRectangle.y -= delta;
      } else if (hashY >= 0 && this.hashY > hashY) {
        this.y += delta;
        this.viewRectangle.y += delta;
      }
    }
  }
}
