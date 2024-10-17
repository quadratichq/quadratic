import { JsCellValuePosAIContext, SheetRect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useSelectionContextMessages() {
  const getSelectionContextMessages = useCallback(
    (selectionContext: JsCellValuePosAIContext[], model: AnthropicModel | OpenAIModel): (UserMessage | AIMessage)[] => {
      return [
        {
          role: 'user',
          content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
Quadratic, like most spreadsheets, allows the user to select cells on the sheet.\n

This selection data is being shared with you, for you to refer to in following queries.\n

I am sharing selection data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
  - rect_origin: This is a JSON object having x and y properties. x is the column index and y is the row index of the top left cell of the rectangle.\n
  - rect_width: This is the width of the rectangle in number of columns.\n
  - rect_height: This is the height of the rectangle in number of rows.\n
  - starting_rect_values: This is a 2D array of cell values (json object format described below). This is the starting 3 rows of data in the rectangle. This includes headers, if present, and data.\n

Each cell value is a JSON object having the following properties:\n
  - value: The value of the cell. This is a string representation of the value in the cell.\n
  - kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
  - pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

This is being shared so that you can understand the table format, size and value types inside the data rectangle.\n

Data from cells can be referenced by Formulas, Python, Javascript or SQL code using \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions.\n
To reference data from different tabular data rectangles, use multiple \`cells\` functions.\n
Use this selection data in the context of following messages. Refer to cells if required in code.\n\n

Current selection data is:\n
\`\`\`json
${JSON.stringify(selectionContext)}
\`\`\`

Note: This selection JSON is only for your reference to data on the sheet. This JSON cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.`,
          internalContext: true,
          contextType: 'selection',
        },
        {
          role: 'assistant',
          content: `I understand the cursor selection data, I will reference it to answer following messages. How can I help you?`,
          model,
          internalContext: true,
          contextType: 'selection',
        },
      ];
    },
    []
  );

  const getSelectionContext = useCallback(
    async ({ sheetRect, model }: { sheetRect: SheetRect | undefined; model: AnthropicModel | OpenAIModel }) => {
      if (!sheetRect) return [];
      const selectionContext = await quadraticCore.getAIContextRectsInSheetRect(sheetRect);
      return selectionContext ? getSelectionContextMessages(selectionContext, model) : [];
    },
    [getSelectionContextMessages]
  );

  return { getSelectionContext };
}
