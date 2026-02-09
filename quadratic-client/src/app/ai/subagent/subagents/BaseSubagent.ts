import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { SubagentType } from '../SubagentType';

/**
 * Abstract base class for all subagents.
 * Provides common configuration defaults.
 */
export abstract class BaseSubagent {
  /** The unique type identifier for this subagent */
  abstract readonly type: SubagentType;

  /** Tools this subagent is allowed to use */
  abstract readonly allowedTools: AITool[];

  /** System prompt that defines the subagent's behavior */
  abstract readonly systemPrompt: string;

  /** Short description shown in UI */
  abstract readonly description: string;

  /** Maximum tool call iterations before stopping */
  readonly maxIterations: number = 10;
}
