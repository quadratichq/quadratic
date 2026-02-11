import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AGENT_TOOL_CONFIG, AgentType } from 'quadratic-shared/ai/agents';
import { SubagentType } from './SubagentType';

/**
 * Map SubagentType to AgentType for API requests and shared tool config lookup.
 * Kept in one place so both SubagentRunner and BaseSubagent can use it without circular deps.
 */
export const SUBAGENT_TO_AGENT_TYPE: Record<SubagentType, AgentType> = {
  [SubagentType.DataFinder]: AgentType.DataFinderSubagent,
  [SubagentType.FormulaCoder]: AgentType.FormulaCoderSubagent,
  [SubagentType.PythonCoder]: AgentType.PythonCoderSubagent,
  [SubagentType.JavascriptCoder]: AgentType.JavascriptCoderSubagent,
  [SubagentType.ConnectionCoder]: AgentType.ConnectionCoderSubagent,
};

/**
 * Allowed tools for a subagent type (from shared AGENT_TOOL_CONFIG).
 */
export function getAllowedToolsForSubagentType(subagentType: SubagentType): AITool[] {
  const config = AGENT_TOOL_CONFIG[SUBAGENT_TO_AGENT_TYPE[subagentType]];
  return config?.allowedTools ?? [];
}
