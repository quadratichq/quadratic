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
import { intersects } from '@/app/gridGL/helpers/intersects';
import type { JsCoordinate, JsRenderCell } from '@/app/quadratic-core-types';
import type { Link } from '@/app/shared/types/links';
import type { DrawRects } from '@/app/shared/types/size';
import { CellLabel } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import type { CellsLabels } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsLabels';
import { CellsTextHashContent } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashContent';
import { CellsTextHashSpecial } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { LabelMeshes } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMeshes';
import { renderClient } from '@/app/web-workers/renderWebWorker/worker/renderClient';
import { renderCore } from '@/app/web-workers/renderWebWorker/worker/renderCore';
import { Rectangle } from 'pixi.js';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash {
  private cellsLabels: CellsLabels;

  // holds the glyph meshes for font/style combinations
  private labelMeshes: LabelMeshes;

  // index into the labels by location key (column,row)
  private labels: Map<string, CellLabel>;

  // tracks which grid lines should not be drawn for this hash
  private overflowGridLines: JsCoordinate[] = [];

  private drawRects: DrawRects[] = [];

  // tracks which cells have links
  private links: Link[] = [];

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // rebuild CellsTextHash
  dirty: boolean | JsRenderCell[] | 'show' = true;

  // todo: not sure if this is still used as I ran into issues with only rendering buffers:

  // update text
  dirtyText = false;

  // rebuild only buffers
  dirtyBuffers = false;

  private _loaded = false;
  private _clientLoaded = false;

  // screen coordinates
  viewRectangle: Rectangle;

  private special: CellsTextHashSpecial;

  private columnsMaxCache?: Map<number, number>;
  private rowsMaxCache?: Map<number, number>;

  private content: CellsTextHashContent;

  renderCellsReceivedTime = 0;

  get loaded(): boolean {
    return this._loaded;
  }

  private set loaded(value: boolean) {
    this._loaded = value;
  }

  get clientLoaded(): boolean {
    return this._clientLoaded;
  }

  private set clientLoaded(value: boolean) {
    this._clientLoaded = value;
  }

  constructor(cellsLabels: CellsLabels, hashX: number, hashY: number) {
    this.cellsLabels = cellsLabels;
    this.labels = new Map();
    this.labelMeshes = new LabelMeshes(this.cellsLabels.sheetId, hashX, hashY);
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    if (this.AABB.x <= 0) {
      this.AABB.width += this.AABB.x - 1;
      this.AABB.x = 1;
    }
    if (this.AABB.y <= 0) {
      this.AABB.height += this.AABB.y - 1;
      this.AABB.y = 1;
    }
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
      this.special.addDropdown(Number(cell.x), Number(cell.y), rectangle.right, rectangle.top);
    }
    this.content.add(cell.x, cell.y);
  }

  private createLabels = (cells: JsRenderCell[]) => {
    this.unload();
    cells.forEach((cell) => this.createLabel(cell));
    this.loaded = true;
  };

  unload = () => {
    if (this.loaded) {
      if (debugShowLoadingHashes) console.log(`[CellsTextHash] Unloading ${this.hashX}, ${this.hashY}`);
      this.loaded = false;
      this.labels.clear();
      this.special.clear();
      this.content.clear();
      this.labelMeshes.clear();
      this.links = [];
      this.drawRects = [];
      this.overflowGridLines = [];
    }
  };

  unloadClient = () => {
    if (this.clientLoaded) {
      this.clientLoaded = false;
      renderClient.unload(this.cellsLabels.sheetId, this.hashX, this.hashY);
    }
  };

  sendCellsTextHashClear = () => {
    renderClient.sendCellsTextHashClear(
      this.cellsLabels.sheetId,
      this.hashX,
      this.hashY,
      this.viewRectangle,
      this.overflowGridLines,
      this.content.export(),
      this.links,
      this.drawRects
    );
  };

  update = async (isTransactionRunning: boolean, abortSignal?: AbortSignal): Promise<boolean> => {
    if (!this.loaded || this.dirty) {
      // If dirty is true, then we need to get the cells from the server; but we
      // need to keep open the case where we receive new cells after dirty is
      // set to false. Therefore, we keep a local copy of dirty flag and allow
      // the this.dirty to change while fetching the cells.
      const dirty = this.dirty;
      this.dirty = false;

      const dirtyText = this.dirtyText;
      this.dirtyText = true;

      const dirtyBuffers = this.dirtyBuffers;
      this.dirtyBuffers = true;

      let cells: JsRenderCell[] | false = false;
      if (Array.isArray(dirty)) {
        cells = dirty;
      } else if (!this.loaded || dirty === true) {
        if (isTransactionRunning) {
          return false;
        }

        try {
          cells = await renderCore.getRenderCells(
            this.cellsLabels.sheetId,
            this.AABB.x,
            this.AABB.y,
            this.AABB.width + 1,
            this.AABB.height + 1,
            abortSignal
          );
          this.renderCellsReceivedTime = performance.now();
        } catch (_) {
          this.dirty = dirty;
          this.dirtyText = dirtyText;
          this.dirtyBuffers = dirtyBuffers;
          return false;
        }
      } else if (dirty === 'show') {
        // if dirty === 'show' then we only need to update the visibility of the
        // cells. This is used to change visibility of a CellLabel without
        // refetching the cell contents.
        cells = false;
      }

      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating ${this.hashX}, ${this.hashY}`);

      if (cells) {
        this.createLabels(cells);
      }

      this.updateText();
      this.updateBuffers();

      return true;
    } else if (this.dirtyText || this.dirtyBuffers) {
      if (debugShowHashUpdates) console.log(`[CellsTextHash] updating text and buffers ${this.hashX}, ${this.hashY}`);

      this.updateText();
      this.updateBuffers();

      return true;
    }
    return false;
  };

  updateText = () => {
    this.dirtyText = false;

    if (!this.loaded || this.dirty) {
      return;
    }

    this.labelMeshes.clear();
    this.labels.forEach((label) => label.updateText(this.labelMeshes));

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

  updateBuffers = (): void => {
    this.dirtyBuffers = false;

    if (!this.loaded || this.dirty || this.dirtyText) {
      this.sendCellsTextHashClear();
      return;
    }

    this.links = [];
    this.drawRects = [];

    this.labels.forEach((cellLabel) => this.checkClip(cellLabel));

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
      if (cellLabel.link) {
        this.links.push({ pos: cellLabel.location, textRectangle: cellLabel.textRectangle });
      }
      this.drawRects.push({ rects: cellLabel.horizontalLines, tint: cellLabel.tint });
    });
    if (minX !== Infinity && minY !== Infinity) {
      this.viewRectangle.x = minX;
      this.viewRectangle.y = minY;
      this.viewRectangle.width = maxX - minX;
      this.viewRectangle.height = maxY - minY;
    }

    this.overflowClip();

    this.special.extendViewRectangle(this.viewRectangle);

    // prepares the client's CellsTextHash for new content
    this.sendCellsTextHashClear();

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

  private overflowClip = () => {
    this.overflowGridLines = [];

    const offsets = this.cellsLabels.sheetOffsets;

    // calculate grid line overflow after clipping the hash
    this.labels.forEach((cellLabel) => {
      const isOverflowRight = cellLabel.textRight > cellLabel.AABB.right;
      if (isOverflowRight) {
        // get the column from the textRight (which is in screen coordinates)
        const column = offsets.getXPlacement(cellLabel.textRight).index;

        // we need to add all columns that are overlapped
        for (let i = cellLabel.location.x + 1; i <= column; i++) {
          this.overflowGridLines.push({ x: i, y: cellLabel.location.y });
        }
      }

      const isOverflowLeft = cellLabel.textLeft < cellLabel.AABB.left;
      if (isOverflowLeft) {
        // get the column from the textLeft (which is in screen coordinates)
        const column = offsets.getXPlacement(cellLabel.textLeft).index;

        // we need to add all columns that are overlapped
        for (let i = column + 1; i <= cellLabel.location.x; i++) {
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

    const specialsChanged = this.special.adjustHeadings(options);

    changed = changed || specialsChanged;

    if (changed && debugShowHashUpdates) {
      console.log(
        `[CellsTextHash] adjustHeadings for ${this.hashX}, ${this.hashY} because of changes in column: ${column}, row: ${row}`
      );
    }

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
      await this.update(true);
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
      await this.update(true);
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
