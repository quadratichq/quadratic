/**
 * RenderCore communicates between the Core thread and this web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { JsRenderCell } from '@/quadratic-core/types';
import {
  CoreRenderCells,
  CoreRenderReady,
  CoreRequestRenderCells,
} from '@/web-workers/quadraticCore/coreRenderMessages';
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
    switch (e.data.type) {
      case 'ready':
        this.renderLoad(e.data as CoreRenderReady);
        break;

      case 'renderCells':
        this.renderCells(e.data as CoreRenderCells);
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

  /**********************
   * Core API responses *
   **********************/

  private renderLoad(event: CoreRenderReady) {
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
}

export const renderCore = new RenderCore();
