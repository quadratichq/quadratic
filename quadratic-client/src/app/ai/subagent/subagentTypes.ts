import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';

/**
 * Types of subagents available for delegation.
 * Each subagent type has a specific purpose and set of allowed tools.
 */
export enum SubagentType {
  /** Finds, explores, and summarizes data in the spreadsheet */
  DataFinder = 'data_finder',
  // Future subagent types:
  // Formatter = 'formatter',
  // Analyzer = 'analyzer',
  // Validator = 'validator',
}

/**
 * Configuration for a subagent type.
 */
export interface SubagentConfig {
  /** The subagent type this config is for */
  type: SubagentType;
  /** Tools this subagent is allowed to use */
  allowedTools: AITool[];
  /** Default model to use for this subagent (can be overridden) */
  defaultModelKey: AIModelKey;
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
  /** Override the default model for this subagent */
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
 * Configuration for all subagent types.
 */
export const SUBAGENT_CONFIGS: Record<SubagentType, SubagentConfig> = {
  [SubagentType.DataFinder]: {
    type: SubagentType.DataFinder,
    allowedTools: [
      AITool.GetCellData,
      AITool.HasCellData,
      AITool.TextSearch,
      AITool.GetDatabaseSchemas,
      // AITool.GetSheetData, // Will be added when we create this tool
    ],
    // Use a cheap/fast model by default for data exploration
    defaultModelKey: 'vertexai:gemini-2.5-flash-lite:thinking-toggle-on',
    systemPrompt: `You are a data exploration assistant. Your job is to find and summarize data in a spreadsheet.

## Your Task
1. Find data in the spreadsheet based on the user's request
2. Summarize what you found concisely
3. Return cell ranges and brief descriptions

## Guidelines
- Be efficient: use has_cell_data before get_cell_data when checking if data exists
- Focus on the current sheet first, then explore others if needed
- Keep summaries brief but informative
- Always include the exact cell ranges for data you find

## Response Format
When you're done exploring, respond with a structured summary like:
- Summary: [Brief description of what you found]
- Ranges found:
  - Sheet1!A1:F100: [Description]
  - Sheet2!B5:D20: [Description]

If you can't find the requested data, explain what you searched and suggest alternatives.`,
    maxIterations: 10,
    description: 'Searching for data',
  },
};

/**
 * Get the configuration for a subagent type.
 */
export function getSubagentConfig(type: SubagentType): SubagentConfig {
  const config = SUBAGENT_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown subagent type: ${type}`);
  }
  return config;
}

/**
 * Check if a tool is allowed for a subagent type.
 */
export function isToolAllowedForSubagent(type: SubagentType, tool: AITool): boolean {
  const config = SUBAGENT_CONFIGS[type];
  return config?.allowedTools.includes(tool) ?? false;
}

/**
 * Get all subagent types as an array (for tool spec enum).
 */
export function getAllSubagentTypes(): SubagentType[] {
  return Object.values(SubagentType);
}
