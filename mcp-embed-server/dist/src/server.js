import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { EMBED_URL, PORT } from "./config.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function startServer(mcp, bridge) {
    const app = express();
    app.use((_req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
        next();
    });
    app.get("/config", (_req, res) => {
        res.json({ embedUrl: EMBED_URL });
    });
    app.use(express.static(path.join(__dirname, "../public")));
    // --- SSE transport for MCP ---
    const sseTransports = new Map();
    app.get("/sse", async (req, res) => {
        console.log("[MCP] New SSE connection");
        const transport = new SSEServerTransport("/messages", res);
        sseTransports.set(transport.sessionId, transport);
        res.on("close", () => {
            console.log("[MCP] SSE connection closed", transport.sessionId);
            sseTransports.delete(transport.sessionId);
        });
        await mcp.connect(transport);
    });
    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = sseTransports.get(sessionId);
        if (!transport) {
            res.status(400).json({ error: "Unknown session" });
            return;
        }
        await transport.handlePostMessage(req, res);
    });
    // --- HTTP + WebSocket ---
    const httpServer = createServer(app);
    const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    wss.on("connection", (ws) => {
        console.log("[Bridge] Browser connected via WebSocket");
        bridge.setConnection(ws);
        ws.on("close", () => console.log("[Bridge] Browser disconnected"));
    });
    httpServer.listen(PORT, () => {
        console.log("┌──────────────────────────────────────────────┐");
        console.log("│  Quadratic MCP Embed Server                  │");
        console.log("├──────────────────────────────────────────────┤");
        console.log(`│  Web UI:   http://localhost:${PORT}             │`);
        console.log(`│  MCP SSE:  http://localhost:${PORT}/sse          │`);
        console.log("└──────────────────────────────────────────────┘");
    });
}
