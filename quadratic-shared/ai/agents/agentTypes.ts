import { AITool } from '../specs/aiToolsCore';

/**
 * Types of agents that can make AI requests.
 * Each agent type has a specific set of tools available to it.
 */
export enum AgentType {
  /** Main agent with full context and all tools */
  MainAgent = 'main_agent',
  /** Main agent with slim context - data exploration tools disabled */
  MainAgentSlim = 'main_agent_slim',
  /** Data finder subagent - read-only data exploration tools only */
  DataFinderSubagent = 'data_finder_subagent',
}

/**
 * Configuration for which tools are available to each agent type.
 *
 * - If `allowedTools` is set, ONLY those tools are available
 * - If `disabledTools` is set, all tools EXCEPT those are available
 * - If neither is set, all tools are available
 */
export interface AgentToolConfig {
  /** If set, only these tools are allowed (whitelist) */
  allowedTools?: AITool[];
  /** If set, these tools are excluded (blacklist) */
  disabledTools?: AITool[];
}

/**
 * Tool configuration for each agent type.
 * Used by both client (ToolExecutor) and API (getToolUseContext) to
 * filter which tools are available.
 */
export const AGENT_TOOL_CONFIG: Record<AgentType, AgentToolConfig> = {
  [AgentType.MainAgent]: {
    // All tools allowed
  },
  [AgentType.MainAgentSlim]: {
    // Data exploration tools are disabled - use delegate_to_subagent instead
    disabledTools: [AITool.GetCellData, AITool.HasCellData, AITool.TextSearch],
  },
  [AgentType.DataFinderSubagent]: {
    // Only read-only data exploration tools allowed
    allowedTools: [AITool.GetCellData, AITool.HasCellData, AITool.TextSearch, AITool.GetDatabaseSchemas],
  },
};

/**
 * Check if a tool is allowed for a given agent type.
 */
export function isToolAllowedForAgent(agentType: AgentType, tool: AITool): boolean {
  const config = AGENT_TOOL_CONFIG[agentType];

  if (!config) {
    // Unknown agent type - allow all tools
    return true;
  }

  if (config.allowedTools) {
    // Whitelist mode - only allowed tools
    return config.allowedTools.includes(tool);
  }

  if (config.disabledTools) {
    // Blacklist mode - all except disabled
    return !config.disabledTools.includes(tool);
  }

  // No restrictions
  return true;
}

/**
 * Get the list of allowed tools for an agent type.
 * Used to filter tools in API context building.
 */
export function getAllowedToolsForAgent(agentType: AgentType, allTools: AITool[]): AITool[] {
  return allTools.filter((tool) => isToolAllowedForAgent(agentType, tool));
}

/**
 * Get the list of disabled tools for an agent type (for error messages).
 */
export function getDisabledToolsForAgent(agentType: AgentType): AITool[] {
  const config = AGENT_TOOL_CONFIG[agentType];

  if (config?.disabledTools) {
    return config.disabledTools;
  }

  return [];
}
