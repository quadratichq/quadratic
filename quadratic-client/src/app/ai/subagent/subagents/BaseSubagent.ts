import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { SubagentType } from '../SubagentType';
import { getAllowedToolsForSubagentType } from '../subagentTypeToAgentType';

/**
 * Abstract base class for all subagents.
 * Provides common configuration defaults.
 * Tool allowlist is centralized in quadratic-shared AGENT_TOOL_CONFIG.
 */
export abstract class BaseSubagent {
  /** The unique type identifier for this subagent */
  abstract readonly type: SubagentType;

  /** Tools this subagent is allowed to use (from shared AGENT_TOOL_CONFIG) */
  get allowedTools(): AITool[] {
    return getAllowedToolsForSubagentType(this.type);
  }

  /** System prompt that defines the subagent's behavior */
  abstract readonly systemPrompt: string;

  /** Short description shown in UI */
  abstract readonly description: string;

  /** Maximum tool call iterations before stopping */
  readonly maxIterations: number = 10;
}
