import type { JsCellValuePos, SheetPos } from '@/app/quadratic-core-types';
import { xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import type { ExaSearchResult, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useAIResearcherMessagePrompt() {
  const getAIResearcherMessagePrompt = useCallback(
    ({
      query,
      refCellValues,
      sheetPos,
      cellsAccessedValues,
      exaResult,
    }: {
      query: string;
      refCellValues: string;
      sheetPos: SheetPos;
      cellsAccessedValues: JsCellValuePos[][][];
      exaResult?: ExaSearchResult[];
    }): UserMessagePrompt => {
      return {
        role: 'user',
        content: `You are an AI Researcher. You are tasked with finding accurate answer to the following user query:

\`\`\`plaintext
${query}
\`\`\`\n

You should use the set_ai_researcher_result function to set this result value directly in the spreadsheet.\n
Don't include any preamble or other text, just the value.\n
Answer in simple value (text or number), not markdown.\n
For numerical results, don't include any units or other text, just the number. Don't include any formatting like commas or decimals. Don't include suffixes like million, billion, etc, answer with all digits.\n
  
Answer should be in strong correlation to the following reference cell value(s) from the spreadsheet:
\`\`\`plaintext
${refCellValues}
\`\`\`\n

These values are from the spreadsheet, I am providing you with their position, type and value as well so as to judge the structure of returned 2d array of strings values which will be used to set the value in the spreadsheet.\n
This is a array of 2d array rectangle of cells accessed by the user.
Each cell value is a JSON object having the following properties:\n
- value: The value of the cell. This is a string representation of the value in the cell.\n
- kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
- pos: This is the position of the cell in A1 notation. Columns are represented by letters and rows are represented by numbers.\n\n
\`\`\`json
${JSON.stringify(cellsAccessedValues)}
\`\`\`

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

AI Researcher cell is at the following position in the spreadsheet:
\`\`\`plaintext
${xyToA1(Number(sheetPos.x), Number(sheetPos.y))}
\`\`\`
This will be the top left cell of the values returned by you, the AI Researcher.
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
