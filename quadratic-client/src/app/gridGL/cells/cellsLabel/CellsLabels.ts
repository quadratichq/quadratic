/**
 * CellsLabels renders all text within a CellsSheet.
 *
 * It is responsible for creating and managing CellsTextHash objects, which is
 * an efficient way of batching cells together to reduce the number of
 * geometries sent to the GPU.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { CellsTextHash } from '@/app/gridGL/cells/cellsLabel/CellsTextHash';
import type { CellsSheet, ErrorMarker, ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsValidationWarning, Pos } from '@/app/quadratic-core-types';
import type { Link } from '@/app/shared/types/links';
import type {
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import type { RenderSpecial } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import type { Point } from 'pixi.js';
import { Container, Graphics, Rectangle } from 'pixi.js';

export class CellsLabels extends Container {
  private cellsSheet: CellsSheet;

  // draws text hashes
  private cellsTextHashes: Container<CellsTextHash>;

  // (hashX, hashY) index into cellsTextHashContainer
  cellsTextHash: Map<string, CellsTextHash>;

  // used to draw debug boxes for cellsTextHash
  private cellsTextDebug: Graphics;
  private cellsTextHashDebug: Container;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.cellsTextHash = new Map();
    this.cellsTextHashes = this.addChild(new Container<CellsTextHash>());
    this.cellsTextDebug = this.addChild(new Graphics());
    this.cellsTextHashDebug = this.addChild(new Container());

    events.on('clickedToCell', this.clickedToCell);
    events.on('mergeCells', this.repositionValidationWarnings);
  }

  destroy() {
    events.off('clickedToCell', this.clickedToCell);
    events.off('mergeCells', this.repositionValidationWarnings);
    super.destroy();
  }

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  private createCellsTextHash(hashX: number, hashY: number, viewRectangle?: Rectangle): CellsTextHash {
    const key = `${hashX},${hashY}`;
    const cellsTextHash = new CellsTextHash(this.sheetId, hashX, hashY, viewRectangle);
    this.cellsTextHash.set(key, cellsTextHash);
    this.cellsTextHashes.addChild(cellsTextHash);
    return cellsTextHash;
  }

  // received a clear message before a new set of labelMeshEntries
  clearCellsTextHash(message: RenderClientCellsTextHashClear) {
    const key = `${message.hashX},${message.hashY}`;
    let cellsTextHash = this.cellsTextHash.get(key);
    const viewRectangle = new Rectangle(
      message.viewRectangle.x,
      message.viewRectangle.y,
      message.viewRectangle.width,
      message.viewRectangle.height
    );
    if (cellsTextHash) {
      cellsTextHash.clearMeshEntries(viewRectangle);
    } else {
      cellsTextHash = this.cellsTextHashes.addChild(
        new CellsTextHash(this.sheetId, message.hashX, message.hashY, viewRectangle)
      );
      this.cellsTextHash.set(key, cellsTextHash);
    }
    cellsTextHash.links = message.links;
    cellsTextHash.newDrawRects = message.drawRects;
    cellsTextHash.newCodeOutlines = message.codeOutlines;
  }

  // received a new LabelMeshEntry to add to a CellsTextHash
  addLabelMeshEntry(message: RenderClientLabelMeshEntry) {
    const key = `${message.hashX},${message.hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (!cellsTextHash) {
      console.warn(`[CellsLabels] labelMeshEntry: cellsTextHash not found for (${message.hashX}, ${message.hashY})`);
      return;
    }
    cellsTextHash.addLabelMeshEntry(message);
  }

  finalizeCellsTextHash(hashX: number, hashY: number, special?: RenderSpecial) {
    const key = `${hashX},${hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (cellsTextHash) {
      cellsTextHash.finalizeLabelMeshEntries(special);

      // refresh viewport if necessary
      if (sheets.current === this.cellsSheet.sheetId) {
        const bounds = pixiApp.viewport.getVisibleBounds();
        const hashBounds = cellsTextHash.bounds.toRectangle();
        if (hashBounds && intersects.rectangleRectangle(hashBounds, bounds)) {
          cellsTextHash.show();
          events.emit('setDirty', { gridLines: true });
        } else {
          cellsTextHash.hide();
        }
      }
    }
  }

  static getHash(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / sheetHashWidth),
      y: Math.floor(y / sheetHashHeight),
    };
  }

  show(bounds: Rectangle) {
    let count = 0;
    if (debugFlag('debugShowCellsHashBoxes')) {
      this.cellsTextDebug.clear();
      this.cellsTextHashDebug.removeChildren();
    }
    this.cellsTextHashes.children.forEach((cellsTextHash) => {
      const hashBounds = cellsTextHash.bounds.toRectangle();
      if (hashBounds && intersects.rectangleRectangle(hashBounds, bounds)) {
        cellsTextHash.show();
        if (debugFlag('debugShowCellsHashBoxes')) {
          cellsTextHash.drawDebugBox(this.cellsTextDebug, this.cellsTextHashDebug);
        }
        count++;
      } else {
        cellsTextHash.hide();
      }
    });
    if (debugFlag('debugShowCellsSheetCulling')) {
      console.log(`[CellsSheet] visible: ${count}/${this.cellsTextHash.size}`);
    }
  }

  // used to render all cellsTextHashes to warm up the GPU
  showAll() {
    this.cellsTextHashes.children.forEach((cellsTextHash) => cellsTextHash.show());
  }

  // adjust headings for all cellsTextHashes impacted by headings changed except
  // for the CellsTextHash that needs to be resized (that will be handled by the
  // renderWebWorker)
  adjustHeadings(column: number | null, row: number | null, delta: number) {
    const hashX = column !== null ? Math.floor(column / sheetHashWidth) : undefined;
    const hashY = row !== null ? Math.floor(row / sheetHashHeight) : undefined;
    this.cellsTextHashes.children.forEach((cellsTextHash) => {
      cellsTextHash.adjust(hashX, hashY, delta);
    });
  }

  async getCellsContentMaxWidth(column: number): Promise<number> {
    return await renderWebWorker.getCellsColumnMaxWidth(this.sheetId, column);
  }

  private getHash(screenX: number, screenY: number, create?: boolean): CellsTextHash | undefined {
    const hashPosition = CellsLabels.getHash(screenX, screenY);
    const hash = this.cellsTextHash.get(`${hashPosition.x},${hashPosition.y}`);
    if (hash) {
      return hash;
    } else if (create) {
      return this.createCellsTextHash(hashPosition.x, hashPosition.y);
    }
  }

  async getCellsContentMaxHeight(row: number): Promise<number> {
    return await renderWebWorker.getCellsRowMaxHeight(this.sheetId, row);
  }

  unload(hashX: number, hashY: number) {
    const key = `${hashX},${hashY}`;
    const cellsTextHash = this.cellsTextHash.get(key);
    if (cellsTextHash) {
      cellsTextHash.clear();
    }
  }

  private clickedToCell = (column: number, row: number, world: Point | true) => {
    if (sheets.current !== this.sheetId) return;
    const hash = this.getHash(column, row);
    if (hash) {
      hash.special.clickedToCell(column, row, world);
    }
    content.validations.clickedToCell(column, row, world);
  };

  // Called when merge cells change to reposition validation warnings
  private repositionValidationWarnings = (sheetId: string) => {
    if (sheetId !== this.sheetId) return;
    this.cellsTextHashes.children.forEach((cellsTextHash) => {
      cellsTextHash.warnings.reposition();
    });
  };

  renderValidationUpdates(validationWarnings: JsValidationWarning[]) {
    validationWarnings.forEach((v) => {
      const { x, y } = v.pos;
      const cellsTextHash = this.getHash(Number(x), Number(y), true);
      if (cellsTextHash) {
        cellsTextHash.warnings.updateWarnings(v);
      }
    });
  }

  renderValidations = (hash: Pos, validationWarnings: JsValidationWarning[]) => {
    const hashX = Number(hash.x);
    const hashY = Number(hash.y);
    const key = `${hashX},${hashY}`;
    let cellsTextHash = this.cellsTextHash.get(key);
    if (!cellsTextHash) {
      cellsTextHash = this.createCellsTextHash(hashX, hashY);
    }
    cellsTextHash.warnings.populate(validationWarnings);
  };

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    const hash = this.getHash(x, y);
    if (hash) {
      return hash.getErrorMarker(x, y);
    }
  }

  intersectsErrorMarkerValidation(world: Point): ErrorValidation | undefined {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in CellsLabels');
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);
    const hash = this.getHash(column, row);
    if (hash) {
      return hash.intersectsErrorMarkerValidation(world);
    }
  }

  intersectsLink(world: Point): Link | undefined {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in CellsLabels');
    const { column, row } = sheet.getColumnRowFromScreen(world.x, world.y);
    const hash = this.getHash(column, row);
    return hash?.intersectsLink(world);
  }
}
