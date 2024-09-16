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
import { DROPDOWN_PADDING, DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { Coordinate } from '@/app/gridGL/types/size';
import { JsRenderCell } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';
import { renderClient } from '../renderClient';
import { renderCore } from '../renderCore';
import { CellLabel } from './CellLabel';
import { CellsLabels } from './CellsLabels';
import { CellsTextHashContent } from './CellsTextHashContent';
import { CellsTextHashSpecial } from './CellsTextHashSpecial';
import { LabelMeshes } from './LabelMeshes';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash {
  private cellsLabels: CellsLabels;

  // holds the glyph meshes for font/style combinations
  private labelMeshes: LabelMeshes;

  // index into the labels by location key (column,row)
  private labels: Map<string, CellLabel>;

  // tracks which grid lines should not be drawn for this hash
  private overflowGridLines: Coordinate[] = [];

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // rebuild CellsTextHash
  dirty: boolean | JsRenderCell[] | 'show' = true;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // update text
  dirtyText = true;

  // rebuild only buffers
  dirtyBuffers = true;

  loaded = false;
  clientLoaded = false;

  // screen coordinates
  viewRectangle: Rectangle;

  special: CellsTextHashSpecial;

  columnsMaxCache?: Map<number, number>;
  rowsMaxCache?: Map<number, number>;

  content: CellsTextHashContent;

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
    this.content = new CellsTextHashContent();
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
    if (cell.special !== 'Checkbox') {
      const cellLabel = new CellLabel(this.cellsLabels, cell, rectangle);
      this.labels.set(this.getKey(cell), cellLabel);
    }
    if (cell.special === 'Checkbox') {
      this.special.addCheckbox(
        Number(cell.x),
        Number(cell.y),
        rectangle.left + rectangle.width / 2,
        rectangle.top + rectangle.height / 2,
        cell.value === 'true'
      );
    } else if (cell.special === 'List') {
      this.special.addDropdown(
        Number(cell.x),
        Number(cell.y),
        rectangle.right + DROPDOWN_SIZE[0] + DROPDOWN_PADDING[0],
        rectangle.top
      );
    }
    this.content.add(cell.x, cell.y);
  }

  private createLabels(cells: JsRenderCell[]) {
    this.labels = new Map();
    this.content.clear();
    cells.forEach((cell) => this.createLabel(cell));
    this.loaded = true;
  }

  unload = () => {
    if (debugShowLoadingHashes) console.log(`[CellsTextHash] Unloading ${this.hashX}, ${this.hashY}`);
    this.loaded = false;
    this.labels.clear();
    this.labelMeshes.clear();
    this.overflowGridLines = [];
  };

  unloadClient = () => {
    if (this.clientLoaded) {
      this.clientLoaded = false;
      renderClient.unload(this.cellsLabels.sheetId, this.hashX, this.hashY);
    }
  };

  sendViewRectangle = () => {
    renderClient.sendCellsTextHashClear(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.viewRectangle,
      this.overflowGridLines,
      this.content.export()
    );
  };

  update = async (): Promise<boolean> => {
    const neighborRect = this.cellsLabels.getViewportNeighborBounds();
    if (!neighborRect) return false;
    const visibleOrNeighbor = intersects.rectangleRectangle(this.viewRectangle, neighborRect);
    if (!this.loaded || this.dirty) {
      // If dirty is true, then we need to get the cells from the server; but we
      // need to keep open the case where we receive new cells after dirty is
      // set to false. Therefore, we keep a local copy of dirty flag and allow
      // the this.dirty to change while fetching the cells.
      const dirty = this.dirty;
      this.dirty = false;
      let cells: JsRenderCell[] | false;
      if (!Array.isArray(dirty) && (!this.loaded || dirty === true)) {
        try {
          cells = await renderCore.getRenderCells(
            this.cellsLabels.sheetId,
            this.AABB.x,
            this.AABB.y,
            this.AABB.width + 1,
            this.AABB.height + 1
          );
        } catch (e) {
          this.dirty = dirty;
          console.warn(`[CellsTextHash] update: Error getting render cells: ${e}`);
          return false;
        }
      } else if (dirty === 'show') {
        // if dirty === 'show' then we only need to update the visibility of the
        // cells. This is used to change visibility of a CellLabel without
        // refetching the cell contents.
        cells = false;
      } else {
        cells = dirty as JsRenderCell[];
        this.special.clear();
      }
      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating ${this.hashX}, ${this.hashY}`);
      if (cells) {
        this.createLabels(cells);
      }
      this.updateText();
      if (visibleOrNeighbor) {
        queueMicrotask(() => this.updateBuffers());
      } else {
        this.dirtyBuffers = true;
        this.unload();
      }
      return true;
    } else if (this.dirtyText) {
      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating text ${this.hashX}, ${this.hashY}`);
      this.updateText();
      if (visibleOrNeighbor) {
        queueMicrotask(() => this.updateBuffers());
      } else {
        this.dirtyBuffers = true;
        this.unload();
      }
      return true;
    } else if (this.dirtyBuffers) {
      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating buffers ${this.hashX}, ${this.hashY}`);
      queueMicrotask(() => {
        this.updateText();
        this.updateBuffers();
      });
      if (!visibleOrNeighbor) {
        this.unload();
      }
      return true;
    } else if (!visibleOrNeighbor) {
      this.unload();
    }
    return false;
  };

  private updateText = () => {
    if (!this.loaded || this.dirty) {
      return;
    }

    this.dirtyText = false;

    this.labelMeshes.clear();
    this.labels.forEach((child) => child.updateText(this.labelMeshes));
    this.overflowClip();

    const columnsMax = new Map<number, number>();
    const rowsMax = new Map<number, number>();
    this.labels.forEach((label) => {
      let column = label.location.x;
      let row = label.location.y;

      let width = label.unwrappedTextWidth;
      let maxWidth = Math.max(columnsMax.get(column) ?? 0, width);
      columnsMax.set(column, maxWidth);

      let height = label.textHeight;
      let maxHeight = Math.max(rowsMax.get(row) ?? 0, height);
      rowsMax.set(row, maxHeight);
    });
    this.columnsMaxCache = columnsMax;
    this.rowsMaxCache = rowsMax;
  };

  private overflowClip = () => {
    if (!this.loaded) return;

    this.labels.forEach((cellLabel) => this.checkClip(cellLabel));

    // calculate grid line overflow after clipping the hash
    this.overflowGridLines = [];
    const offsets = this.cellsLabels.sheetOffsets;
    this.labels.forEach((cellLabel) => {
      const overflowRight = (cellLabel.overflowRight ?? 0) - (cellLabel.clipRight ?? 0);
      if (overflowRight) {
        // get the column from the overflowRight (which is in screen coordinates)
        const label = offsets.getColumnPlacement(cellLabel.location.x).position;
        const column = offsets.getXPlacement(label + overflowRight).index + 1;

        // we need to add all columns that are overlapped
        for (let i = cellLabel.location.x + 1; i <= column; i++) {
          this.overflowGridLines.push({ x: i, y: cellLabel.location.y });
        }
      }

      const overflowLeft = (cellLabel.overflowLeft ?? 0) - (cellLabel.clipLeft ?? 0);
      if (overflowLeft) {
        // get the column from the overflowLeft (which is in screen coordinates)
        const label = offsets.getColumnPlacement(cellLabel.location.x).position;
        const column = offsets.getXPlacement(label - overflowLeft).index + 1;

        // we need to add all columns that are overlapped
        for (let i = column; i <= cellLabel.location.x; i++) {
          this.overflowGridLines.push({ x: i, y: cellLabel.location.y });
        }
      }
    });
  };

  private checkClip(label: CellLabel) {
    const bounds = this.cellsLabels.bounds;
    if (!bounds) return;
    let column = label.location.x - 1;
    let row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;
    while (column >= bounds.x) {
      if (column < currentHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.cellsLabels.findPreviousHash(column, row);
        if (!currentHash) break;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        const clipRightResult = neighborLabel.checkRightClip(label.AABB.left, this.labelMeshes);
        if (clipRightResult && currentHash !== this) {
          currentHash.dirtyBuffers = true;
        }
        label.checkLeftClip(neighborLabel.AABB.right, this.labelMeshes);
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
        const clipLeftResult = neighborLabel.checkLeftClip(label.AABB.right, this.labelMeshes);
        if (clipLeftResult && currentHash !== this) {
          currentHash.dirtyBuffers = true;
        }
        label.checkRightClip(neighborLabel.AABB.left, this.labelMeshes);
        return;
      }
      column++;
    }
  }

  private updateBuffers = (): void => {
    if (!this.loaded) {
      this.sendViewRectangle();
      return;
    }
    this.dirtyBuffers = false;

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

    this.special.extendViewRectangle(this.viewRectangle);

    // prepares the client's CellsTextHash for new content
    renderClient.sendCellsTextHashClear(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.viewRectangle,
      this.overflowGridLines,
      this.content.export()
    );

    // completes the rendering for the CellsTextHash
    this.labelMeshes.finalize();

    // signals that all updates have been sent to the client
    renderClient.finalizeCellsTextHash(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.special.isEmpty() ? undefined : this.special.special
    );

    this.clientLoaded = true;
  };

  adjustHeadings = (options: { delta: number; column?: number; row?: number }): boolean => {
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
      this.special.adjustWidth(column, delta);
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
  };

  getCellsContentMaxWidth = async (column: number): Promise<number> => {
    const columnsMax = await this.getColumnContentMaxWidths();
    return columnsMax.get(column) ?? 0;
  };

  getColumnContentMaxWidths = async (): Promise<Map<number, number>> => {
    const neighborRect = this.cellsLabels.getViewportNeighborBounds();
    if (!neighborRect) return this.columnsMaxCache ?? new Map();
    const visibleOrNeighbor = intersects.rectangleRectangle(this.viewRectangle, neighborRect);
    if (visibleOrNeighbor && (Array.isArray(this.dirty) || (this.loaded && !this.dirty && this.dirtyText))) {
      await this.update();
    }
    return this.columnsMaxCache ?? new Map();
  };

  getCellsContentMaxHeight = async (row: number): Promise<number> => {
    const rowsMax = await this.getRowContentMaxHeights();
    return rowsMax.get(row) ?? 0;
  };

  getRowContentMaxHeights = async (): Promise<Map<number, number>> => {
    const neighborRect = this.cellsLabels.getViewportNeighborBounds();
    if (!neighborRect) return this.rowsMaxCache ?? new Map();
    const visibleOrNeighbor = intersects.rectangleRectangle(this.viewRectangle, neighborRect);
    if (visibleOrNeighbor && (Array.isArray(this.dirty) || (this.loaded && !this.dirty && this.dirtyText))) {
      await this.update();
    }
    return this.rowsMaxCache ?? new Map();
  };

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
