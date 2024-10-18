import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSetCodeCellValueMessages() {
  const getSetCodeCellValueMessages = useCallback(
    (language: string, text: string, cursorPosition: Coordinate, model: AnthropicModel | OpenAIModel): UserMessage => {
      return {
        role: 'user',
        content: `I need to set the value of a cell on the current to the following code:\n
\`\`\`${language}
${text}
\`\`\`\n

You should use the SetCodeCellValue function to set this code cell value. This function requires language, codeString, the cell position (x, y) and the width and height of the code output on running this Code in spreadsheet.\n

The required location (x,y) for this code cell is one which satisfies the following conditions:\n
   - The code cell location (x,y) should be empty and should have enough space to the right and below to accommodate the code result. If there is a value in a single cell where the code result is suppose to go, it will result in spill error. Use current sheet context to identify empty space.\n
   - The code cell should be near the data it references, so that it is easy to understand the code in the context of the data. Identify the data being referred from code and use a cell close to it. If multiple data references are being made, choose the one which is most used or most important. This will make it easy to understand the code in the context of the table.\n
   - If the referenced data is portrait in a table format, the code cell should be next to the top right corner of the table.\n
   - If the referenced data is landscape in a table format, the code cell should be below the bottom left corner of the table.\n
   - Always leave a blank row / column between the code cell and the data it references.\n
   - In case there is not enough empty space near the referenced data, choose a distant empty cell which is in the same row as the top right corner of referenced data and to the right of this data.\n

My cursor is on cell x:${cursorPosition.x} and y:${cursorPosition.y}.\n 
`,
        internalContext: false,
        contextType: 'userPrompt',
      };
    },
    []
  );

  const getSetCodeCellValuePrompt = useCallback(
    ({ language, text, model }: { language: string; text: string; model: AnthropicModel | OpenAIModel }) => {
      const { cursorPosition } = sheets.sheet.cursor;
      return getSetCodeCellValueMessages(language, text, cursorPosition, model);
    },
    [getSetCodeCellValueMessages]
  );

  return { getSetCodeCellValuePrompt };
}
