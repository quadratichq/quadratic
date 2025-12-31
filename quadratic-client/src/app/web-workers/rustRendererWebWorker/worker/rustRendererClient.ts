/**
 * RustRendererClient handles communication between the main thread and this worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type {
  ClientRustRendererMessage,
  RustRendererClientMessage,
} from '@/app/web-workers/rustRendererWebWorker/rustRendererClientMessages';
import { rustRendererCore } from './rustRendererCore';
import { rustRendererWasm } from './rustRendererWasm';

declare var self: WorkerGlobalScope & typeof globalThis;

class RustRendererClient {
  private canvas?: OffscreenCanvas;
  private devicePixelRatio = 1;

  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = async (e: MessageEvent<ClientRustRendererMessage>) => {
    if (debugFlag('debugWebWorkersMessages') && e.data.type !== 'clientRustRendererViewport') {
      console.log(`[rustRendererClient] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'clientRustRendererInit':
        await this.init(e.data.canvas, e.data.corePort, e.data.devicePixelRatio);
        return;

      case 'clientRustRendererViewport':
        // Capture sheet ID from viewport updates (first message may come before setSheet)
        if (this.currentSheetId !== e.data.sheetId) {
          this.currentSheetId = e.data.sheetId;
        }
        rustRendererWasm.updateViewport(e.data.sheetId, e.data.bounds, e.data.scale);
        return;

      case 'clientRustRendererSetSheet':
        this.currentSheetId = e.data.sheetId;
        rustRendererWasm.setSheet(e.data.sheetId);
        return;

      case 'clientRustRendererResize':
        this.devicePixelRatio = e.data.devicePixelRatio;
        rustRendererWasm.resize(e.data.width, e.data.height, e.data.devicePixelRatio);
        return;

      case 'clientRustRendererScreenshot':
        const screenshot = await rustRendererWasm.screenshot();
        this.send({
          type: 'rustRendererClientScreenshot',
          id: e.data.id,
          imageData: screenshot.imageData,
          width: screenshot.width,
          height: screenshot.height,
        });
        return;

      case 'clientRustRendererPing':
        const roundTripMs = performance.now() - e.data.timestamp;
        this.send({
          type: 'rustRendererClientPong',
          timestamp: e.data.timestamp,
          roundTripMs,
        });
        return;

      case 'clientRustRendererViewportBuffer':
        console.log('[rustRendererClient] Received viewport buffer');
        rustRendererWasm.setViewportBuffer(e.data.buffer);
        return;

      case 'clientRustRendererFPSBuffer':
        console.log('[rustRendererClient] Received FPS buffer');
        this.fpsBuffer = new Int32Array(e.data.buffer);
        return;

      default:
        // Ignore messages from react dev tools
        if (!(e.data as any)?.source) {
          console.warn('[rustRendererClient] Unhandled message type', e.data);
        }
    }
  };

  private lastFrameTime = 0;
  private animationFrameId?: number;
  private currentSheetId: string = '';

  // FPS tracking via SharedArrayBuffer
  private fpsBuffer?: Int32Array;
  private fpsFrameCount = 0;
  private fpsLastTime = 0;
  private fpsUpdateInterval = 500; // Update FPS every 500ms

  private async init(canvas: OffscreenCanvas, corePort: MessagePort, devicePixelRatio: number) {
    this.canvas = canvas;
    this.devicePixelRatio = devicePixelRatio;

    // Initialize communication with core worker (must complete before WASM starts)
    rustRendererCore.init(corePort);

    try {
      // Initialize the WASM renderer
      const backend = await rustRendererWasm.init(canvas, devicePixelRatio);

      // Start the render loop
      this.startRenderLoop();

      // Notify the main thread that we're ready
      this.send({
        type: 'rustRendererClientReady',
        backend,
      });

      console.log(`[rustRendererClient] initialized with ${backend} backend`);
    } catch (error) {
      console.error('[rustRendererClient] initialization failed:', error);
      this.send({
        type: 'rustRendererClientError',
        error: error instanceof Error ? error.message : String(error),
        fatal: true,
      });
    }
  }

  private startRenderLoop() {
    const loop = (timestamp: number) => {
      try {
        const elapsed = this.lastFrameTime ? timestamp - this.lastFrameTime : 16;
        this.lastFrameTime = timestamp;

        // Render a frame (viewport/deceleration is managed by the client)
        // frame() returns true if actual rendering occurred
        const didRender = rustRendererWasm.frame(elapsed);

        // Increment frame counter only when actual rendering happened (for render light indicator)
        if (didRender && this.fpsBuffer) {
          const prev = Atomics.load(this.fpsBuffer, 1);
          Atomics.store(this.fpsBuffer, 1, prev + 1);
        }

        // Track FPS and write to SharedArrayBuffer
        this.fpsFrameCount++;
        const fpsDelta = timestamp - this.fpsLastTime;
        if (fpsDelta >= this.fpsUpdateInterval) {
          const fps = Math.round((this.fpsFrameCount / fpsDelta) * 1000);
          if (this.fpsBuffer) {
            Atomics.store(this.fpsBuffer, 0, fps);
          }
          this.fpsFrameCount = 0;
          this.fpsLastTime = timestamp;
        }
      } catch (error) {
        console.error('[rustRendererClient] Error in render loop:', error);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // Note: Meta fills are now requested directly from WASM to core via bincode messages

  send(message: RustRendererClientMessage, transferables?: Transferable[]) {
    if (transferables) {
      self.postMessage(message, transferables);
    } else {
      self.postMessage(message);
    }
  }

  // ============================================================================
  // Callbacks from WASM renderer
  // ============================================================================

  onCellClick(
    sheetId: string,
    x: number,
    y: number,
    modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }
  ) {
    this.send({
      type: 'rustRendererClientCellClick',
      sheetId,
      x,
      y,
      modifiers,
    });
  }

  onCellHover(sheetId: string, x: number | null, y: number | null) {
    this.send({
      type: 'rustRendererClientCellHover',
      sheetId,
      x,
      y,
    });
  }

  onCellEdit(sheetId: string, x: number, y: number) {
    this.send({
      type: 'rustRendererClientCellEdit',
      sheetId,
      x,
      y,
    });
  }

  onSelectionChanged(
    sheetId: string,
    cursorX: number,
    cursorY: number,
    ranges: Array<{ minX: number; minY: number; maxX: number; maxY: number }>
  ) {
    this.send({
      type: 'rustRendererClientSelectionChanged',
      sheetId,
      cursorX,
      cursorY,
      ranges,
    });
  }

  onError(error: string, fatal: boolean) {
    this.send({
      type: 'rustRendererClientError',
      error,
      fatal,
    });
  }
}

export const rustRendererClient = new RustRendererClient();
