import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { SubagentType } from '../SubagentType';
import type { SubagentConfig } from '../subagentTypes';

/**
 * Abstract base class for all subagents.
 * Provides common configuration defaults and a method to get the config object.
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

  /** Default model to use for this subagent (can be overridden) */
  readonly defaultModelKey = undefined;

  /** Maximum tool call iterations before stopping */
  readonly maxIterations: number = 10;

  /**
   * Get the configuration object for this subagent.
   * Used to populate SUBAGENT_CONFIGS.
   */
  getConfig(): SubagentConfig {
    return {
      type: this.type,
      allowedTools: this.allowedTools,
      defaultModelKey: this.defaultModelKey,
      systemPrompt: this.systemPrompt,
      maxIterations: this.maxIterations,
      description: this.description,
    };
  }
}
