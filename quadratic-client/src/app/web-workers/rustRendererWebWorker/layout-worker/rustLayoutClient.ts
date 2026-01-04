/**
 * RustLayoutClient handles communication between the main thread and this worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { ClientRustLayoutMessage, RustLayoutClientMessage } from './rustLayoutClientMessages';
import { rustLayoutCore } from './rustLayoutCore';
import { rustLayoutWasm } from './rustLayoutWasm';

declare var self: WorkerGlobalScope & typeof globalThis;

class RustLayoutClient {
  private renderPort?: MessagePort;

  constructor() {
    self.onmessage = this.handleMessage;
  }

  private handleMessage = async (e: MessageEvent<ClientRustLayoutMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) {
      console.log(`[rustLayoutClient] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'clientRustLayoutInit':
        await this.init(e.data.corePort, e.data.renderPort, e.data.viewportBuffer);
        return;

      case 'clientRustLayoutResize':
        rustLayoutWasm.resize(e.data.width, e.data.height, e.data.devicePixelRatio);
        return;

      case 'clientRustLayoutSetSheet':
        // Sheet switching is handled via core messages
        return;

      case 'clientRustLayoutSetCursor':
        rustLayoutWasm.setCursor(e.data.col, e.data.row);
        return;

      case 'clientRustLayoutSetSelection':
        rustLayoutWasm.setSelection(e.data.startCol, e.data.startRow, e.data.endCol, e.data.endRow);
        return;

      case 'clientRustLayoutShowHeadings':
        rustLayoutWasm.setShowHeadings(e.data.show);
        return;

      case 'clientRustLayoutPing':
        const roundTripMs = performance.now() - e.data.timestamp;
        this.send({
          type: 'rustLayoutClientPong',
          timestamp: e.data.timestamp,
          roundTripMs,
        });
        return;

      case 'clientRustLayoutViewportBuffer':
        console.log('[rustLayoutClient] Received new viewport buffer');
        rustLayoutWasm.setViewportBuffer(e.data.viewportBuffer);
        return;

      default:
        // Ignore messages from react dev tools
        if (!(e.data as any)?.source) {
          console.warn('[rustLayoutClient] Unhandled message type', e.data);
        }
    }
  };

  private lastFrameTime = 0;
  private animationFrameId?: number;
  private updateInterval = 16; // ~60fps target

  private async init(corePort: MessagePort, renderPort: MessagePort, viewportBuffer: SharedArrayBuffer) {
    this.renderPort = renderPort;

    // Initialize communication with core worker
    rustLayoutCore.init(corePort);

    try {
      // Initialize the WASM layout engine
      await rustLayoutWasm.init(viewportBuffer);

      // Start the update loop
      this.startUpdateLoop();

      // Notify the main thread that we're ready
      this.send({
        type: 'rustLayoutClientReady',
      });

      console.log('[rustLayoutClient] initialized');
    } catch (error) {
      console.error('[rustLayoutClient] initialization failed:', error);
      this.send({
        type: 'rustLayoutClientError',
        error: error instanceof Error ? error.message : String(error),
        fatal: true,
      });
    }
  }

  private startUpdateLoop() {
    const loop = (timestamp: number) => {
      try {
        const elapsed = this.lastFrameTime ? timestamp - this.lastFrameTime : this.updateInterval;

        // Only update if enough time has passed
        if (elapsed >= this.updateInterval) {
          this.lastFrameTime = timestamp;

          // Sync viewport from shared buffer
          rustLayoutWasm.syncViewport();

          // Request any needed hashes from core
          rustLayoutWasm.requestNeededHashes();

          // Generate render batch
          const batch = rustLayoutWasm.update();
          if (batch && this.renderPort) {
            // Transfer the batch buffer to the render worker (zero-copy)
            console.log(`[rustLayoutClient] Sending batch to render worker: ${batch.byteLength} bytes`);
            this.renderPort.postMessage(
              {
                type: 'layoutRenderBatch',
                batch: batch.buffer,
              },
              [batch.buffer]
            );
          }
        }
      } catch (error) {
        console.error('[rustLayoutClient] Error in update loop:', error);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  send(message: RustLayoutClientMessage, transferables?: Transferable[]) {
    if (transferables) {
      self.postMessage(message, transferables);
    } else {
      self.postMessage(message);
    }
  }

  // Callback from WASM for auto-size queries
  onAutoSizeResult(column: number | undefined, row: number | undefined, maxWidth?: number, maxHeight?: number) {
    this.send({
      type: 'rustLayoutClientAutoSize',
      column,
      row,
      maxWidth,
      maxHeight,
    });
  }
}

export const rustLayoutClient = new RustLayoutClient();
