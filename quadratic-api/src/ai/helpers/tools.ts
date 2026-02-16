import type { AIToolSpecRecord } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AISource, AIToolArgs, ModelMode } from 'quadratic-shared/typesAndSchemasAI';

/**
 * Ensures the tool parameters schema has additionalProperties: false.
 * Required by OpenAI for function tools when strict=true, and valid in non-strict mode.
 */
export const ensureStrictSchema = (parameters: AIToolArgs): AIToolArgs => {
  return { ...parameters, additionalProperties: false };
};

/** Returns a list of AI Tools in the order they are defined in the AITool enum. */
export const getAIToolsInOrder = (): [AITool, AIToolSpecRecord[keyof AIToolSpecRecord]][] => {
  return Object.values(AITool).map((tool): [AITool, AIToolSpecRecord[keyof AIToolSpecRecord]] => [
    tool,
    aiToolsSpec[tool],
  ]);
};

export interface FilterToolsOptions {
  /** The source requesting the tools (e.g., 'AIAnalyst') */
  source: AISource;
  /** The model mode for filtering tools */
  aiModelMode: ModelMode;
  /** Optional specific tool to filter for */
  toolName?: AITool;
}

/**
 * Centralized tool filtering function.
 *
 * Filters tools based on:
 * - Source (e.g., AIAnalyst, AIAssistant)
 * - Model mode (e.g., fast, max)
 * - Specific tool name (if provided)
 */
export const getFilteredTools = (options: FilterToolsOptions): [AITool, AIToolSpecRecord[keyof AIToolSpecRecord]][] => {
  const { source, aiModelMode, toolName } = options;

  return getAIToolsInOrder().filter(([name, toolSpec]) => {
    // Filter by model mode
    if (!toolSpec.aiModelModes.includes(aiModelMode)) {
      return false;
    }

    // Filter by specific tool name or source
    if (toolName === undefined) {
      return toolSpec.sources.includes(source);
    }
    return name === toolName;
  });
};
