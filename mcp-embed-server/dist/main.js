import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import { createServer } from "./server.js";
const PORT = parseInt(process.env.PORT ?? "3300", 10);
async function startStreamableHTTPServer(factory) {
    const app = createMcpExpressApp({ host: "0.0.0.0" });
    app.use(cors());
    app.all("/mcp", async (req, res) => {
        const server = factory();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        res.on("close", () => {
            transport.close().catch(() => { });
            server.close().catch(() => { });
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            console.error("MCP error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: { code: -32603, message: "Internal server error" },
                    id: null,
                });
            }
        }
    });
    const httpServer = app.listen(PORT, () => {
        console.log("┌──────────────────────────────────────────────┐");
        console.log("│  Quadratic MCP App Server                    │");
        console.log("├──────────────────────────────────────────────┤");
        console.log(`│  Streamable HTTP: http://localhost:${PORT}/mcp   │`);
        console.log("│  Mode: MCP App (inline UI in Claude)         │");
        console.log("└──────────────────────────────────────────────┘");
    });
    const shutdown = () => {
        console.log("\nShutting down...");
        httpServer.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
async function startStdioServer(factory) {
    const server = factory();
    await server.connect(new StdioServerTransport());
}
async function main() {
    if (process.argv.includes("--stdio")) {
        await startStdioServer(createServer);
    }
    else {
        await startStreamableHTTPServer(createServer);
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
