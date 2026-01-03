/**
 * RustLayoutCore handles communication between the core worker and this layout worker.
 *
 * Messages from core are bincode-encoded and passed directly to the WASM module.
 * The layout worker can also send messages back to core (e.g., hash requests).
 */

import { rustLayoutWasm } from './rustLayoutWasm';

class RustLayoutCore {
  private corePort?: MessagePort;

  /**
   * Initialize the core communication channel.
   */
  init(corePort: MessagePort): void {
    this.corePort = corePort;
    corePort.onmessage = this.handleMessage;
    console.log('[rustLayoutCore] Core port initialized');
  }

  private handleMessage = (e: MessageEvent) => {
    const data = e.data;

    // Handle bincode messages (Uint8Array)
    if (data instanceof Uint8Array) {
      rustLayoutWasm.handleCoreMessage(data);
      return;
    }

    // Handle ArrayBuffer (convert to Uint8Array)
    if (data instanceof ArrayBuffer) {
      rustLayoutWasm.handleCoreMessage(new Uint8Array(data));
      return;
    }

    console.warn('[rustLayoutCore] Unknown message type:', typeof data);
  };

  /**
   * Send a bincode-encoded message to the core worker.
   * Called from WASM via jsSendToCore.
   */
  sendToCore(data: Uint8Array): void {
    if (!this.corePort) {
      console.warn('[rustLayoutCore] Cannot send to core - port not initialized');
      return;
    }
    // Post the Uint8Array and transfer the underlying ArrayBuffer for zero-copy
    this.corePort.postMessage(data, [data.buffer]);
  }
}

export const rustLayoutCore = new RustLayoutCore();

// Export global function for WASM to call
(globalThis as any).jsSendToCore = (data: Uint8Array) => {
  rustLayoutCore.sendToCore(data);
};
