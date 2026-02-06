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

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import type { JsCoordinate, JsRenderCell } from '@/app/quadratic-core-types';
import type { Link } from '@/app/shared/types/links';
import type { DrawRects } from '@/app/shared/types/size';
import { colors } from '@/app/theme/colors';
import { CellLabel } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import type { CellsLabels } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsLabels';
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

  // tracks single-cell code cell rectangles that need code outlines
  private codeCellRects: Rectangle[] = [];

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
  }

  // key used to find individual cell labels
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
    return `${cell.x},${cell.y}`;
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.labels.get(`${column},${row}`);
  }

  private createLabel(cell: JsRenderCell) {
    // Check if this cell is part of a merged cell
    const mergeRect = this.cellsLabels.mergeCells.getMergeCellRect(Number(cell.x), Number(cell.y));
    if (mergeRect) {
      // Only render the anchor cell (top-left) of a merged cell
      const isAnchor = Number(cell.x) === Number(mergeRect.min.x) && Number(cell.y) === Number(mergeRect.min.y);
      if (!isAnchor) {
        // Skip rendering non-anchor cells in merged cells
        return;
      }
    }

    let rectangle = this.cellsLabels.getCellOffsets(Number(cell.x), Number(cell.y));

    // Calculate column/row bounds for the cell
    let minCol = Number(cell.x);
    let maxCol = Number(cell.x);
    let minRow = Number(cell.y);
    let maxRow = Number(cell.y);

    // If this is the anchor of a merged cell, use the merged cell rectangle for alignment
    if (mergeRect) {
      // Calculate the screen rectangle for the entire merged cell
      const mergeWidth = Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1;
      const mergeHeight = Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1;
      const screenRectStringified = this.cellsLabels.sheetOffsets.getRectCellOffsets(
        Number(mergeRect.min.x),
        Number(mergeRect.min.y),
        mergeWidth,
        mergeHeight
      );
      const screenRect = JSON.parse(screenRectStringified);
      rectangle = new Rectangle(screenRect.x, screenRect.y, screenRect.w, screenRect.h);

      // Update column/row bounds for merged cell
      minCol = Number(mergeRect.min.x);
      maxCol = Number(mergeRect.max.x);
      minRow = Number(mergeRect.min.y);
      maxRow = Number(mergeRect.max.y);
    }

    const cellLabel = new CellLabel(this.cellsLabels, cell, rectangle, minCol, maxCol, minRow, maxRow);
    this.labels.set(this.getKey(cell), cellLabel);

    // Track single-cell code cells for outline rendering
    if (cell.language) {
      this.codeCellRects.push(rectangle);
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
  }

  private createLabels = (cells: JsRenderCell[]) => {
    this.unload();
    cells.forEach((cell) => this.createLabel(cell));
    this.loaded = true;
  };

  unload = () => {
    if (this.loaded) {
      if (debugFlag('debugShowLoadingHashes')) console.log(`[CellsTextHash] Unloading ${this.hashX}, ${this.hashY}`);
      this.loaded = false;
      this.labels.clear();
      this.special.clear();
      this.labelMeshes.clear();
      this.links = [];
      this.drawRects = [];
      this.overflowGridLines = [];
      this.codeCellRects = [];
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
      this.links,
      this.drawRects,
      this.codeCellRects
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

      if (debugFlag('debugShowHashUpdates')) console.log(`[CellsTextHash] updating ${this.hashX}, ${this.hashY}`);

      if (cells) {
        this.createLabels(cells);
      }

      this.updateText();
      this.updateBuffers();

      return true;
    } else if (this.dirtyText || this.dirtyBuffers) {
      if (debugFlag('debugShowHashUpdates'))
        console.log(`[CellsTextHash] updating text and buffers ${this.hashX}, ${this.hashY}`);

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
      // Only count visible labels for sizing (invisible labels haven't had
      // their text processed, so their heights are not accurate)
      if (!label.visible) return;

      const isMerged = label.minCol !== label.maxCol || label.minRow !== label.maxRow;

      let column = label.location.x;
      let row = label.location.y;

      let width = label.unwrappedTextWidth;
      let maxWidth = Math.max(columnsMax.get(column) ?? 0, width);
      columnsMax.set(column, maxWidth);

      // Skip merged cells for row height calculations; their text is clipped
      // instead of triggering auto-resize
      if (!isMerged) {
        // Use textHeightWithDescenders for row sizing to ensure characters
        // with descenders (g, y, p, q, j) aren't clipped
        let height = label.textHeightWithDescenders;
        let maxHeight = Math.max(rowsMax.get(row) ?? 0, height);
        rowsMax.set(row, maxHeight);
      }
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
    this.special.clear();

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
      // Push link rectangles for both full links and partial hyperlinks
      if (cellLabel.linkRectangles.length > 0) {
        for (const linkRect of cellLabel.linkRectangles) {
          this.links.push({
            pos: cellLabel.location,
            textRectangle: linkRect.rect,
            url: linkRect.url,
            linkText: linkRect.linkText,
            isNakedUrl: linkRect.isNakedUrl,
            spanStart: linkRect.spanStart,
            spanEnd: linkRect.spanEnd,
          });
        }
      }
      // Group horizontal lines by tint color for proper rendering
      const linesByTint = new Map<number, Rectangle[]>();
      for (const { rect, tint } of cellLabel.horizontalLines) {
        const rects = linesByTint.get(tint);
        if (rects) {
          rects.push(rect);
        } else {
          linesByTint.set(tint, [rect]);
        }
      }
      for (const [tint, rects] of linesByTint) {
        this.drawRects.push({ rects, tint });
      }
      // Add link underlines with link color (for partial hyperlinks)
      // Use the pre-calculated underlineY position from linkRectangles
      if (!cellLabel.link && cellLabel.linkRectangles.length > 0) {
        const linkUnderlines = cellLabel.linkRectangles.map(
          (lr) => new Rectangle(lr.rect.x, lr.underlineY, lr.rect.width, 1)
        );
        this.drawRects.push({ rects: linkUnderlines, tint: convertColorStringToTint(colors.link) });
      }
      this.special.addEmojis(cellLabel.emojis);

      // Re-add checkboxes and dropdowns that were cleared above
      if (cellLabel.specialType === 'Checkbox' && cellLabel.checkboxValue !== undefined) {
        const rectangle = this.cellsLabels.getCellOffsets(cellLabel.location.x, cellLabel.location.y);
        this.special.addCheckbox(
          cellLabel.location.x,
          cellLabel.location.y,
          rectangle.left + rectangle.width / 2,
          rectangle.top + rectangle.height / 2,
          cellLabel.checkboxValue
        );
      } else if (cellLabel.specialType === 'List') {
        // Recalculate the full cell rectangle (same as createLabel does)
        const rectangle = this.cellsLabels.getCellOffsets(cellLabel.location.x, cellLabel.location.y);
        // Position dropdown so sprite's right edge aligns with cell's right edge
        // The dropdownRectangle extends left from x, so we pass rectangle.right to maintain
        // the correct clickable area, but the sprite will be positioned at rectangle.right - DROPDOWN_SIZE[0]
        // Actually, looking at main, it just uses rectangle.right for both, so match that exactly
        this.special.addDropdown(cellLabel.location.x, cellLabel.location.y, rectangle.right, rectangle.top);
      }
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
    const mergeCells = this.cellsLabels.mergeCells;

    // calculate grid line overflow after clipping the hash
    this.labels.forEach((cellLabel) => {
      const isOverflowRight = cellLabel.textRight > cellLabel.AABB.right;
      if (isOverflowRight) {
        // get the column from the textRight (which is in screen coordinates)
        const column = offsets.getXPlacement(cellLabel.textRight).index;

        // we need to add all columns that are overlapped by overflow
        // Start from the first column after the cell/merged cell ends
        // For merged cells (either the overflowing cell or the target), add overflow
        // grid lines for ALL rows in the merge range
        for (let row = cellLabel.minRow; row <= cellLabel.maxRow; row++) {
          for (let i = cellLabel.maxCol + 1; i <= column; i++) {
            // Check if the target column contains a merged cell that spans multiple rows
            const targetMerge = mergeCells.getMergeCellRect(i, row);
            if (targetMerge) {
              // Clear grid lines for all rows of the merged cell
              for (let mergeRow = Number(targetMerge.min.y); mergeRow <= Number(targetMerge.max.y); mergeRow++) {
                this.overflowGridLines.push({ x: i, y: mergeRow });
              }
            } else {
              this.overflowGridLines.push({ x: i, y: row });
            }
          }
        }
      }

      const isOverflowLeft = cellLabel.textLeft < cellLabel.AABB.left;
      if (isOverflowLeft) {
        // get the column from the textLeft (which is in screen coordinates)
        const column = offsets.getXPlacement(cellLabel.textLeft).index;

        // we need to add all columns that are overlapped by overflow
        // End at the leftmost column of the cell/merged cell
        // For merged cells (either the overflowing cell or the target), add overflow
        // grid lines for ALL rows in the merge range
        for (let row = cellLabel.minRow; row <= cellLabel.maxRow; row++) {
          for (let i = column + 1; i <= cellLabel.minCol; i++) {
            // Check if the target column contains a merged cell that spans multiple rows
            const targetMerge = mergeCells.getMergeCellRect(i, row);
            if (targetMerge) {
              // Clear grid lines for all rows of the merged cell
              for (let mergeRow = Number(targetMerge.min.y); mergeRow <= Number(targetMerge.max.y); mergeRow++) {
                this.overflowGridLines.push({ x: i, y: mergeRow });
              }
            } else {
              this.overflowGridLines.push({ x: i, y: row });
            }
          }
        }
      }
    });
  };

  private checkClip(label: CellLabel) {
    const bounds = this.cellsLabels.bounds;
    if (!bounds) return;

    // For merged cells, we need to check all rows in the range for neighbors
    // A cell at D2 might overflow into merged cell A1:C3, so we need to check
    // each row (1, 2, 3) for potential neighbors that could clip or be clipped
    for (let row = label.minRow; row <= label.maxRow; row++) {
      // Check left neighbors (start from column before the leftmost column of the cell)
      let column = label.minCol - 1;
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
      // Check right neighbors (start from column after the rightmost column of the cell)
      column = label.maxCol + 1;
      while (column <= bounds.x + bounds.width) {
        if (column > currentHash.AABB.right) {
          // find hash to the right of current hash (skip over empty hashes)
          currentHash = this.cellsLabels.findNextHash(column, row);
          if (!currentHash) break;
        }
        const neighborLabel = currentHash.getLabel(column, row);
        if (neighborLabel) {
          const clipLeftResult = neighborLabel.checkLeftClip(label.AABB.right, this.labelMeshes);
          if (clipLeftResult && currentHash !== this) {
            currentHash.dirtyBuffers = true;
          }
          label.checkRightClip(neighborLabel.AABB.left, this.labelMeshes);
          break;
        }
        column++;
      }
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

    if (changed && debugFlag('debugShowHashUpdates')) {
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
    // Update the hash if it's dirty (needs cell fetch), has dirty cells (array),
    // or just needs text recalculation. This ensures correct width measurement
    // for auto-resize.
    if (visibleOrNeighbor && (this.dirty || this.dirtyText)) {
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
    // Update the hash if it's dirty (needs cell fetch), has dirty cells (array),
    // or just needs text recalculation. This ensures correct height measurement
    // for auto-resize, including cells with newlines.
    if (visibleOrNeighbor && (this.dirty || this.dirtyText)) {
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
