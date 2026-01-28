/**
 * RenderClient communicates between the main thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { Link } from '@/app/shared/types/links';
import type { DrawRects } from '@/app/shared/types/size';
import type {
  ClientRenderMessage,
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
  RenderClientMessage,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { RenderSpecial } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { renderCore } from '@/app/web-workers/renderWebWorker/worker/renderCore';
import { renderText } from '@/app/web-workers/renderWebWorker/worker/renderText';
import { Rectangle } from 'pixi.js';

declare var self: WorkerGlobalScope & typeof globalThis;

class RenderClient {
  tableColumnHeaderForeground = 0;

  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<ClientRenderMessage>) => {
    if (debugFlag('debugWebWorkersMessages') && e.data.type !== 'clientRenderViewport') {
      console.log(`[renderClient] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'clientRenderBitmapFonts':
        renderText.clientInit(e.data.bitmapFonts);
        return;

      case 'clientRenderInit':
        renderCore.clientInit(e.ports[0]);
        this.tableColumnHeaderForeground = e.data.tableColumnHeaderForeground;
        return;

      case 'clientRenderViewport':
        const startUpdate = !renderText.viewport;
        renderText.viewport = new Rectangle(
          e.data.bounds.x,
          e.data.bounds.y,
          e.data.bounds.width,
          e.data.bounds.height
        );
        renderText.sheetId = e.data.sheetId;
        renderText.scale = e.data.scale;
        if (startUpdate) renderText.ready();
        renderText.updateViewportBuffer();
        return;

      case 'clientRenderSheetOffsetsTransient':
        renderText.sheetOffsetsDelta(e.data.sheetId, e.data.column, e.data.row, e.data.delta);
        return;

      case 'clientRenderShowLabel':
        renderText.showLabel(e.data.sheetId, e.data.x, e.data.y, e.data.show);
        return;

      case 'clientRenderColumnMaxWidth':
        this.sendColumnMaxWidth(e.data.id, e.data.sheetId, e.data.column);
        return;

      case 'clientRenderRowMaxHeight':
        this.sendRowMaxHeight(e.data.id, e.data.sheetId, e.data.row);
        return;

      default:
        // ignore messages from react dev tools
        if (!(e.data as any)?.source) {
          console.warn('[renderClient] Unhandled message type', e.data);
        }
    }
  };

  private send(message: RenderClientMessage) {
    self.postMessage(message);
  }

  // sends a message to the main thread to update the cellsTextHash for the hashX, hashY
  sendCellsTextHashClear(
    sheetId: string,
    hashX: number,
    hashY: number,
    viewRectangle: { x: number; y: number; width: number; height: number },
    overflowGridLines: JsCoordinate[],
    links: Link[],
    drawRects: DrawRects[],
    codeOutlines: { x: number; y: number; width: number; height: number }[]
  ) {
    const message: RenderClientCellsTextHashClear = {
      type: 'renderClientCellsTextHashClear',
      sheetId,
      hashX,
      hashY,
      viewRectangle,
      overflowGridLines,
      links,
      drawRects,
      codeOutlines,
    };
    this.send(message);
  }

  // sends a rendered LabelMeshEntry to the main thread for rendering
  sendLabelMeshEntry(message: RenderClientLabelMeshEntry, data: ArrayBufferLike[]) {
    self.postMessage(message, data);
  }

  firstRenderComplete() {
    this.send({ type: 'renderClientFirstRenderComplete' });
  }

  unload(sheetId: string, hashX: number, hashY: number) {
    this.send({ type: 'renderClientUnload', sheetId, hashX, hashY });
  }

  finalizeCellsTextHash(sheetId: string, hashX: number, hashY: number, special?: RenderSpecial) {
    this.send({ type: 'renderClientFinalizeCellsTextHash', sheetId, hashX, hashY, special });
  }

  async sendColumnMaxWidth(id: number, sheetId: string, column: number) {
    const maxWidth = await renderText.columnMaxWidth(sheetId, column);
    this.send({ type: 'renderClientColumnMaxWidth', maxWidth, id });
  }

  async sendRowMaxHeight(id: number, sheetId: string, row: number) {
    const maxHeight = await renderText.rowMaxHeight(sheetId, row);
    this.send({ type: 'renderClientRowMaxHeight', maxHeight, id });
  }
}

export const renderClient = new RenderClient();
