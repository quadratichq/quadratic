/**
 * CellsTextHash is the parent container for the text of cells in a hashed
 * region of the sheet.
 *
 * It contains LabelMeshes children. LabelMeshes are rendered meshes for each
 * font and style combination. LabelMeshes are populated using the data within
 * each CellLabel within the hashed region. LabelMeshes may contain multiple
 * LabelMesh children of the same font/style combination to ensure that the
 * webGL buffers do not exceed the maximum size.
 */

import { sheets } from '@/grid/controller/Sheets';
import { RenderClientLabelMeshEntry } from '@/web-workers/renderWebWorker/renderClientMessages';
import { Container, Graphics, Rectangle, Renderer } from 'pixi.js';
import { sheetHashHeight, sheetHashWidth } from '../CellsTypes';
import { CellsLabels } from './CellsLabels';
import { LabelMeshEntry } from './LabelMeshEntry';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash extends Container<LabelMeshEntry> {
  private cellsLabels: CellsLabels;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // received from render web worker and used for culling
  visibleRectangle: Rectangle;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  constructor(
    cellsLabels: CellsLabels,
    hashX: number,
    hashY: number,
    bounds: { x: number; y: number; width: number; height: number },
    x: number,
    y: number
  ) {
    super();
    this.cellsLabels = cellsLabels;
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    this.visibleRectangle = new Rectangle(bounds.x + x, bounds.y + y, bounds.width, bounds.height);
    this.hashX = hashX;
    this.hashY = hashY;
    this.position.set(x, y);
  }

  clear() {
    this.removeChildren();
  }

  addLabelMeshEntry(message: RenderClientLabelMeshEntry) {
    this.addChild(new LabelMeshEntry(message));
  }

  clearMeshEntries(bounds: { x: number; y: number; width: number; height: number }, x: number, y: number) {
    this.removeChildren();
    this.visibleRectangle = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
    this.position.set(x, y);
    console.log(x, y);
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

  drawDebugBox(g: Graphics) {
    const sheet = sheets.getById(this.cellsLabels.sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in CellsTextHash.drawDebugBox');
    const screen = sheet.getScreenRectangle(this.AABB.left, this.AABB.top, this.AABB.width, this.AABB.height);
    g.beginFill(this.debugColor, 0.25);
    g.drawShape(screen);
    g.endFill();
  }

  // TODO: we'll need to send this over as part of the render message
  getCellsContentMaxWidth(column: number): number {
    let max = 0;
    // this.labels.forEach((label) => {
    //   if (label.location.x === column) {
    //     max = Math.max(max, label.textWidth);
    //   }
    // });
    return max;
  }

  // TODO: we will need to replace this with boxes to avoid rerendering the hashes. this means we'll have to share each CellLabel's bounds
  showLabel(x: number, y: number, show: boolean) {
    // const label = this.getLabel(x, y);
    // if (label && label.visible !== show) {
    //   label.visible = show;
    //   this.dirtyBuffers = true;
    // }
  }
}
