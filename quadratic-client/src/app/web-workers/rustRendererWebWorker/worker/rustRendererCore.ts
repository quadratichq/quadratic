/**
 * RustRendererCore handles communication between the Core worker and this worker.
 *
 * Messages are bincode-encoded for efficiency (Rust-to-Rust communication).
 * This module handles the MessagePort and forwards binary messages to WASM.
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import {
  CoreToRendererType,
  getCoreToRendererTypeName,
} from '@/app/web-workers/rustRendererWebWorker/rustRendererCoreMessages';
import { rustRendererWasm } from './rustRendererWasm';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    // Callback that will be called from Rust WASM to send messages to core
    jsSendToCore?: (data: Uint8Array) => void;
  };

class RustRendererCore {
  private corePort?: MessagePort;

  init(corePort: MessagePort) {
    this.corePort = corePort;
    this.corePort.onmessage = this.handleMessage;

    // Register the callback for Rust WASM to use
    self.jsSendToCore = this.sendToCore;

    console.log('[rustRendererCore] initialized');

    // Note: Ready message is now sent from WASM when renderer.start() is called
  }

  private handleMessage = (e: MessageEvent) => {
    // Messages from core are binary (bincode encoded)
    // Handle both Uint8Array and ArrayBuffer (in case of direct buffer transfer)
    let data: Uint8Array;
    if (e.data instanceof Uint8Array) {
      data = e.data;
    } else if (e.data instanceof ArrayBuffer) {
      data = new Uint8Array(e.data);
    } else {
      console.error('[rustRendererCore] Unexpected message type:', typeof e.data);
      return;
    }

    // Filter out hash-related messages - Layout Worker handles these exclusively
    // and sends pre-computed RenderBatch to us
    if (data.length > 0) {
      const messageType = data[0];
      if (
        messageType === CoreToRendererType.InitSheet ||
        messageType === CoreToRendererType.HashCells ||
        messageType === CoreToRendererType.DirtyHashes
      ) {
        // Layout Worker handles these - skip in Render Worker
        if (debugFlag('debugWebWorkersMessages')) {
          const typeName = getCoreToRendererTypeName(data);
          console.log(`[rustRendererCore] skipping ${typeName} (handled by Layout Worker)`);
        }
        return;
      }
    }

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
