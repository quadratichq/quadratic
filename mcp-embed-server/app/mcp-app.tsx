import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

declare const __EMBED_URL__: string;
const EMBED_URL = __EMBED_URL__;

type Status = "loading" | "ready" | "error";

function QuadraticApp() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [lastTool, setLastTool] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string>(
    `embed_url: ${EMBED_URL}\nlocation: ${window.location.href}\nuser_agent: ${navigator.userAgent.slice(0, 80)}`
  );
  const pendingRef = useRef<
    Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>
  >(new Map());
  const nextIdRef = useRef(0);

  const addDiag = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setDiagnostics((prev) => `${prev}\n[${ts}] ${msg}`);
  }, []);

  useHostStyles();

  useEffect(() => {
    const securityHandler = (e: SecurityPolicyViolationEvent) => {
      addDiag(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
    };
    document.addEventListener("securitypolicyviolation", securityHandler);

    const errorHandler = (e: ErrorEvent) => {
      addDiag(`global error: ${e.message}`);
    };
    window.addEventListener("error", errorHandler);

    return () => {
      document.removeEventListener("securitypolicyviolation", securityHandler);
      window.removeEventListener("error", errorHandler);
    };
  }, [addDiag]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "quadratic-mcp-ready") {
        setStatus("ready");
        addDiag("received quadratic-mcp-ready from iframe");
        return;
      }
      if (msg?.type === "quadratic-mcp-response") {
        const entry = pendingRef.current.get(msg.id);
        if (entry) {
          pendingRef.current.delete(msg.id);
          if (msg.success) entry.resolve(msg.result);
          else entry.reject(new Error(msg.error ?? "Unknown error"));
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [addDiag]);

  const sendCommand = useCallback(
    (command: string, params: Record<string, unknown>): Promise<unknown> => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) {
        return Promise.reject(new Error("Iframe not ready"));
      }
      const id = String(++nextIdRef.current);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error("Command timed out"));
        }, 30_000);
        pendingRef.current.set(id, {
          resolve: (v) => {
            clearTimeout(timeout);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timeout);
            reject(e);
          },
        });
        iframe.contentWindow!.postMessage(
          { type: "quadratic-mcp-command", id, command, params },
          "*"
        );
      });
    },
    []
  );

  const handleToolResult = useCallback(
    (result: CallToolResult) => {
      const text = result.content?.find((c) => c.type === "text")?.text;
      if (!text) return;
      try {
        const payload = JSON.parse(text);
        if (payload._mcpCommand && payload._mcpParams) {
          setLastTool(payload._mcpCommand);
          sendCommand(payload._mcpCommand, payload._mcpParams).catch(
            console.error
          );
        }
      } catch {
        // Not a command payload
      }
    },
    [sendCommand]
  );

  const { error } = useApp({
    appInfo: { name: "Quadratic Spreadsheet", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result: CallToolResult) => {
        handleToolResult(result);
      };
      app.onerror = console.error;
    },
  });

  if (error) {
    return (
      <div style={{ padding: 16, color: "#ef4444" }}>
        Error: {error.message}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 520,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          fontSize: 12,
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span style={{ fontWeight: 600, color: "#374151" }}>
          Quadratic Spreadsheet
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastTool && (
            <span style={{ color: "#6366f1" }}>Last: {lastTool}</span>
          )}
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                status === "ready"
                  ? "#22c55e"
                  : status === "error"
                    ? "#ef4444"
                    : "#eab308",
            }}
          />
          <span style={{ color: "#6b7280" }}>
            {status === "ready"
              ? "Connected"
              : status === "error"
                ? "Error"
                : "Loading\u2026"}
          </span>
        </div>
      </div>
      {diagnostics && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            fontFamily: "monospace",
            background: "#fef3c7",
            borderBottom: "1px solid #e5e7eb",
            color: "#92400e",
            whiteSpace: "pre-wrap",
            maxHeight: 120,
            overflow: "auto",
          }}
        >
          {diagnostics}
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={EMBED_URL}
        title="Quadratic Spreadsheet"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          minHeight: 480,
        }}
        allow="clipboard-read; clipboard-write"
        onLoad={() => addDiag("iframe onload fired")}
        onError={(e) => addDiag(`iframe onerror: ${e}`)}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuadraticApp />
  </StrictMode>
);
