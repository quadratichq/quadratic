/**
 * Interface between main thread and Rust Renderer web worker.
 *
 * This provides a TypeScript API for controlling the Rust-based WebGPU/WebGL
 * renderer running in a separate worker thread.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import type {
  ClientRustRendererMessage,
  ClientRustRendererPing,
  RustRendererClientMessage,
} from './rustRendererClientMessages';

class RustRendererWebWorker {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  private canvas?: HTMLCanvasElement;
  private offscreenCanvas?: OffscreenCanvas;
  private isReady = false;
  private backend?: 'webgpu' | 'webgl';

  // Queue messages until the worker is ready
  private messageQueue: ClientRustRendererMessage[] = [];

  /**
   * Initialize the worker (call early, before init())
   */
  initWorker() {
    this.worker = new Worker(new URL('./worker/rustRenderer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[rustRenderer.worker] error: ${e.message}`, e);
  }

  /**
   * Initialize the renderer with a canvas and core message port.
   * The canvas is transferred to the worker as an OffscreenCanvas.
   */
  async init(canvas: HTMLCanvasElement, coreMessagePort: MessagePort): Promise<void> {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in rustRendererWebWorker.init');
    }

    this.canvas = canvas;
    this.offscreenCanvas = canvas.transferControlToOffscreen();

    const message: ClientRustRendererMessage = {
      type: 'clientRustRendererInit',
      canvas: this.offscreenCanvas,
      corePort: coreMessagePort,
      devicePixelRatio: window.devicePixelRatio || 1,
    };

    // Transfer both the canvas and the message port
    this.worker.postMessage(message, [this.offscreenCanvas, coreMessagePort]);

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[rustRendererWebWorker] initialized.');
    }
  }

  private handleMessage = async (e: MessageEvent<RustRendererClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) {
      console.log(`[rustRendererWebWorker] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'rustRendererClientReady':
        this.isReady = true;
        this.backend = e.data.backend;
        console.log(`[rustRendererWebWorker] ready with ${e.data.backend} backend`);
        // Flush queued messages
        this.messageQueue.forEach((msg) => this.send(msg));
        this.messageQueue = [];
        return;

      case 'rustRendererClientError':
        console.error(`[rustRendererWebWorker] error: ${e.data.error}`, e.data.fatal ? '(fatal)' : '');
        return;

      case 'rustRendererClientPong':
        console.log(`[rustRendererWebWorker] pong: ${e.data.roundTripMs}ms round-trip`);
        return;

      case 'rustRendererClientCellClick':
        // TODO: Forward to appropriate handler
        console.log(`[rustRendererWebWorker] cell click: ${e.data.sheetId} (${e.data.x}, ${e.data.y})`);
        return;

      case 'rustRendererClientCellHover':
        // TODO: Forward to appropriate handler
        return;

      case 'rustRendererClientCellEdit':
        // TODO: Forward to appropriate handler (open cell editor)
        console.log(`[rustRendererWebWorker] cell edit: ${e.data.sheetId} (${e.data.x}, ${e.data.y})`);
        return;

      case 'rustRendererClientSelectionChanged':
        // TODO: Forward to selection handler
        return;

      case 'rustRendererClientScreenshot':
        // Handle screenshot response
        const callback = this.waitingForResponse[e.data.id];
        if (callback) {
          callback(e.data);
          delete this.waitingForResponse[e.data.id];
        }
        return;
    }

    console.warn('[rustRendererWebWorker] unhandled message:', e.data);
  };

  private send(message: ClientRustRendererMessage, transferables?: Transferable[]) {
    if (!this.worker) {
      throw new Error('Expected worker to be initialized in rustRendererWebWorker.send');
    }

    // Queue messages if not ready yet
    if (!this.isReady && message.type !== 'clientRustRendererInit') {
      this.messageQueue.push(message);
      return;
    }

    if (transferables) {
      this.worker.postMessage(message, transferables);
    } else {
      this.worker.postMessage(message);
    }
  }

  /**
   * Update the viewport (visible area)
   */
  updateViewport(sheetId: string, bounds: { x: number; y: number; width: number; height: number }, scale: number) {
    this.send({
      type: 'clientRustRendererViewport',
      sheetId,
      bounds: bounds as any, // Rectangle type
      scale,
    });
  }

  /**
   * Switch to a different sheet
   */
  setSheet(sheetId: string) {
    this.send({ type: 'clientRustRendererSetSheet', sheetId });
  }

  /**
   * Handle canvas resize
   */
  resize(width: number, height: number) {
    this.send({
      type: 'clientRustRendererResize',
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }

  /**
   * Forward mouse event to renderer
   */
  mouseEvent(
    eventType: 'move' | 'down' | 'up' | 'wheel',
    x: number,
    y: number,
    options?: {
      button?: number;
      deltaX?: number;
      deltaY?: number;
      modifiers?: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
    }
  ) {
    this.send({
      type: 'clientRustRendererMouseEvent',
      eventType,
      x,
      y,
      button: options?.button,
      deltaX: options?.deltaX,
      deltaY: options?.deltaY,
      modifiers: options?.modifiers ?? { shift: false, ctrl: false, alt: false, meta: false },
    });
  }

  /**
   * Forward keyboard event to renderer
   */
  keyEvent(
    eventType: 'down' | 'up',
    key: string,
    code: string,
    modifiers?: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }
  ) {
    this.send({
      type: 'clientRustRendererKeyEvent',
      eventType,
      key,
      code,
      modifiers: modifiers ?? { shift: false, ctrl: false, alt: false, meta: false },
    });
  }

  /**
   * Request a screenshot (for thumbnails)
   */
  screenshot(): Promise<{ imageData: Uint8Array; width: number; height: number }> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.waitingForResponse[id] = (response: { imageData: Uint8Array; width: number; height: number }) => {
        resolve(response);
      };
      this.send({ type: 'clientRustRendererScreenshot', id });
    });
  }

  /**
   * Ping the worker (for testing/debugging)
   */
  ping() {
    const message: ClientRustRendererPing = {
      type: 'clientRustRendererPing',
      timestamp: performance.now(),
    };
    this.send(message);
  }

  /**
   * Check if the renderer is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Get the rendering backend being used
   */
  get renderBackend(): 'webgpu' | 'webgl' | undefined {
    return this.backend;
  }
}

export const rustRendererWebWorker = new RustRendererWebWorker();
