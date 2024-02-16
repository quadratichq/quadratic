/**
 * Interface between the core webworker and quadratic-core
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, Pos, Rect } from '@/quadratic-core/quadratic_core';
import { JsCodeCell, JsRenderCell, JsRenderCodeCell, JsRenderFill } from '@/quadratic-core/types';
import { ClientCoreLoad, GridMetadata } from '../coreClientMessages';
import { GridRenderMetadata } from '../coreRenderMessages';
import { coreClient } from './coreClient';
import { coreRender } from './coreRender';
import { pointsToRect } from './rustConversions';

class Core {
  gridController?: GridController;

  private async loadGridFile(file: string) {
    const res = await fetch(file);
    return await res.text();
  }

  // Creates a Grid form a file. Initializes bother coreClient and coreRender w/metadata.
  async loadFile(message: ClientCoreLoad, renderPort: MessagePort) {
    const results = await Promise.all([this.loadGridFile(message.url), init()]);
    this.gridController = GridController.newFromFile(results[0], message.sequenceNumber);

    if (debugWebWorkers) console.log('[core] GridController loaded');

    const sheetIds = this.getSheetIds();

    // initialize Client with relevant Core metadata
    const metadata: GridMetadata = { undo: false, redo: false, sheets: {} };
    sheetIds.forEach((sheetId) => {
      metadata.sheets[sheetId] = {
        offsets: this.getSheetOffsets(sheetId),
        bounds: this.getGridBounds({ sheetId, ignoreFormatting: false }),
        boundsNoFormatting: this.getGridBounds({ sheetId, ignoreFormatting: true }),
        name: this.getSheetName(sheetId),
        order: this.getSheetOrder(sheetId),
        color: this.getSheetColor(sheetId),
      };
    });
    coreClient.init(message.id, metadata);

    // initialize RenderWebWorker with relevant Core metadata
    const renderMetadata: GridRenderMetadata = {};
    sheetIds.forEach((sheetId) => {
      renderMetadata[sheetId] = {
        offsets: this.getSheetOffsets(sheetId),
        bounds: this.getGridBounds({ sheetId, ignoreFormatting: true }),
      };
    });
    coreRender.init(renderMetadata, renderPort);
  }

  getSheetName(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetName');
      return '';
    }
    return this.gridController.getSheetName(sheetId);
  }

  getSheetOrder(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetOrder');
      return '';
    }
    return this.gridController.getSheetOrder(sheetId);
  }

  getSheetColor(sheetId: string) {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetColor');
      return '';
    }
    return this.gridController.getSheetColor(sheetId);
  }

  // Gets the bounds of a sheet.
  getGridBounds(data: {
    sheetId: string;
    ignoreFormatting: boolean;
  }): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridBounds');
      return;
    }

    const bounds = this.gridController.getGridBounds(data.sheetId, data.ignoreFormatting);
    if (bounds.type === 'empty') {
      return;
    }
    return {
      x: bounds.min.x,
      y: bounds.min.y,
      width: bounds.max.x - bounds.min.x,
      height: bounds.max.y - bounds.min.y,
    };
  }

  // Gets RenderCell[] for a region of a Sheet.
  getRenderCells(data: { sheetId: string; x: number; y: number; width: number; height: number }): JsRenderCell[] {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridBounds');
      return [];
    }

    const cells = this.gridController.getRenderCells(
      data.sheetId,
      pointsToRect(data.x, data.y, data.width, data.height)
    );
    return JSON.parse(cells);
  }

  // Gets the SheetIds for the Grid.
  getSheetIds(): string[] {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getSheetIds');
      return [];
    }

    return JSON.parse(this.gridController.getSheetIds());
  }

  getSheetOffsets(sheetId: string): string {
    if (!this.gridController) {
      console.warn('Expected gridController to be defined in Core.getGridOffsets');
      return '';
    }

    return this.gridController.exportOffsets(sheetId);
  }

  getCodeCell(sheetId: string, x: number, y: number): JsCodeCell | undefined {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.getCodeCell(sheetId, new Pos(x, y));
  }

  getAllRenderFills(sheetId: string): JsRenderFill[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return JSON.parse(this.gridController.getAllRenderFills(sheetId));
  }

  getRenderCodeCells(sheetId: string): JsRenderCodeCell[] {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return JSON.parse(this.gridController.getAllRenderCodeCells(sheetId));
  }

  cellHasContent(sheetId: string, x: number, y: number): boolean {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    return this.gridController.hasRenderCells(sheetId, new Rect(new Pos(x, y), new Pos(x, y)));
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    if (!this.gridController) throw new Error('Expected gridController to be defined');
    this.gridController.setCellValue(sheetId, new Pos(x, y), value, cursor);
  }
}

export const core = new Core();
