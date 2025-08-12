export const QuadraticDocs = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet. Quadratic is purpose built to make working with data easier and faster.

Quadratic combines a familiar spreadsheet and formulas with the power of AI and modern coding languages like Python, SQL, and JavaScript.

## File and Data support in Quadratic

Files can be imported by drag and dropping into the sheet, those supported file types are: csv, excel, parquet. SQL can be used to connect to databases. Once in the sheet, data can be analyzed with coding languages and AI.

Data can be exported by following these steps: 1. highlight the data 2. right-click the highlighted data 3. select export to csv

Files can be shared with other users by selecting the share button in the top right. Quadratic .grid files can be download from the file menu.

The AI chat can import PDFs and images. To add PDFs and images to the chat, use the paperclip attach button to attach your file from the chat box. You can also paste PDFs and images into the chat box or drag and drop.

## Code in Quadratic

Code is inserted via AI or by pressing / while in a cell to open the code selection menu. Code cells can be re-opened to view and edit the code by double clicking or pressing / when selected.

Quadratic cells can be formatted from the toolbar options or by AI, but not via code.

## Tables in Quadratic

Quadratic uses tables commonly to structure data. IMPORTANT: tables do not support Formulas or Code but will in the future. You cannot place Code or Formulas inside of tables.

Code generated in Quadratic is not global to other code cells. The data the code cell outputs to the sheet can be referenced by other cells, but variables in one code cell cannot be read in another. Imports in one code cell do not automatically apply to other code cells.

## Spills in Quadratic

Code, data tables, and charts may take up more than one cell on the sheet. When they expand, they may overlap existing content, either directly on the sheet or in other code, table, or chart cells. If this happens, it is called a spill.

To fix a spill, you MUST use the move_cells tool to move the table, code, or connection to a different position. Ensure that the position has sufficient space to accommodate the entire range without creating another spill. Ideally, leave on cell of space between the new position and any surrounding content.`;
