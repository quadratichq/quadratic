/**
 * RustRendererCore handles communication between the Core worker and this worker.
 *
 * Messages are bincode-encoded for efficiency (Rust-to-Rust communication).
 * This module handles the MessagePort and forwards binary messages to WASM.
 */

import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import { getCoreToRendererTypeName } from '@/app/web-workers/rustRendererWebWorker/rustRendererCoreMessages';
import { rustRendererWasm } from './rustRendererWasm';

class RustRendererCore {
  private corePort?: MessagePort;

  async init(corePort: MessagePort) {
    this.corePort = corePort;
    this.corePort.onmessage = this.handleMessage;

    if (await debugFlagWait('debugWebWorkers')) {
      console.log('[rustRendererCore] initialized');
    }

    // Send ready message to core
    this.sendReady();
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
   */
  sendToCore(data: Uint8Array) {
    if (!this.corePort) {
      console.warn('[rustRendererCore] Cannot send to core: port not initialized');
      return;
    }

    // Transfer the ArrayBuffer for zero-copy
    this.corePort.postMessage(data, [data.buffer]);
  }

  /**
   * Send the "Ready" message to core to request initial data.
   */
  private sendReady() {
    // For now, send a simple ready signal
    // The actual bincode message will be constructed by WASM
    rustRendererWasm.sendReadyToCore();
  }
}

export const rustRendererCore = new RustRendererCore();
