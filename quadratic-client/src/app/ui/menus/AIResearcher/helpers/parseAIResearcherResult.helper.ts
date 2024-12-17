import { AITool } from '@/app/ai/tools/aiTools';
import { AIToolsArgsSchema } from '@/app/ai/tools/aiToolsSpec';
import { ExaSearchResultSchema } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

export const AIResearcherResultSchema = z.object({
  exaResults: z.array(ExaSearchResultSchema).optional(),
  autopromptString: z.string().optional(),
  toolCallArgs: AIToolsArgsSchema[AITool.SetAIResearcherResult],
});

export type AIResearcherResultType = z.infer<typeof AIResearcherResultSchema>;

export const parseAIResearcherResult = (
  ai_researcher_result_stringified?: string | null
): AIResearcherResultType | undefined => {
  if (!ai_researcher_result_stringified) {
    return undefined;
  }

  let aiResearcherResult = undefined;
  try {
    const aiResearcherResultJson = JSON.parse(ai_researcher_result_stringified);
    aiResearcherResult = AIResearcherResultSchema.parse(aiResearcherResultJson);
  } catch (e) {
    console.warn(e);
  }
  return aiResearcherResult;
};
