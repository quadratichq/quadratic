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

import { debugShowHashUpdates, debugShowLoadingHashes } from '@/debugFlags';
import { Bounds } from '@/grid/sheet/Bounds';
import { sheetHashHeight, sheetHashWidth } from '@/gridGL/cells/CellsTypes';
import { JsRenderCell } from '@/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { renderClient } from '../renderClient';
import { renderCore } from '../renderCore';
import { CellLabel } from './CellLabel';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash {
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

  // rebuild CellsTextHash
  dirty: boolean | JsRenderCell[] = true;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // rebuild only buffers
  dirtyBuffers = false;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  loaded = false;

  viewRectangle: Rectangle;

  constructor(cellsLabels: CellsLabels, hashX: number, hashY: number) {
    this.cellsLabels = cellsLabels;
    this.labels = new Map();
    this.labelMeshes = new LabelMeshes(this.cellsLabels.sheetId, hashX, hashY);
    this.viewBounds = new Bounds();
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    const offsets = this.cellsLabels.sheetOffsets.getCellOffsets(this.AABB.x, this.AABB.y);
    const x = offsets.x;
    const y = offsets.y;
    const end = this.cellsLabels.sheetOffsets.getCellOffsets(this.AABB.right, this.AABB.bottom);
    const width = end.x + end.w - x;
    const height = end.y + end.h - y;
    this.viewRectangle = new Rectangle(x, y, width, height);
    this.hashX = hashX;
    this.hashY = hashY;
  }

  // key used to find individual cell labels
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
    return `${cell.x},${cell.y}`;
  }

  findPreviousHash(column: number, row: number): CellsTextHash | undefined {
    return this.cellsLabels.findPreviousHash(column, row);
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.labels.get(`${column},${row}`);
  }

  private createLabel(cell: JsRenderCell): CellLabel {
    const rectangle = this.cellsLabels.getCellOffsets(Number(cell.x), Number(cell.y));

    // adjust each label so the origin is 0,0 relative to the textHash
    rectangle.x -= this.viewRectangle.x;
    rectangle.y -= this.viewRectangle.y;

    const cellLabel = new CellLabel(this.cellsLabels, cell, rectangle);
    this.labels.set(this.getKey(cell), cellLabel);
    return cellLabel;
  }

  async createLabels() {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] createLabels for ${this.hashX}, ${this.hashY}`);
    this.labels = new Map();
    const cells =
      this.dirty !== true
        ? (this.dirty as JsRenderCell[])
        : await renderCore.getRenderCells(
            this.cellsLabels.sheetId,
            this.AABB.x,
            this.AABB.y,
            this.AABB.width,
            this.AABB.height
          );
    cells.forEach((cell) => this.createLabel(cell));
    this.updateText();
  }

  unload() {
    if (debugShowLoadingHashes) console.log(`[CellsTextHash] Unloading ${this.hashX}, ${this.hashY}`);
    this.loaded = false;
    this.dirty = true;
    renderClient.unload(this.cellsLabels.sheetId, this.hashX, this.hashY);
  }

  async update(): Promise<boolean> {
    if (this.dirty) {
      await this.createLabels();
      this.overflowClip();
      this.updateBuffers(); // false
      this.dirty = false;
      this.dirtyBuffers = false;
      return true;
    } else if (this.dirtyBuffers) {
      this.updateBuffers(); // true
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
    const bounds = this.cellsLabels.bounds;

    // empty when there are no cells
    if (!bounds) return;

    if (debugShowHashUpdates) console.log(`[CellsTextHash] overflowClip for ${this.hashX}, ${this.hashY}`);
    this.labels.forEach((cellLabel) => this.checkClip(bounds, cellLabel));
  }

  private checkClip(bounds: { x: number; y: number; width: number; height: number }, label: CellLabel): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] checkClip for ${this.hashX}, ${this.hashY}`);
    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;

    while (column >= bounds.x) {
      if (column < currentHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.findPreviousHash(column, row);
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
    while (column <= bounds.x + bounds.width) {
      if (column > currentHash.AABB.right) {
        // find hash to the right of current hash (skip over empty hashes)
        currentHash = this.cellsLabels.findNextHash(column, row);
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

  updateBuffers(skipClear?: boolean): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] updateBuffers for ${this.hashX}, ${this.hashY}`);

    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare();

    // populate labelMeshes webGL buffers
    this.viewBounds.clear();
    this.labels.forEach((cellLabel) => {
      const bounds = cellLabel.updateLabelMesh(this.labelMeshes);
      this.viewBounds.mergeInto(bounds);
    });

    // adjust viewRectangle by viewBounds overflow
    // this.viewRectangle = this.rawViewRectangle.clone();
    // if (this.viewBounds.minX < this.viewRectangle.left) {
    //   this.viewRectangle.width += this.viewRectangle.left - this.viewBounds.minX;
    //   this.viewRectangle.x = this.viewBounds.minX;
    // }
    // if (this.viewBounds.maxX > this.viewRectangle.right) {
    //   this.viewRectangle.width += this.viewBounds.maxX - this.viewRectangle.right;
    // }
    // if (this.viewBounds.minY < this.viewRectangle.top) {
    //   this.viewRectangle.height += this.viewRectangle.top - this.viewBounds.minY;
    //   this.viewRectangle.y = this.viewBounds.minY;
    // }
    // if (this.viewBounds.maxY > this.viewRectangle.bottom) {
    //   this.viewRectangle.height += this.viewBounds.maxY - this.viewRectangle.bottom;
    // }

    // prepares the client's CellsTextHash for new content
    renderClient.sendCellsTextHashClear(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.viewBounds,
      this.viewRectangle.x,
      this.viewRectangle.y
    );

    // completes the rendering for the CellsTextHash
    this.labelMeshes.finalize();

    // signals that all updates have been sent to the client
    renderClient.finalizeCellsTextHash(this.cellsLabels.sheetId, this.hashX, this.hashY);

    this.loaded = true;
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
              label.adjustX(delta);
              changed = true;
            }
          } else {
            if (label.location.x > column) {
              label.adjustX(-delta);
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
              label.adjustY(delta);
              changed = true;
            }
          } else {
            if (label.location.y > row) {
              label.adjustY(-delta);
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

  getCellsContentMaxWidth(column: number): number {
    let max = 0;
    this.labels.forEach((label) => {
      if (label.location.x === column) {
        max = Math.max(max, label.textWidth);
      }
    });
    return max;
  }

  totalMemory(): number {
    return this.labelMeshes.totalMemory();
  }
}
