/**
 * RustRendererCore handles communication between the Core worker and this worker.
 *
 * Messages are bincode-encoded for efficiency (Rust-to-Rust communication).
 * This module handles the MessagePort and forwards binary messages to WASM.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import { getCoreToRendererTypeName } from '@/app/web-workers/rustRendererWebWorker/rustRendererCoreMessages';
import { rustRendererWasm } from './rustRendererWasm';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    // Callback that will be called from Rust WASM to send messages to core
    jsSendToCore?: (data: Uint8Array) => void;
  };

class RustRendererCore {
  private corePort?: MessagePort;

  async init(corePort: MessagePort) {
    this.corePort = corePort;
    this.corePort.onmessage = this.handleMessage;

    // Register the callback for Rust WASM to use
    self.jsSendToCore = this.sendToCore;

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[rustRendererCore] initialized');
    }

    // Note: Ready message is now sent from WASM when renderer.start() is called
  }

  private handleMessage = (e: MessageEvent) => {
    // Messages from core are binary (bincode encoded)
    const data = e.data as Uint8Array;

    if (debugFlag('debugWebWorkersMessages')) {
      const typeName = getCoreToRendererTypeName(data);
      console.log(`[rustRendererCore] message: ${typeName} (${data.length} bytes)`);
    }

    // Forward the binary message directly to WASM for decoding
    rustRendererWasm.handleCoreMessage(data);
  };

  /**
   * Send a bincode-encoded message to core.
   * The data is transferred (zero-copy) to avoid copying large buffers.
   * Using arrow function to preserve `this` when called from global.
   */
  sendToCore = (data: Uint8Array) => {
    if (!this.corePort) {
      console.warn('[rustRendererCore] Cannot send to core: port not initialized');
      return;
    }

    // Transfer the ArrayBuffer for zero-copy
    this.corePort.postMessage(data, [data.buffer]);
  };
}

export const rustRendererCore = new RustRendererCore();

// Make the send function available globally for Rust WASM to call
self.jsSendToCore = rustRendererCore.sendToCore;
