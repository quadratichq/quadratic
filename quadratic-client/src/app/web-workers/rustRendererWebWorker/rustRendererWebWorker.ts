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

// Viewport buffer size: 8 floats * 4 bytes = 32 bytes
// Layout: [positionX, positionY, scale, dpr, width, height, dirty, reserved]
const VIEWPORT_BUFFER_SIZE = 32;

// Indices into the Float32Array
const ViewportIndex = {
  PositionX: 0,
  PositionY: 1,
  Scale: 2,
  Dpr: 3,
  Width: 4,
  Height: 5,
  Dirty: 6,
  Reserved: 7,
} as const;

class RustRendererWebWorker {
  private worker?: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  private canvas?: HTMLCanvasElement;
  private offscreenCanvas?: OffscreenCanvas;
  private isReady = false;
  private backend?: 'webgpu' | 'webgl';

  // SharedArrayBuffer for viewport state (main thread writes, renderer reads)
  private viewportBuffer?: SharedArrayBuffer;
  private viewportView?: Float32Array;

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

        // Create and send the viewport buffer
        this.initViewportBuffer();

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
   * Initialize and send the viewport SharedArrayBuffer to the worker.
   * This enables zero-copy viewport sync between main thread and renderer.
   */
  private initViewportBuffer() {
    // Check if SharedArrayBuffer is available
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('[rustRendererWebWorker] SharedArrayBuffer not available (missing COOP/COEP headers)');
      return;
    }

    try {
      // Create the SharedArrayBuffer
      this.viewportBuffer = new SharedArrayBuffer(VIEWPORT_BUFFER_SIZE);
      this.viewportView = new Float32Array(this.viewportBuffer);

      // Initialize with default values
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = this.canvas?.clientWidth ?? 800;
      const canvasHeight = this.canvas?.clientHeight ?? 600;

      this.viewportView[ViewportIndex.PositionX] = 0;
      this.viewportView[ViewportIndex.PositionY] = 0;
      this.viewportView[ViewportIndex.Scale] = 1;
      this.viewportView[ViewportIndex.Dpr] = dpr;
      this.viewportView[ViewportIndex.Width] = canvasWidth * dpr;
      this.viewportView[ViewportIndex.Height] = canvasHeight * dpr;
      this.viewportView[ViewportIndex.Dirty] = 1; // Start dirty
      this.viewportView[ViewportIndex.Reserved] = 0;

      console.log(`[rustRendererWebWorker] Viewport buffer created: ${canvasWidth}x${canvasHeight}, dpr=${dpr}`);

      // Send to worker
      this.send({
        type: 'clientRustRendererViewportBuffer',
        buffer: this.viewportBuffer,
      });

      console.log('[rustRendererWebWorker] Viewport buffer sent to worker');
    } catch (e) {
      // SharedArrayBuffer may not be available (requires COOP/COEP headers)
      console.warn('[rustRendererWebWorker] Failed to create SharedArrayBuffer:', e);
    }
  }

  /**
   * Write viewport state to the SharedArrayBuffer.
   * Call this whenever the viewport changes.
   * @param x - World X coordinate of the top-left corner
   * @param y - World Y coordinate of the top-left corner
   * @param scale - Zoom scale (1.0 = 100%)
   * @param width - Canvas width in CSS pixels
   * @param height - Canvas height in CSS pixels
   */
  writeViewport(x: number, y: number, scale: number, width: number, height: number) {
    if (!this.viewportView) return;

    const dpr = window.devicePixelRatio || 1;
    this.viewportView[ViewportIndex.PositionX] = x;
    this.viewportView[ViewportIndex.PositionY] = y;
    this.viewportView[ViewportIndex.Scale] = scale;
    this.viewportView[ViewportIndex.Dpr] = dpr;
    this.viewportView[ViewportIndex.Width] = width * dpr;
    this.viewportView[ViewportIndex.Height] = height * dpr;
    this.viewportView[ViewportIndex.Dirty] = 1; // Mark dirty
  }

  /**
   * Check if viewport buffer is available
   */
  get hasViewportBuffer(): boolean {
    return !!this.viewportBuffer;
  }

  // Track last logged values to avoid spam
  private lastLoggedViewport = { x: 0, y: 0, scale: 0 };

  /**
   * Update the viewport (visible area).
   * If SharedArrayBuffer is available, writes directly to it.
   * Also sends a message for fallback/legacy support.
   */
  updateViewport(sheetId: string, bounds: { x: number; y: number; width: number; height: number }, scale: number) {
    // Don't do anything if worker isn't initialized yet
    if (!this.worker) return;

    // Write to SharedArrayBuffer if available (zero-copy sync)
    // Note: bounds.x/y are world coordinates (top-left of visible area)
    // Canvas dimensions come from the actual canvas, not bounds
    if (this.canvas) {
      const canvasWidth = this.canvas.clientWidth || this.canvas.width;
      const canvasHeight = this.canvas.clientHeight || this.canvas.height;

      // Debug: log significant viewport changes (only if ready)
      if (this.isReady) {
        const diffX = Math.abs(bounds.x - this.lastLoggedViewport.x);
        const diffY = Math.abs(bounds.y - this.lastLoggedViewport.y);
        const diffScale = Math.abs(scale - this.lastLoggedViewport.scale);
        if (diffX > 10 || diffY > 10 || diffScale > 0.1) {
          console.log(
            `[rustRendererWebWorker] viewport: x=${bounds.x.toFixed(1)}, y=${bounds.y.toFixed(1)}, scale=${scale.toFixed(2)}, canvas=${canvasWidth}x${canvasHeight}`
          );
          this.lastLoggedViewport = { x: bounds.x, y: bounds.y, scale };
        }
      }

      this.writeViewport(bounds.x, bounds.y, scale, canvasWidth, canvasHeight);
    }

    // Also send message for fallback
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
