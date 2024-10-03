import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { GridBounds, JsCellValuePos, Rect } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useVisibleContextMessages() {
  const getVisibleContextMessages = useCallback(
    (
      bounds: GridBounds,
      cursorData: JsCellValuePos | null,
      visibleRect: Rect,
      visibleHasData: boolean,
      visibleData: JsCellValuePos[][],
      model: AnthropicModel | OpenAIModel
    ): (UserMessage | AIMessage)[] => {
      return [
        {
          role: 'user',
          content: `Note: Treat this message as an internal message for context. Don't quote it in your response.\n\n
I have a sheet open. 
${
  bounds.type === 'nonEmpty'
    ? `Data on this sheet starts at x:${bounds.min.x} and y:${bounds.min.y} and ends at x:${bounds.max.x} and y:${bounds.max.y}.\n
It is not necessary that this entire range has values. Cells can have values or be empty.`
    : 'This sheet has no data on it.'
}\n\n

On the viewport, the visible region of the sheet starts at x:${visibleRect.min.x} and y:${visibleRect.min.y} to x:${
            visibleRect.max.x
          } and y:${visibleRect.max.y}.\n
${
  visibleHasData
    ? `
It is not necessary that this entire range has values. Cells can have values or be empty.\n
I am sharing visible data with you to refer to in following queries.\n
This visible data is represented as a 2D arrays of cell values.\n
Each cell value is a JSON object having the following properties:\n
  - value: The value of the cell. This is a string representation of the value in the cell.\n
  - kind: The kind of the value. This can be blank, text, number, logical, time instant, duration, error, html, code, image, date, time, date time, null or undefined.\n
  - pos: This is a JSON object having x and y properties. x is the column index and y is the row index of the cell.\n\n

Data from cells can be referenced by Formulas, Python, JavaScript or SQL code using \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions.\n
Use this visible data in the context of following messages. Refer to cells if required in code.\n\n

Current visible data is:\n
\`\`\`json
${JSON.stringify(visibleData)}
\`\`\`

Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.`
    : 'This visible part of the sheet is empty.'
}\n

${
  cursorData
    ? `My cursor is on cell x:${cursorData.pos.x} and y:${cursorData.pos.y}.\n 
Data in this cell is:\n
\`\`\`json
${JSON.stringify(cursorData)}
\`\`\`
`
    : ''
}`,
          internalContext: true,
          contextType: 'visibleData',
        },
        {
          role: 'assistant',
          content: `I understand the visible data, I will reference it to answer following messages. How can I help you?`,
          model,
          internalContext: true,
          contextType: 'visibleData',
        },
      ];
    },
    []
  );

  const getVisibleContext = useCallback(
    async ({ model }: { model: AnthropicModel | OpenAIModel }) => {
      const visibleValues = await quadraticCore.getCellValuesInSelection(sheets.getRustVisibleSelection());
      if (visibleValues) {
        const sheetBounds = sheets.sheet.boundsWithoutFormatting;
        const cursorData = visibleValues.cursor;
        const visibleRect = sheets.getVisibleRect();
        const visibleHasData =
          sheetBounds.type === 'nonEmpty' &&
          intersects.rectRect({ min: sheetBounds.min, max: sheetBounds.max }, visibleRect);
        const visibleData = visibleValues.rects[0];
        return getVisibleContextMessages(sheetBounds, cursorData, visibleRect, visibleHasData, visibleData, model);
      }
      return [];
    },
    [getVisibleContextMessages]
  );

  return { getVisibleContext };
}
