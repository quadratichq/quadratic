import { sheets } from '@/app/grid/controller/Sheets';
import { JsCellValuePos } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useVisibleContextMessages() {
  const getVisibleContextMessages = useCallback(
    (
      bounds: Rectangle | undefined,
      cursorData: JsCellValuePos | null,
      visibleData: (JsCellValuePos | null)[][],
      model: AnthropicModel | OpenAIModel
    ): (UserMessage | AIMessage)[] => {
      return [
        {
          role: 'user',
          content: `I have a sheet open.\n
${
  bounds
    ? `Data on this sheet starts at x:${bounds.x} and y:${bounds.y} and ends at x:${bounds.x + bounds.width} and y:${
        bounds.y + bounds.height
      }.\n
      It is not necessary that this entire range has values. Cells can be empty or have values.`
    : ''
}
I am sharing visible data with you to refer to in following queries.\n
This visible data is represented as a 2D arrays of cell values visible on the sheet.\n
Each cell value is a JSON object having the following properties:\n
  - value: The value of the cell. This is a string representation of the value in the cell.\n
  - kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
  - pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

Data from cells can be referenced by Formulas, Python, JavaScript or SQL code using \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions.\n
When referencing cells in Python, to create a pandas DataFrame, if the first row of cells is a header, you should set first_row_header as an argument i.e. \`cells((2, 2), (7, 52), first_row_header=True)\`. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.\n
Use this visible data in the context of following messages. Refer to cells if required in code.\n\n

Current visible data is:\n
${JSON.stringify(visibleData)}\n\n

${
  cursorData
    ? `My cursor is on cell x:${cursorData.pos.x} and y:${cursorData.pos.y}.\n 
Data in this cell is:\n
${JSON.stringify(cursorData)}\n\n`
    : ''
}

Note: All this data is only for your reference to data on the sheet. This JSON cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.`,
          internalContext: true,
          contextType: 'visibleData',
        },
        {
          role: 'assistant',
          content: `I understand the visible data, I will reference it to answer following messages. How can I help you?`,
          model: model,
          internalContext: true,
          contextType: 'visibleData',
        },
      ];
    },
    []
  );

  const getVisibleContext = useCallback(
    async ({ model }: { model: AnthropicModel | OpenAIModel }) => {
      const visibleValues = await quadraticCore.getCellValueSelection(sheets.getRustVisibleSelection());
      if (visibleValues) {
        const bounds = sheets.sheet.getBounds(true);
        const visibleData = visibleValues.rects[0];
        const cursorData = visibleValues.cursor;
        return getVisibleContextMessages(bounds, cursorData, visibleData, model);
      }
      return [];
    },
    [getVisibleContextMessages]
  );

  return { getVisibleContext };
}
