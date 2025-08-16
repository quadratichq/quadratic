import type { AIToolSpecRecord } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';

/// Returns a list of AI Tools in the order they are defined in the AITool enum.
export const getAIToolsInOrder = (): [AITool, AIToolSpecRecord[keyof AIToolSpecRecord]][] => {
  return Object.values(AITool).map((tool): [AITool, AIToolSpecRecord[keyof AIToolSpecRecord]] => [
    tool,
    aiToolsSpec[tool],
  ]);
};
