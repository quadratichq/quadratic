/**
 * Communication between core web worker and rust renderer web worker.
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
    sendToRustRenderer?: (data: Uint8Array) => void;
    handleRustRendererMessage?: (data: Uint8Array) => void;
  };

class CoreRustRenderer {
  private rustRendererPort?: MessagePort;
  private initialized = false;

  async init(rustRendererPort: MessagePort) {
    this.rustRendererPort = rustRendererPort;
    this.rustRendererPort.onmessage = this.handleMessage;
    this.initialized = true;

    // Register the callback for Rust WASM to use (called via jsSendToRustRenderer in rustCallbacks.ts)
    self.sendToRustRenderer = this.sendToRustRenderer;

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[coreRustRenderer] initialized');
    }
  }

  private handleMessage = (e: MessageEvent) => {
    // Messages from rust renderer are binary (bincode encoded)
    // Handle both Uint8Array and ArrayBuffer (in case of direct buffer transfer)
    let data: Uint8Array;
    if (e.data instanceof Uint8Array) {
      data = e.data;
    } else if (e.data instanceof ArrayBuffer) {
      data = new Uint8Array(e.data);
    } else {
      console.error('[coreRustRenderer] Unexpected message type:', typeof e.data);
      return;
    }

    if (debugFlag('debugWebWorkersMessages')) {
      const typeName = getRendererToCoreTypeName(data);
      console.log(`[coreRustRenderer] message: ${typeName} (${data.length} bytes)`);
    }

    // Forward the binary message to Rust WASM for decoding and handling
    try {
      core.handleRustRendererMessage(data);
    } catch (error) {
      console.error('[coreRustRenderer] Error handling renderer message:', error);
    }
  };

  /**
   * Send a bincode-encoded message to the rust renderer.
   * Called from Rust WASM via the global callback.
   */
  sendToRustRenderer = (data: Uint8Array) => {
    if (!this.rustRendererPort) {
      console.warn('[coreRustRenderer] Cannot send: port not initialized');
      return;
    }

    // Transfer the ArrayBuffer for zero-copy
    this.rustRendererPort.postMessage(data, [data.buffer]);
  };

  get isInitialized(): boolean {
    return this.initialized;
  }
}

export const coreRustRenderer = new CoreRustRenderer();

// Make the send function available globally for Rust WASM to call
self.sendToRustRenderer = coreRustRenderer.sendToRustRenderer;
