/**
 * Interface between the core webworker and quadratic-core
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import init, { GridController, hello } from '@/quadratic-core/quadratic_core';
import { JsRenderCell } from '@/quadratic-core/types';
import { CoreClientLoad } from '../coreClientMessages';
import { GridMetadata } from '../coreMessages';
import { coreClient } from './coreClient';
import { coreRender } from './coreRender';
import { pointsToRect } from './rustConversions';

class Core {
  private gridController?: GridController;

  // Creates a Grid form a file. Also connects the MessagePort for coreRender to
  // speak with this web worker.
  async newFromFile(data: CoreClientLoad, renderPort: MessagePort) {
    await init();
    hello();

    this.gridController = GridController.newFromFile(data.contents, data.lastSequenceNum);
    if (debugWebWorkers) console.log('[core] GridController loaded');

    const sheetIds = this.getSheetIds();
    const metadata: GridMetadata = {};
    sheetIds.forEach((sheetId) => {
      metadata[sheetId] = {
        offsets: this.getSheetOffsets(sheetId),
        bounds: this.getGridBounds({ sheetId, ignoreFormatting: false }),
        boundsNoFormatting: this.getGridBounds({ sheetId, ignoreFormatting: true }),
      };
    });
    coreClient.init(metadata);
    coreRender.init(metadata, renderPort);
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
}

export const core = new Core();
