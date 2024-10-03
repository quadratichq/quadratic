import { JsCellValuesInSelection, Selection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useCursorSelectionContextMessages() {
  const getCursorSelectionContextMessages = useCallback(
    (
      cursorSelectionValues: JsCellValuesInSelection,
      model: AnthropicModel | OpenAIModel
    ): (UserMessage | AIMessage)[] => {
      return [
        {
          role: 'user',
          content: `Note: Treat this message as an internal message for context. Don't quote it in your response.\n\n
Quadratic, like most spreadsheets, allows the user to select cells on the sheet.\n
This cursor selection data is being shared with you, for you to refer to in following queries.\n
Cursor selection data being shared is represented as a JSON object, having the following properties:\n
  - cursor: A single cell, which is the cell that the user has last clicked on. This is a single cell value.\n
  - all: This contains values when the user has made a "select all" selection. This is a 2D array of cell values.\n
  - rows: This contains values when the user has selected all values in certain rows. This is a 2D array of cell values. Each sub-array represents a row.\n
  - columns: This contains values when the user has selected all values in certain columns. This is a 2D array of cell values. Each sub-array represents a column.\n
  - rects: This contains values when the user has selected rectangles of values on the sheet. Multiple rectangles can be selected. This is an array of 2D arrays of cell values. Each 2D array represents a rectangle of cell values selected on the sheet.\n\n
Each cell value is a JSON object having the following properties:\n
  - value: The value of the cell. This is a string representation of the value in the cell.\n
  - kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
  - pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

Data from cells can be referenced by Formulas, Python, JavaScript or SQL code using \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions.\n
When referencing cells in Python, to create a pandas DataFrame, if the first row of cells is a header, you should set first_row_header as an argument i.e. \`cells((2, 2), (7, 52), first_row_header=True)\`. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.\n
Use this selection data in the context of following messages. Refer to cells if required in code.\n\n

Current selection JSON is:\n
\`\`\`json
${JSON.stringify(cursorSelectionValues)}
\`\`\`

Note: This selection JSON is only for your reference to data on the sheet. This JSON cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.`,
          internalContext: true,
          contextType: 'cursorSelection',
        },
        {
          role: 'assistant',
          content: `I understand the cursor selection data, I will reference it to answer following messages. How can I help you?`,
          model: model,
          internalContext: true,
          contextType: 'cursorSelection',
        },
      ];
    },
    []
  );

  const getCursorSelectionContext = useCallback(
    async ({ selection, model }: { selection: Selection | undefined; model: AnthropicModel | OpenAIModel }) => {
      if (!selection) return [];
      const cursorSelectionValues = await quadraticCore.getCellValuesInSelection(selection);
      if (cursorSelectionValues) {
        return getCursorSelectionContextMessages(cursorSelectionValues, model);
      }
      return [];
    },
    [getCursorSelectionContextMessages]
  );

  return { getCursorSelectionContext };
}
