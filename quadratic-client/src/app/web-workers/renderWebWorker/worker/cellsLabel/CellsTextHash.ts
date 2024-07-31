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

import { debugShowHashUpdates, debugShowLoadingHashes } from '@/app/debugFlags';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { JsRenderCell } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { renderClient } from '../renderClient';
import { renderCore } from '../renderCore';
import { CellLabel } from './CellLabel';
import { CellsLabels } from './CellsLabels';
import { LabelMeshes } from './LabelMeshes';
import { CellsTextHashSpecial } from './CellsTextHashSpecial';

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
  dirty: boolean | JsRenderCell[] | 'show' = true;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // rebuild only buffers
  dirtyBuffers = false;

  loaded = false;

  // screen coordinates
  viewRectangle: Rectangle;

  special: CellsTextHashSpecial;

  // keep track of what neighbors we've clipped
  leftClip: TrackClip[] = [];
  rightClip: TrackClip[] = [];

  constructor(cellsLabels: CellsLabels, hashX: number, hashY: number) {
    this.cellsLabels = cellsLabels;
    this.labels = new Map();
    this.labelMeshes = new LabelMeshes(this.cellsLabels.sheetId, hashX, hashY);
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    const screenRectStringified = this.cellsLabels.sheetOffsets.getRectCellOffsets(
      this.AABB.left,
      this.AABB.top,
      sheetHashWidth,
      sheetHashHeight
    );
    const screenRect = JSON.parse(screenRectStringified);
    this.viewRectangle = new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
    this.hashX = hashX;
    this.hashY = hashY;
    this.special = new CellsTextHashSpecial();
  }

  // key used to find individual cell labels
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
    return `${cell.x},${cell.y}`;
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.labels.get(`${column},${row}`);
  }

  private createLabel(cell: JsRenderCell) {
    const rectangle = this.cellsLabels.getCellOffsets(Number(cell.x), Number(cell.y));
    const cellLabel = new CellLabel(this.cellsLabels, cell, rectangle);
    this.labels.set(this.getKey(cell), cellLabel);
    if (cell.special === 'Checkbox') {
      this.special.addCheckbox(
        rectangle.left + rectangle.width / 2,
        rectangle.top + rectangle.height / 2,
        cell.value === 'true'
      );
    } else if (cell.special === 'List') {
      this.special.addDropdown(rectangle.right, rectangle.top);
    }
  }

  async createLabels(cells: JsRenderCell[]) {
    this.labels = new Map();
    cells.forEach((cell) => this.createLabel(cell));
    this.updateText();
  }

  unload() {
    if (debugShowLoadingHashes) console.log(`[CellsTextHash] Unloading ${this.hashX}, ${this.hashY}`);
    this.loaded = false;
    this.dirty = true;
    renderClient.unload(this.cellsLabels.sheetId, this.hashX, this.hashY);
  }

  sendViewRectangle() {
    renderClient.sendCellsTextHashClear(this.cellsLabels.sheetId, this.hashX, this.hashY, this.viewRectangle);
  }

  async update(): Promise<boolean> {
    if (this.dirty) {
      // If dirty is true, then we need to get the cells from the server; but we
      // need to keep open the case where we receive new cells after dirty is
      // set to false. Therefore, we keep a local copy of dirty flag and allow
      // the this.dirty to change while fetching the cells.
      const dirty = this.dirty;
      this.dirty = false;
      let cells: JsRenderCell[] | false;
      if (dirty === true) {
        cells = await renderCore.getRenderCells(
          this.cellsLabels.sheetId,
          this.AABB.x,
          this.AABB.y,
          this.AABB.width + 1,
          this.AABB.height + 1
        );
      } else if (dirty === 'show') {
        // if dirty === 'show' then we only need to update the visibility of the
        // cells. This is used to change visibility of a CellLabel without
        // refetching the cell contents.
        cells = false;
      } else {
        cells = dirty as JsRenderCell[];
      }

      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating ${this.hashX}, ${this.hashY}`);
      if (cells) {
        await this.createLabels(cells);
      }
      this.overflowClip();
      this.updateBuffers();
      return true;
    } else if (this.dirtyBuffers) {
      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating only buffers ${this.hashX}, ${this.hashY}`);
      this.updateBuffers();
      return true;
    }
    return false;
  }

  private updateText() {
    this.labelMeshes.clear();
    this.labels.forEach((child) => child.updateText(this.labelMeshes));
  }

  overflowClip(): Set<CellsTextHash> {
    const bounds = this.cellsLabels.bounds;
    if (!bounds) return new Set();
    const clipLeft: TrackClip[] = [];
    const clipRight: TrackClip[] = [];
    this.labels.forEach((cellLabel) => this.checkClip(cellLabel, clipLeft, clipRight));

    const updatedHashes = new Set<CellsTextHash>();

    // we need to update any hashes that we may no longer be clipping
    this.leftClip.forEach((clip) => {
      if (
        !clipLeft.find(
          (c) => c.column === clip.column && c.row === clip.row && c.hashX === clip.hashX && c.hashY === clip.hashY
        )
      ) {
        const hash = this.cellsLabels.getCellsHash(clip.hashX, clip.hashY, false);
        if (hash) {
          updatedHashes.add(hash);
          hash.dirtyBuffers = true;
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
          updatedHashes.add(hash);
          hash.dirtyBuffers = true;
        }
      }
    });
    this.leftClip = clipLeft;
    this.rightClip = clipRight;

    return updatedHashes;
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
        if (clipRightResult && currentHash !== this) {
          leftClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
          if (clipRightResult !== 'same') {
            currentHash.dirty = true;
          }
        }
        label.checkLeftClip(neighborLabel.AABB.right);
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
        const clipLeftResult = neighborLabel.checkLeftClip(label.AABB.right);
        if (clipLeftResult && currentHash !== this) {
          rightClip.push({ row, column, hashX: currentHash.hashX, hashY: currentHash.hashY });
          if (clipLeftResult !== 'same') {
            currentHash.dirty = true;
          }
        }
        label.checkRightClip(neighborLabel.AABB.left);
        return;
      }
      column++;
    }
  }

  updateBuffers(): void {
    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare();

    // populate labelMeshes webGL buffers
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.labels.forEach((cellLabel) => {
      const bounds = cellLabel.updateLabelMesh(this.labelMeshes);
      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    });
    if (minX !== Infinity && minY !== Infinity) {
      this.viewRectangle.x = minX;
      this.viewRectangle.y = minY;
      this.viewRectangle.width = maxX - minX;
      this.viewRectangle.height = maxY - minY;
    }

    // prepares the client's CellsTextHash for new content
    renderClient.sendCellsTextHashClear(this.cellsLabels.sheetId, this.hashX, this.hashY, this.viewRectangle);

    // completes the rendering for the CellsTextHash
    this.labelMeshes.finalize();

    // signals that all updates have been sent to the client
    renderClient.finalizeCellsTextHash(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.special.isEmpty() ? undefined : this.special.special
    );

    this.loaded = true;
    this.dirtyBuffers = false;
  }

  adjustHeadings(options: { delta: number; column?: number; row?: number }): boolean {
    const { delta, column, row } = options;
    let changed = false;
    if (column !== undefined) {
      if (this.AABB.x < 0) {
        this.viewRectangle.x += delta;
      } else if (this.AABB.x > 0 && this.AABB.x > column) {
        this.viewRectangle.x -= delta;
      }
      this.viewRectangle.width -= delta;

      this.labels.forEach((label) => {
        if (label.location.x === column) {
          label.adjustWidth(delta, column < 0);
          changed = true;
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
      if (this.AABB.y < 0 && this.AABB.y <= row) {
        this.viewRectangle.y += delta;
      } else if (this.AABB.y > 0 && this.AABB.y > row) {
        this.viewRectangle.y -= delta;
      }
      this.viewRectangle.height += delta;

      this.labels.forEach((label) => {
        if (label.location.y === row) {
          label.adjustHeight(delta, row < 0);
          changed = true;
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

  showLabel(x: number, y: number, show: boolean) {
    const label = this.labels.get(`${x},${y}`);
    if (label) {
      label.visible = show;
      // only cause a simple redraw if dirty is not already set
      if (this.dirty === false) {
        this.dirty = 'show';
      }
    }
  }
}
