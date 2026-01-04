/**
 * Interface between main thread and Rust Layout web worker.
 *
 * This provides a TypeScript API for controlling the layout worker
 * that pre-computes text layout and vertex buffers for the renderer.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import type { ClientRustLayoutMessage, RustLayoutClientMessage } from './layout-worker/rustLayoutClientMessages';

class RustLayoutWebWorker {
  private worker?: Worker;
  private isReady = false;
  private renderPort?: MessagePort;

  // Queue messages until the worker is ready
  private messageQueue: ClientRustLayoutMessage[] = [];

  /**
   * Initialize the layout worker.
   * @param corePort - MessagePort for communication with core worker
   * @param renderPort - MessagePort for sending RenderBatch to render worker
   * @param viewportBuffer - SharedArrayBuffer for viewport state
   */
  async init(corePort: MessagePort, renderPort: MessagePort, viewportBuffer: SharedArrayBuffer): Promise<void> {
    this.renderPort = renderPort;

    // Create the worker
    this.worker = new Worker(new URL('./layout-worker/rustLayout.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[rustLayout.worker] error: ${e.message}`, e);

    // Send initialization message with both ports and viewport buffer
    const message: ClientRustLayoutMessage = {
      type: 'clientRustLayoutInit',
      corePort,
      renderPort,
      viewportBuffer,
    };

    // Transfer both ports
    this.worker.postMessage(message, [corePort, renderPort]);

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[rustLayoutWebWorker] initialized');
    }
  }

  private handleMessage = async (e: MessageEvent<RustLayoutClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) {
      console.log(`[rustLayoutWebWorker] message: ${e.data.type}`);
    }

    switch (e.data.type) {
      case 'rustLayoutClientReady':
        this.isReady = true;
        console.log('[rustLayoutWebWorker] ready');

        // Flush queued messages
        this.messageQueue.forEach((msg) => this.send(msg));
        this.messageQueue = [];
        return;

      case 'rustLayoutClientError':
        console.error(`[rustLayoutWebWorker] error: ${e.data.error}`, e.data.fatal ? '(fatal)' : '');
        return;

      case 'rustLayoutClientPong':
        console.log(`[rustLayoutWebWorker] pong: ${e.data.roundTripMs}ms round-trip`);
        return;

      case 'rustLayoutClientAutoSize':
        // TODO: Forward to appropriate handler for auto-sizing columns/rows
        if (e.data.column !== undefined) {
          console.log(`[rustLayoutWebWorker] auto-size column ${e.data.column}: ${e.data.maxWidth}px`);
        }
        if (e.data.row !== undefined) {
          console.log(`[rustLayoutWebWorker] auto-size row ${e.data.row}: ${e.data.maxHeight}px`);
        }
        return;
    }
  };

  private send(message: ClientRustLayoutMessage, transferables?: Transferable[]) {
    if (!this.worker) {
      console.warn('[rustLayoutWebWorker] Worker not initialized');
      return;
    }

    // Queue messages if not ready yet
    if (!this.isReady && message.type !== 'clientRustLayoutInit') {
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
   * Handle canvas resize
   */
  resize(width: number, height: number, devicePixelRatio: number) {
    this.send({
      type: 'clientRustLayoutResize',
      width,
      height,
      devicePixelRatio,
    });
  }

  /**
   * Set cursor position
   */
  setCursor(col: number, row: number) {
    this.send({
      type: 'clientRustLayoutSetCursor',
      col,
      row,
    });
  }

  /**
   * Set selection range
   */
  setSelection(startCol: number, startRow: number, endCol: number, endRow: number) {
    this.send({
      type: 'clientRustLayoutSetSelection',
      startCol,
      startRow,
      endCol,
      endRow,
    });
  }

  /**
   * Show or hide headings
   */
  setShowHeadings(show: boolean) {
    this.send({
      type: 'clientRustLayoutShowHeadings',
      show,
    });
  }

  /**
   * Ping the worker (for testing/debugging)
   */
  ping() {
    this.send({
      type: 'clientRustLayoutPing',
      timestamp: performance.now(),
    });
  }

  /**
   * Set the viewport buffer (when ViewportControls provides its buffer).
   * This updates the buffer the layout worker uses for viewport sync.
   */
  setViewportBuffer(buffer: SharedArrayBuffer) {
    this.send({
      type: 'clientRustLayoutViewportBuffer',
      viewportBuffer: buffer,
    });
  }

  /**
   * Check if the layout worker is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
      this.isReady = false;
    }
  }
}

export const rustLayoutWebWorker = new RustLayoutWebWorker();
