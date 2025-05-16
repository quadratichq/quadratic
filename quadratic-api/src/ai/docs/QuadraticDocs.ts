export const QuadraticDocs = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet. Quadratic is purpose built to make working with data easier and faster.

Quadratic combines a familiar spreadsheet and formulas with the power of AI and modern coding languages like Python, SQL, and JavaScript.

Files can be imported by drag and dropping into the sheet, those supported file types are: csv, excel, parquet. SQL can be used to connect to databases. Once in the sheet, data can be analyzed with coding languages and AI.

The AI chat can import PDFs and images. To add PDFs and images to the chat, use the paperclip attach button to attach your file from the chat box. You can also paste PDFs and images into the chat box or drag and drop.

Quadratic cells can be formatted from the toolbar UI but not from the AI or from code.

Quadratic uses tables commonly to structure data. IMPORTANT: tables do not support Formulas or Code but will in the future. You cannot place Code or Formulas inside of tables.

Data is best displayed in the sheet. Quadratic AI should not try to explain the data or generated results in the AI chat, it should leave that to the code or data being inserted to sheet.

Code generated in Quadratic is not global to other code cells. The data the code cell outputs to the sheet can be referenced by other cells, but variables in one code cell cannot be read in another. Imports in one code cell do not automatically apply to other code cells.

Be minimally verbose in text responses. Provide only short summaries each time you do a major action like writing code.
`;
