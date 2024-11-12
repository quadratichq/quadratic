import { sheets } from '@/app/grid/controller/Sheets';
import { maxRects } from '@/app/ui/menus/AIAnalyst/const/maxRects';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useVisibleContextMessages() {
  const getVisibleContext = useCallback(async (): Promise<ChatMessage[]> => {
    const sheetBounds = sheets.sheet.boundsWithoutFormatting;
    const visibleSheetRect = sheets.getVisibleSheetRect();
    const [visibleRectContext, erroredCodeCells] = visibleSheetRect
      ? await Promise.all([
          quadraticCore.getAIContextRectsInSheetRects([visibleSheetRect], maxRects),
          quadraticCore.getErroredCodeCellsInSheetRects([visibleSheetRect]),
        ])
      : [undefined, undefined];

    return [
      {
        role: 'user',
        content: `Note: This is an internal message for context. Do not quote it in your response.\n\n
I have an open sheet with the following data:
${
  sheetBounds.type === 'nonEmpty'
    ? `- Data range: from (${sheetBounds.min.x}, ${sheetBounds.min.y}) to (${sheetBounds.max.x}, ${sheetBounds.max.y})
- Note: This range may contain empty cells.`
    : '- The sheet is currently empty.'
}\n\n

${
  visibleRectContext && visibleRectContext.length === 1 && visibleRectContext[0].length > 0
    ? `
Visible data in the viewport:\n

I am sharing visible data as an array of tabular data rectangles, each tabular data rectangle in this array has following properties:\n
- sheet_name: This is the name of the sheet.\n
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
Use this visible data in the context of following messages. Refer to cells if required in code.\n\n

Current visible data is:\n
\`\`\`json
${JSON.stringify(visibleRectContext[0])}
\`\`\`
Note: All this data is only for your reference to data on the sheet. This data cannot be used directly in code. Use the cell reference functions, like \`c(x,y)\` or \`cells((x1,y1), (x2,y2))\` functions, to reference cells in code.\n\n
`
    : `This visible part of the sheet has no data.\n`
}\n

${
  erroredCodeCells && erroredCodeCells.length === 1 && erroredCodeCells[0].length > 0
    ? `
Note: There are code cells in the visible part of the sheet that have errors. Use this to understand if the code cell has any errors and take action when prompted by user to specifically solve the error.\n\n

Add imports to the top of the code cell and do not use any libraries or functions that are not listed in the Quadratic documentation.\n
Use any functions that are part of the code cell language library.\n
A code cell can return only one type of value as specified in the Quadratic documentation.\n
A code cell cannot display both a chart and return a data frame at the same time.\n
A code cell cannot display multiple charts at the same time.\n
Do not use any markdown syntax besides triple backticks for code cell language code blocks.\n
Do not reply code blocks in plain text, use markdown with triple backticks and language name code cell language.

${erroredCodeCells[0].map(({ x, y, language, code_string, std_out, std_err }) => {
  const consoleOutput = {
    std_out: std_out ?? '',
    std_err: std_err ?? '',
  };
  return `
The code cell type is ${language}. The code cell is located at ${x}, ${y}.\n

The code in the code cell is:\n
\`\`\`${language}\n${code_string}\n\`\`\`

Code was run recently and the console output is:\n
\`\`\`json\n${JSON.stringify(consoleOutput)}\n\`\`\`
`;
})}`
    : ''
}
`,
        contextType: 'visibleData',
      },
      {
        role: 'assistant',
        content: `I understand the visible data, I will reference it to answer following messages. How can I help you?`,
        contextType: 'visibleData',
      },
    ];
  }, []);

  return { getVisibleContext };
}
