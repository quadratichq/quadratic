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
import { sheetHashHeight, sheetHashWidth } from '@/gridGL/cells/CellsTypes';
import { JsRenderCell } from '@/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { renderClient } from '../renderClient';
import { renderCore } from '../renderCore';
import { CellLabel } from './CellLabel';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';

interface TrackClip {
  column: number;
  row: number;
  hashX: number;
  hashY: number;
}

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

  // rebuild CellsTextHash
  dirty: boolean | JsRenderCell[] = true;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // rebuild only buffers
  dirtyBuffers = false;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  loaded = false;

  // screen coordinates
  viewRectangle: Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;

  // keep track of what neighbors we've clipped
  leftClip: TrackClip[] = [];
  rightClip: TrackClip[] = [];

  constructor(cellsLabels: CellsLabels, hashX: number, hashY: number) {
    this.cellsLabels = cellsLabels;
    this.labels = new Map();
    this.labelMeshes = new LabelMeshes(this.cellsLabels.sheetId, hashX, hashY);
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    const offsets = this.cellsLabels.sheetOffsets.getCellOffsets(this.AABB.left, this.AABB.top);
    this.x = offsets.x;
    this.y = offsets.y;
    const end = this.cellsLabels.sheetOffsets.getCellOffsets(this.AABB.right, this.AABB.bottom);
    this.width = end.x + end.w - this.x;
    this.height = end.y + end.h - this.y;
    this.viewRectangle = new Rectangle(this.x, this.y, this.width, this.height);
    this.hashX = hashX;
    this.hashY = hashY;
  }

  // key used to find individual cell labels
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
    return `${cell.x},${cell.y}`;
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.labels.get(`${column},${row}`);
  }

  private createLabel(cell: JsRenderCell): CellLabel {
    const rectangle = this.cellsLabels.getCellOffsets(Number(cell.x), Number(cell.y));
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
    this.labels.forEach((child) => child.updateText(this.labelMeshes));
  }

  overflowClip(): void {
    if (debugShowHashUpdates) console.log(`[CellsTextHash] overflowClip for ${this.hashX}, ${this.hashY}`);
    const bounds = this.cellsLabels.bounds;
    if (!bounds) return;
    const clipLeft: TrackClip[] = [];
    const clipRight: TrackClip[] = [];
    this.labels.forEach((cellLabel) => this.checkClip(cellLabel, clipLeft, clipRight));

    // we need to update any hashes that we may no longer be clipping
    this.leftClip.forEach((clip) => {
      if (
        !clipLeft.find(
          (c) => c.column === clip.column && c.row === clip.row && c.hashX === clip.hashX && c.hashY === clip.hashY
        )
      ) {
        const hash = this.cellsLabels.getCellsHash(clip.hashX, clip.hashY, false);
        if (hash) {
          hash.dirty = true;
        }
      }
    });
    this.rightClip.forEach((clip) => {
      if (
        !clipRight.find(
          (c) => c.column === clip.column && c.row === clip.row && c.hashX === clip.hashX && c.hashY === clip.hashY
        )
      ) {
        const hash = this.cellsLabels.getCellsHash(clip.hashX, clip.hashY, false);
        if (hash) {
          hash.dirty = true;
        }
      }
    });
    this.leftClip = clipLeft;
    this.rightClip = clipRight;
  }

  private checkClip(label: CellLabel, leftClip: TrackClip[], rightClip: TrackClip[]) {
    const bounds = this.cellsLabels.bounds;
    if (!bounds) return;

    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;
    while (column >= bounds.x) {
      if (column < currentHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.cellsLabels.findPreviousHash(column, row);
        if (!currentHash) break;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        const clipRightResult = neighborLabel.checkRightClip(label.AABB.left);
        if (clipRightResult) {
          if (currentHash !== this) {
            leftClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
            if (clipRightResult !== 'same') {
              currentHash.dirty = true;
            }
          }
        }
        const clipLeftResult = label.checkLeftClip(neighborLabel.AABB.right);
        if (clipLeftResult) {
          if (currentHash !== this) {
            rightClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
            if (clipLeftResult !== 'same') {
              currentHash.dirty = true;
            }
          }
        }
        break;
      }
      column--;
    }

    currentHash = this;
    column = label.location.x + 1;
    while (column <= bounds.x + bounds.width) {
      if (column > currentHash.AABB.right) {
        // find hash to the right of current hash (skip over empty hashes)
        currentHash = this.cellsLabels.findNextHash(column, row);
        if (!currentHash) return;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        if (neighborLabel.checkLeftClip(label.AABB.right)) {
          if (currentHash !== this) {
            currentHash.dirty = true;
            rightClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
          }
        }
        if (label.checkRightClip(neighborLabel.AABB.left)) {
          if (currentHash !== this) {
            currentHash.dirty = true;
            leftClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
          }
        }
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
    this.labels.forEach((cellLabel) => cellLabel.updateLabelMesh(this.labelMeshes));

    // prepares the client's CellsTextHash for new content
    renderClient.sendCellsTextHashClear(this.cellsLabels.sheetId, this.hashX, this.hashY, this.viewRectangle);

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
    if (this.loaded) {
      return this.labelMeshes.totalMemory();
    }
    return 0;
  }
}
