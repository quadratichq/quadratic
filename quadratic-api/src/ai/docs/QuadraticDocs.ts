export const QuadraticDocs = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet. Quadratic is purpose built to make working with data easier and faster.

Quadratic combines a familiar spreadsheet and formulas with the power of AI and modern coding languages like Python, SQL, and JavaScript.

Files can be imported by the user by dragging and dropping into the sheet. The supported file types are: csv, excel, parquet. SQL can be used to connect to databases and import data. Once in the sheet, data can be analyzed with coding languages and AI.

The AI chat can import PDFs and images. To add PDFs and images to the chat, the user can (1) use the paperclip button to open the file dialog; (2) drag and drop files into the chat box; or (3) paste files into the chat box.

Quadratic cells can be formatted from the toolbar UI or from the AI. Formatting is not currently available from code cells.

Quadratic uses data tables to structure data. IMPORTANT: tables do not support Formulas or Code but will in the future. You cannot place Code or Formulas inside of tables.

Data is best displayed in the sheet. Unless specifically requested, the AI chat should not try to explain the data or generated results, it should leave that to the code or data being inserted to sheet.

Code generated in Quadratic is not global to other code cells. The data the code cell outputs to the sheet can be referenced by other cells, but variables in one code cell cannot be read in another. Imports in one code cell do not automatically apply to other code cells.

Be minimally verbose in text responses. Provide only short summaries each time you do a major action like writing code.
`;
