import { JsRenderCell } from '@/quadratic-core/types';
import { Rectangle } from 'pixi.js';
import { CoreLoad, CoreMessage, CoreRenderCells, CoreRequestRenderCells } from './coreTypes';

class CoreWebWorker {
  private worker?: Worker;
  private waitingForLoad: (() => void)[] = [];
  private waitingForCallback: Record<number, Function> = {};
  private loaded = false;
  private id = 0;

  async load(contents: string, lastSequenceNum: number) {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const loadMessage: CoreLoad = {
      type: 'load',
      contents,
      lastSequenceNum,
    };
    this.worker.postMessage(loadMessage);
  }

  getRenderCells(sheetId: string, rectangle: Rectangle): Promise<JsRenderCell[]> {
    return new Promise(async (resolve) => {
      await this.init();
      if (!this.worker) return;
      this.worker.postMessage({
        type: 'requestRenderCells',
        sheetId,
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
        id: this.id,
      } as CoreRequestRenderCells);
      this.waitingForCallback[this.id] = resolve;
      this.id++;
    });
  }

  private init() {
    return new Promise<void>((resolve) => {
      if (this.loaded) {
        resolve();
      } else {
        this.waitingForLoad.push(resolve);
      }
    });
  }

  private ready() {
    this.loaded = true;
    this.waitingForLoad.forEach((resolve) => resolve());
    this.waitingForLoad = [];
  }

  private renderCells(event: CoreRenderCells) {
    const resolve = this.waitingForCallback[event.id];
    if (resolve) {
      console.log(event.cells);
      resolve(event.cells);
      delete this.waitingForCallback[event.id];
    }
  }

  private handleMessage = (e: MessageEvent<CoreMessage>) => {
    switch (e.data.type) {
      case 'load':
        this.ready();
        break;

      case 'renderCells':
        this.renderCells(e.data as CoreRenderCells);
        break;

      default:
        console.warn('Unhandled message type', e.data.type);
    }
  };
}

export const coreWebWorker = new CoreWebWorker();
