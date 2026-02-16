import type { AITool } from '../specs/aiToolsCore';

/**
 * Types of agents that can make AI requests.
 */
export enum AgentType {
  /** Main agent with all tools available */
  MainAgent = 'main_agent',
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
    // All tools available
  },
};

/**
 * Check if a tool is allowed for a given agent type.
 */
export function isToolAllowedForAgent(agentType: AgentType, tool: AITool): boolean {
  const config = AGENT_TOOL_CONFIG[agentType];

  if (!config) {
    return true;
  }

  if (config.allowedTools) {
    return config.allowedTools.includes(tool);
  }

  if (config.disabledTools) {
    return !config.disabledTools.includes(tool);
  }

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
