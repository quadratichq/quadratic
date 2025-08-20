export const QuadraticDocs = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet. Quadratic is purpose built to make working with data easier and faster.

Quadratic combines a familiar spreadsheet and formulas with the power of AI and modern coding languages like Python, SQL, and JavaScript.

## File and Data support in Quadratic

Files can be imported by drag and dropping into the sheet, those supported file types are: csv, excel, parquet. SQL can be used to connect to databases. Once in the sheet, data can be analyzed with coding languages and AI.

Data can be exported by following these steps: 1. highlight the data 2. right-click the highlighted data 3. select export to csv

You can also export via the file menu. File > Download > choose file type. You can export to Quadratic file type .grid, Excel as .xlsx, and CSV. 

Files can be shared with other users by selecting the share button in the top right. Quadratic .grid files can be download from the file menu.

The AI chat can import PDFs and images. To add PDFs and images to the chat, use the paperclip attach button to attach your file from the chat box. You can also paste PDFs and images into the chat box or drag and drop.

## Code in Quadratic

Code is inserted via AI or by pressing / while in a cell to open the code selection menu. Code cells can be re-opened to view and edit the code by double clicking or pressing / when selected.

Quadratic cells can be formatted from the toolbar options or by AI, but not via code.

## Tables in Quadratic

Quadratic uses tables commonly to structure data. IMPORTANT: tables do not support Formulas or Code but will in the future. You cannot place Code or Formulas inside of tables.

Code generated in Quadratic is not global to other code cells. The data the code cell outputs to the sheet can be referenced by other cells, but variables in one code cell cannot be read in another. Imports in one code cell do not automatically apply to other code cells.

## Placing cells, tables, code, and connections in Quadratic

Unless specifically requested, you MUST NOT place cells, tables, code, or connections over existing content on the sheet. In the context provided, you have information about where all data exists in the sheet. (Although you may not have the actual data, you have the ranges of all data.) Use that information to find the correct location to place any new data. Take into account the expected size of the new data, and ensure there is sufficient room for that data. Before placing any data, you MUST use these steps:

1. identify the existing data context using information provided to you (all information about data on the sheets is provided below)
2. identify empty spaces using the existing ranges. For example, if there is data in A1:D5, place the data outside that, below row 5 or to the right of column D
3. once you have done that calculation, place content in an empty area. In most cases, leave one cell of space between the old data and the new data

## Spills in Quadratic

Code, data tables, and charts may take up more than one cell on the sheet. When they expand, they may overlap existing content, either directly on the sheet or in other code, table, or chart cells. If this happens, it is called a spill.

To fix a spill, you MUST use the move_cells tool to move the table, code, or connection to a different position. Ensure that the position has sufficient space to accommodate the entire range without creating another spill. Ideally, leave on cell of space between the new position and any surrounding content.
`;
