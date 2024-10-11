import { UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useAIResearcherContextMessages() {
  const getAIResearcherMessages = useCallback((query: string, refCellValues: string): UserMessage => {
    return {
      role: 'user',
      content: `You are an AI Researcher. You are tasked with finding accurate answer to the following user query:
\`\`\`plaintext
${query}
\`\`\`\n

You should use the set_ai_researcher_value function to set this result value.\n
Don't include any preamble or other text, just the value.\n
Answer in simple value (text or number), not markdown.\n
For numerical results, don't include any units or other text, just the number. Don't include any formatting like commas or decimals. Don't include suffixes like million, billion, etc, answer with all digits.\n

Answer should be in strong correlation to the following reference cell value(s) from the spreadsheet:
\`\`\`plaintext
${refCellValues}
\`\`\`\n
`,
      internalContext: false,
      contextType: 'userPrompt',
    };
  }, []);

  const getAIResearcherContext = useCallback(
    async ({ prompt, refCellValues }: { prompt: string; refCellValues: string }) => {
      return getAIResearcherMessages(prompt, refCellValues);
    },
    [getAIResearcherMessages]
  );

  return { getAIResearcherContext };
}
