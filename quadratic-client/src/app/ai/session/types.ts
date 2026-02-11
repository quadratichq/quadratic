import type { AgentType } from 'quadratic-shared/ai/agents';
import type {
  AIModelKey,
  AIResponseContent,
  AISource,
  AIToolCall,
  AIUsage,
  ChatMessage,
  Content,
  Context,
} from 'quadratic-shared/typesAndSchemasAI';
import type { ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';

export type Connection = ConnectionList[number];

/**
 * Request to execute an AI session
 */
export interface AISessionRequest {
  /** Source identifier for analytics */
  messageSource: string;
  /** User message content */
  content: Content;
  /** Context for the request (code cell, connection, etc.) */
  context: Context;
  /** Index in the message history (0 for new chat) */
  messageIndex: number;
  /** Files to import to the grid */
  importFiles: ImportFile[];
  /** Available database connections */
  connections: Connection[];
}

/**
 * Result from an AI session execution
 */
export interface AISessionResult {
  /** Whether the session completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The chat ID */
  chatId: string;
}

/**
 * File to import to the grid
 */
export interface ImportFile {
  name: string;
  size: number;
  data: ArrayBuffer;
  type?: string;
}

/**
 * Options for building AI context
 */
export interface ContextOptions {
  /** Database connections */
  connections: Connection[];
  /** Request context (code cell, connection, etc.) */
  context: Context;
  /** Current chat messages */
  chatMessages: ChatMessage[];
  /** Team UUID for connection context */
  teamUuid: string;
}

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  /** Source identifier */
  source: AISource;
  /** Chat ID */
  chatId: string;
  /** Message index */
  messageIndex: number;
  /** Agent type for tool filtering */
  agentType?: AgentType;
  /** File UUID for subagent requests */
  fileUuid?: string;
  /** Team UUID for subagent requests */
  teamUuid?: string;
  /** Model key used by the main agent (for subagents to inherit) */
  modelKey?: AIModelKey;
  /** Abort signal from the main session (for subagents to respect cancel) */
  abortSignal?: AbortSignal;
}

/**
 * Options for API requests
 */
export interface APIRequestOptions {
  /** Chat ID for tracking */
  chatId: string;
  /** Source identifier */
  source: string;
  /** Message source for analytics */
  messageSource: string;
  /** Model to use */
  modelKey: AIModelKey;
  /** Whether to use streaming */
  useStream: boolean;
  /** Abort signal */
  signal: AbortSignal;
  /** File UUID */
  fileUuid: string;
}

/**
 * Response from an AI API request
 */
export interface AIAPIResponse {
  /** Whether there was an error */
  error?: boolean;
  /** Response content (includes thinking/reasoning content types) */
  content: AIResponseContent;
  /** Tool calls from the response */
  toolCalls: AIToolCall[];
  /** Token usage from the API response */
  usage?: AIUsage;
}

/**
 * Callback for streaming message updates
 */
export type StreamingMessageCallback = (message: ChatMessage) => void;

/**
 * Callback for exceeded billing limit
 */
export type ExceededBillingLimitCallback = (exceeded: boolean) => void;
