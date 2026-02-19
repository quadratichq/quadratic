// AI Session - Class-based architecture for AI requests
// This replaces the React hook-based approach in useSubmitAIAnalystPrompt

// Main session class
export { AISession, aiSession } from './AISession';

// Core components
export { AIAPIClient, aiAPIClient } from './AIAPIClient';
export { ContextBuilder, contextBuilder } from './ContextBuilder';
export { MessageManager, messageManager } from './MessageManager';
export { ToolExecutor, toolExecutor } from './ToolExecutor';

// Types
export type {
  AIAPIResponse,
  AISessionRequest,
  AISessionResult,
  APIRequestOptions,
  ContextOptions,
  ExceededBillingLimitCallback,
  ImportFile,
  StreamingMessageCallback,
  ToolExecutionOptions,
} from './types';
