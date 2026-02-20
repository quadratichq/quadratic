import { WebSocket } from "ws";
/**
 * Relays MCP tool calls to the browser over WebSocket. The browser page
 * forwards them to the embedded Quadratic iframe via postMessage.
 */
export declare class SpreadsheetBridge {
    private ws;
    private pending;
    private nextId;
    setConnection(ws: WebSocket): void;
    get connected(): boolean;
    send(command: string, params: Record<string, unknown>): Promise<unknown>;
}
