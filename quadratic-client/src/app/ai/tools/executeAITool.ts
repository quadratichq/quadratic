import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { aiToolsActions } from './aiToolsActions';
import type { AIToolMessageMetaData } from './aiToolsHelpers';
import { parseToolArguments } from '../utils/parseToolArguments';

/**
 * Parse JSON tool arguments, validate with the tool's schema, and execute the tool.
 * Provides proper typing without `any` assertions.
 */
export async function executeAIToolFromJson<K extends AITool>(
  toolName: K,
  argsJson: string | undefined,
  metaData: AIToolMessageMetaData
): Promise<ToolResultContent> {
  const parsed = parseToolArguments(argsJson);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const args = aiToolsSpec[toolName].responseSchema.parse(parsed.value);
  return aiToolsActions[toolName](args, metaData);
}
