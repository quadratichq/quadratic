/**
 * RenderCore communicates between the Core thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugWebWorkers } from '@/debugFlags';
import { JsRenderCell } from '@/quadratic-core/types';
import { CoreGridBounds, CoreReady, CoreRequestGridBounds } from '@/web-workers/coreWebWorker/coreMessages';
import { CoreRenderCells, CoreRequestRenderCells } from '@/web-workers/coreWebWorker/coreRenderMessages';
import { RenderCoreMessage } from '../renderCoreMessages';
import { renderText } from './renderText';

class RenderCore {
  private renderCorePort?: MessagePort;
  private waitingForResponse: Map<number, Function> = new Map();
  private id = 0;

  init(renderPort: MessagePort) {
    this.renderCorePort = renderPort;
    this.renderCorePort.onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent<RenderCoreMessage>) => {
    if (debugWebWorkers) console.log(`[renderCore] received ${e.data.type}`);
    switch (e.data.type) {
      case 'ready':
        this.renderLoad(e.data as CoreReady);
        break;

      case 'renderCells':
        this.renderCells(e.data as CoreRenderCells);
        break;

      case 'gridBounds':
        this.gridBounds(e.data as CoreGridBounds);
        break;

      default:
        console.warn('[renderCore] Unhandled message', e.data);
    }
  };

  /*********************
   * Core API requests *
   *********************/

  async getRenderCells(sheetId: string, x: number, y: number, width: number, height: number): Promise<JsRenderCell[]> {
    return new Promise((resolve) => {
      if (!this.renderCorePort) {
        console.warn('Expected renderCorePort to be defined in RenderCore.getRenderCells');
        resolve([]);
        return;
      }
      const id = this.id;
      const message: CoreRequestRenderCells = {
        type: 'requestRenderCells',
        id,
        sheetId,
        x,
        y,
        width,
        height,
      };
      this.renderCorePort.postMessage(message);
      this.waitingForResponse.set(id, resolve);
      this.id++;
    });
  }

  async getGridBounds(
    sheetId: string,
    ignoreFormatting: boolean
  ): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      if (!this.renderCorePort) {
        console.warn('Expected renderCorePort to be defined in RenderCore.getGridBounds');
        resolve(undefined);
        return;
      }
      const id = this.id;
      const message: CoreRequestGridBounds = {
        type: 'requestGridBounds',
        id,
        sheetId,
        ignoreFormatting,
      };
      this.renderCorePort.postMessage(message);
      this.waitingForResponse.set(id, resolve);
      this.id++;
    });
  }

  /**********************
   * Core API responses *
   **********************/

  private renderLoad(event: CoreReady) {
    renderText.init(event.metadata);
  }

  private renderCells(event: CoreRenderCells) {
    const { id, cells } = event;
    const response = this.waitingForResponse.get(id);
    if (!response) {
      console.warn('No callback for requestRenderCells');
      return;
    }
    response(cells);
    this.waitingForResponse.delete(id);
  }

  private gridBounds(event: CoreGridBounds) {
    const { id, bounds } = event;
    const response = this.waitingForResponse.get(id);
    if (!response) {
      console.warn('No callback for requestGridBounds');
      return;
    }
    response(bounds);
    this.waitingForResponse.delete(id);
  }
}

export const renderCore = new RenderCore();
