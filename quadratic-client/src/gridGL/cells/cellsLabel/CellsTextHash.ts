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

import { debugShowHashUpdates } from '@/debugFlags';
import { Container, Graphics, Rectangle, Renderer } from 'pixi.js';
import { Bounds } from '../../../grid/sheet/Bounds';
import { Sheet } from '../../../grid/sheet/Sheet';
import { JsRenderCell } from '../../../quadratic-core/types';
import { sheetHashHeight, sheetHashWidth } from '../CellsTypes';
import { CellLabel } from './CellLabel';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash extends Container<LabelMeshes> {
  private cellsLabels: CellsLabels;

  // holds the glyph meshes for font/style combinations
  private labelMeshes: LabelMeshes;

  // index into the labels by location key (column,row)
  private labels: Map<string, CellLabel>;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // shows bounds of the hash with content
  viewBounds: Bounds;

  // rectangle of the hash on the screen regardless of content (does not include overflow cells)
  rawViewRectangle: Rectangle;

  // rectangle of the hash including overflowed cells
  viewRectangle: Rectangle;

  // rebuild CellsTextHash
  dirty = false;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // rebuild only buffers
  dirtyBuffers = false;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  constructor(cellsLabels: CellsLabels, x: number, y: number) {
    super();
    this.cellsLabels = cellsLabels;
    this.labels = new Map();
    this.labelMeshes = this.addChild(new LabelMeshes());
    this.viewBounds = new Bounds();
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    const start = cellsLabels.sheet.getCellOffsets(this.AABB.left, this.AABB.top);
    const end = cellsLabels.sheet.getCellOffsets(this.AABB.right, this.AABB.bottom);
    this.rawViewRectangle = new Rectangle(start.left, start.top, end.right - start.left, end.bottom - start.top);
    this.viewRectangle = this.rawViewRectangle.clone();
    this.hashX = x;
    this.hashY = y;
  }

  get sheet(): Sheet {
    return this.cellsLabels.sheet;
  }

  // key used to find individual cell labels
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
    return `${cell.x},${cell.y}`;
  }

  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsTextHash | undefined {
    return this.cellsLabels.findPreviousHash(column, row, bounds);
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.labels.get(`${column},${row}`);
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
      this.labelMeshes.render(renderer);
    }
  }

  private createLabel(cell: JsRenderCell): CellLabel {
    const rectangle = this.sheet.getCellOffsets(Number(cell.x), Number(cell.y));
    const cellLabel = new CellLabel(cell, rectangle);
    this.labels.set(this.getKey(cell), cellLabel);
    return cellLabel;
  }

  createLabels(): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] createLabels for ${this.hashX}, ${this.hashY}`);
    this.labels = new Map();
    const cells = this.sheet.getRenderCells(this.AABB);
    cells.forEach((cell) => this.createLabel(cell));
    this.updateText();
  }

  update(): boolean {
    if (this.dirty) {
      this.createLabels();
      this.overflowClip();
      this.updateBuffers(false);
      this.dirty = false;
      this.dirtyBuffers = false;
      return true;
    } else if (this.dirtyBuffers) {
      this.updateBuffers(true);
      this.dirtyBuffers = false;
      return true;
    }
    return false;
  }

  private updateText() {
    this.labelMeshes.clear();
    this.labels.forEach((child) => {
      child.updateText(this.labelMeshes);
    });
  }

  overflowClip(): void {
    // used to ensure we don't check for clipping beyond the end of the sheet's data bounds
    const bounds = this.sheet.getGridBounds(true);

    // empty when there are no cells
    if (!bounds) return;

    if (debugShowHashUpdates) console.log(`[CellsTextHash] overflowClip for ${this.hashX}, ${this.hashY}`);
    this.labels.forEach((cellLabel) => this.checkClip(bounds, cellLabel));
  }

  private checkClip(bounds: Rectangle, label: CellLabel): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] checkClip for ${this.hashX}, ${this.hashY}`);
    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;

    while (column >= bounds.left) {
      if (column < currentHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.findPreviousHash(column, row, bounds);
        if (!currentHash) return;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        neighborLabel.checkRightClip(label.AABB.left);
        label.checkLeftClip(neighborLabel.AABB.right);
        return;
      }
      column--;
    }

    column = label.location.x + 1;
    while (column <= bounds.right) {
      if (column > currentHash.AABB.right) {
        // find hash to the right of current hash (skip over empty hashes)
        currentHash = this.cellsLabels.findNextHash(column, row, bounds);
        if (!currentHash) return;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        neighborLabel.checkLeftClip(label.AABB.right);
        label.checkRightClip(neighborLabel.AABB.left);
        return;
      }
      column++;
    }
  }

  updateBuffers(reuseBuffers: boolean): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] updateBuffers for ${this.hashX}, ${this.hashY}`);

    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare(reuseBuffers);

    // populate labelMeshes webGL buffers
    this.viewBounds.clear();
    this.labels.forEach((cellLabel) => {
      const bounds = cellLabel.updateLabelMesh(this.labelMeshes);
      this.viewBounds.mergeInto(bounds);
    });

    // adjust viewRectangle by viewBounds overflow
    this.viewRectangle = this.rawViewRectangle.clone();
    if (this.viewBounds.minX < this.viewRectangle.left) {
      this.viewRectangle.width += this.viewRectangle.left - this.viewBounds.minX;
      this.viewRectangle.x = this.viewBounds.minX;
    }
    if (this.viewBounds.maxX > this.viewRectangle.right) {
      this.viewRectangle.width += this.viewBounds.maxX - this.viewRectangle.right;
    }
    if (this.viewBounds.minY < this.viewRectangle.top) {
      this.viewRectangle.height += this.viewRectangle.top - this.viewBounds.minY;
      this.viewRectangle.y = this.viewBounds.minY;
    }
    if (this.viewBounds.maxY > this.viewRectangle.bottom) {
      this.viewRectangle.height += this.viewBounds.maxY - this.viewRectangle.bottom;
    }

    // finalizes webGL buffers
    this.labelMeshes.finalize();
  }

  adjustHeadings(options: { delta: number; column?: number; row?: number }): boolean {
    const { delta, column, row } = options;
    let changed = false;
    if (column !== undefined) {
      this.labels.forEach((label) => {
        if (label.location.x === column) {
          label.adjustWidth(delta, column < 0);
        } else {
          if (column < 0) {
            if (label.location.x < column) {
              label.adjustX(-delta);
              changed = true;
            }
          } else {
            if (label.location.x > column) {
              label.adjustX(delta);
              changed = true;
            }
          }
        }
      });
    } else if (row !== undefined) {
      this.labels.forEach((label) => {
        if (label.location.y === row) {
          label.adjustHeight(delta, row < 0);
        } else {
          if (row < 0) {
            if (label.location.y < row) {
              label.adjustY(-delta);
              changed = true;
            }
          } else {
            if (label.location.y > row) {
              label.adjustY(delta);
              changed = true;
            }
          }
        }
      });
    }
    if (changed && debugShowHashUpdates)
      console.log(
        `[CellsTextHash] adjustHeadings for ${this.hashX}, ${this.hashY} because of changes in column: ${column}, row: ${row}`
      );

    return changed;
  }

  drawDebugBox(g: Graphics) {
    const screen = this.sheet.getScreenRectangle(this.AABB.left, this.AABB.top, this.AABB.width, this.AABB.height);
    g.beginFill(this.debugColor, 0.25);
    g.drawShape(screen);
    g.endFill();
  }

  getCellsContentMaxWidth(column: number): number {
    let max = 0;
    this.labels.forEach((label) => {
      if (label.location.x === column) {
        max = Math.max(max, label.textWidth);
      }
    });
    return max;
  }

  showLabel(x: number, y: number, show: boolean) {
    const label = this.getLabel(x, y);
    if (label && label.visible !== show) {
      label.visible = show;
      this.dirtyBuffers = true;
    }
  }
}
