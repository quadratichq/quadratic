import { ExaSearchResult, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useAIResearcherMessagePrompt() {
  const getAIResearcherMessagePrompt = useCallback(
    ({
      query,
      refCellValues,
      exaResult,
    }: {
      query: string;
      refCellValues: string;
      exaResult?: ExaSearchResult[];
    }): UserMessagePrompt => {
      return {
        role: 'user',
        content: `You are an AI Researcher. You are tasked with finding accurate answer to the following user query:
  \`\`\`plaintext
  ${query}
  \`\`\`\n
  
  You should use the set_ai_researcher_value function to set this result value directly in the spreadsheet.\n
  Don't include any preamble or other text, just the value.\n
  Answer in simple value (text or number), not markdown.\n
  For numerical results, don't include any units or other text, just the number. Don't include any formatting like commas or decimals. Don't include suffixes like million, billion, etc, answer with all digits.\n
  
  Answer should be in strong correlation to the following reference cell value(s) from the spreadsheet:
  \`\`\`plaintext
  ${refCellValues}
  \`\`\`\n

  ${
    exaResult
      ? `
  I have done a search and I am providing you with the results as an array of objects, having the following properties:
  - title: The title of the search result.
  - url: The url of the search result.
  - publishedDate: The published date of the search result, if available.
  - author: The author of the search result, if available.
  - score: Similarity score between query/url and result. Higher score means more relevant to the query, if available.
  - text: The text of the search result, if available.
  - highlights: The highlights of the search result, if available.
  - summary: The summary of the search result, if available.
  
  You should use the following search results to answer the query:\n
  \`\`\`json
  ${JSON.stringify(exaResult, null, 2)}
  \`\`\`
  `
      : ''
  }

 
  `,
        contextType: 'userPrompt',
      };
    },
    []
  );

  return { getAIResearcherMessagePrompt };
}
