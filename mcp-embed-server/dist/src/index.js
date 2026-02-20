import { SpreadsheetBridge } from "./bridge.js";
import { createMcpServer } from "./tools.js";
import { startServer } from "./server.js";
const bridge = new SpreadsheetBridge();
const mcp = createMcpServer(bridge);
startServer(mcp, bridge);
