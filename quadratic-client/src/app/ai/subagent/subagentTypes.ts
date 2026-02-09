import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { SUBAGENTS } from './subagents';
import { SubagentType } from './SubagentType';

// Re-export SubagentType from the separate file to avoid circular dependencies
export { SubagentType } from './SubagentType';

/**
 * Configuration for a subagent type.
 */
export interface SubagentConfig {
  /** The subagent type this config is for */
  type: SubagentType;
  /** Tools this subagent is allowed to use */
  allowedTools: AITool[];
  /** System prompt for the subagent */
  systemPrompt: string;
  /** Maximum tool call iterations before stopping */
  maxIterations: number;
  /** Description shown in UI */
  description: string;
}

/**
 * Result from a subagent execution.
 */
export interface SubagentResult {
  /** Whether the subagent completed successfully */
  success: boolean;
  /** Summary of what was found/done */
  summary?: string;
  /** Ranges found (for data finder) */
  ranges?: SubagentRange[];
  /** Error message if failed */
  error?: string;
  /** Raw response content for debugging */
  rawContent?: string;
}

/**
 * A range found by the data finder subagent.
 */
export interface SubagentRange {
  /** Sheet name */
  sheet: string;
  /** Cell range (e.g., "A1:F100") */
  range: string;
  /** Description of what's in this range */
  description: string;
}

/**
 * Options for executing a subagent.
 */
export interface SubagentExecuteOptions {
  /** Type of subagent to run */
  subagentType: SubagentType;
  /** Task description for the subagent */
  task: string;
  /** Optional hints from the main conversation */
  contextHints?: string;
  /** Current model the user/session is using (used as subagent model unless overridden) */
  modelKey: AIModelKey;
  /** Optional override to use a different model for this subagent */
  modelKeyOverride?: AIModelKey;
  /** File UUID for API calls */
  fileUuid: string;
  /** Team UUID for connection context */
  teamUuid: string;
  /** Abort signal to cancel the subagent */
  abortSignal?: AbortSignal;
  /** If true, clears the subagent session and starts fresh */
  reset?: boolean;
  /** Callback when a tool call is made (for UI updates) */
  onToolCall?: (toolCall: SubagentToolCallEvent) => void;
  /** Callback when a tool call completes */
  onToolCallComplete?: (toolCallId: string) => void;
}

/**
 * Event emitted when a subagent makes a tool call.
 */
export interface SubagentToolCallEvent {
  /** Unique ID for this tool call */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments as JSON string */
  arguments?: string;
  /** Whether the tool is still loading */
  loading: boolean;
  /** Model key used for this tool call (for debug display) */
  modelKey?: string;
}

/**
 * Get the configuration for a subagent type.
 */
export function getSubagentConfig(type: SubagentType): SubagentConfig {
  const subagent = SUBAGENTS[type];
  if (!subagent) {
    throw new Error(`Unknown subagent type: ${type}`);
  }
  return {
    type: subagent.type,
    allowedTools: subagent.allowedTools,
    systemPrompt: subagent.systemPrompt,
    maxIterations: subagent.maxIterations,
    description: subagent.description,
  };
}

/**
 * Check if a tool is allowed for a subagent type.
 */
export function isToolAllowedForSubagent(type: SubagentType, tool: AITool): boolean {
  const subagent = SUBAGENTS[type];
  return subagent?.allowedTools.includes(tool) ?? false;
}

/**
 * Get all subagent types as an array (for tool spec enum).
 */
export function getAllSubagentTypes(): SubagentType[] {
  return Object.values(SubagentType);
}
