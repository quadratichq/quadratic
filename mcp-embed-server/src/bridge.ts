import { WebSocket } from "ws";
import { PORT } from "./config.js";

/**
 * Relays MCP tool calls to the browser over WebSocket. The browser page
 * forwards them to the embedded Quadratic iframe via postMessage.
 */
export class SpreadsheetBridge {
  private ws: WebSocket | null = null;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private nextId = 0;

  setConnection(ws: WebSocket) {
    this.ws = ws;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id);
        if (msg.success) {
          entry.resolve(msg.result);
        } else {
          entry.reject(new Error(msg.error ?? "Unknown error from browser"));
        }
      } catch {
        /* ignore malformed messages */
      }
    });

    ws.on("close", () => {
      this.ws = null;
      for (const [, entry] of this.pending) {
        entry.reject(new Error("Browser disconnected"));
      }
      this.pending.clear();
    });
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async send(
    command: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.connected) {
      throw new Error(
        "No browser connected. Open the web page at " +
          `http://localhost:${PORT} first.`
      );
    }
    const id = String(++this.nextId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Command timed out (30 s)"));
      }, 30_000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.ws!.send(JSON.stringify({ id, command, params }));
    });
  }
}
