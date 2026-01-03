/**
 * Communication between core web worker and rust layout web worker.
 *
 * This is a singleton where one instance exists for the web worker and can be
 * directly accessed by its siblings.
 *
 * Messages use bincode encoding for efficiency (Rust-to-Rust).
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import { getRendererToCoreTypeName } from '@/app/web-workers/rustRendererWebWorker/rustRendererCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    // Callbacks that will be called from Rust WASM (via rustCallbacks.ts)
    sendToRustLayout?: (data: Uint8Array) => void;
  };

class CoreRustLayout {
  private rustLayoutPort?: MessagePort;
  private initialized = false;

  async init(rustLayoutPort: MessagePort) {
    this.rustLayoutPort = rustLayoutPort;
    this.rustLayoutPort.onmessage = this.handleMessage;
    this.initialized = true;

    // Register the callback for Rust WASM to use
    self.sendToRustLayout = this.sendToRustLayout;

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[coreRustLayout] initialized');
    }
  }

  private handleMessage = (e: MessageEvent) => {
    // Messages from rust layout worker are binary (bincode encoded)
    // Handle both Uint8Array and ArrayBuffer (in case of direct buffer transfer)
    let data: Uint8Array;
    if (e.data instanceof Uint8Array) {
      data = e.data;
    } else if (e.data instanceof ArrayBuffer) {
      data = new Uint8Array(e.data);
    } else {
      console.error('[coreRustLayout] Unexpected message type:', typeof e.data);
      return;
    }

    if (debugFlag('debugWebWorkersMessages')) {
      const typeName = getRendererToCoreTypeName(data);
      console.log(`[coreRustLayout] message: ${typeName} (${data.length} bytes)`);
    }

    // Forward the binary message to Rust WASM for decoding and handling
    // Layout worker uses the same message types as render worker (RendererToCore)
    try {
      core.handleRustRendererMessage(data);
    } catch (error) {
      console.error('[coreRustLayout] Error handling layout message:', error);
    }
  };

  /**
   * Send a bincode-encoded message to the rust layout worker.
   * Called from Rust WASM via the global callback.
   */
  sendToRustLayout = (data: Uint8Array) => {
    if (!this.rustLayoutPort) {
      console.warn('[coreRustLayout] Cannot send: port not initialized');
      return;
    }

    // Transfer the ArrayBuffer for zero-copy
    this.rustLayoutPort.postMessage(data, [data.buffer]);
  };

  get isInitialized(): boolean {
    return this.initialized;
  }
}

export const coreRustLayout = new CoreRustLayout();
