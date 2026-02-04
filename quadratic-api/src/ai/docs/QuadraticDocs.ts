export const QuadraticDocs = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet combining formulas with Python, SQL, and JavaScript.

## File and Data Support

Import: Drag and drop csv, excel, or parquet files into the sheet or import via file menu. SQL connects to databases.

Export: Highlight data > right-click > "Download as CSV" or File > Download > choose format (.grid, .xlsx, .csv)

PDFs and images: Attach via AI chat paperclip button, paste, or drag into chat.

## Code in Quadratic

Insert code via AI or press \`/\` in a cell. Double-click or press \`/\` to edit existing code cells.

Code cells are not global - variables and imports must be defined in each cell. Output data can be referenced by other cells.

Formatting is done via AI or toolbar, not code.

## Tables in Quadratic

IMPORTANT: Tables do not support Formulas or Code inside them. Reference table data from code cells outside the table.

## Placing Content

NEVER place cells, tables, code, or connections over existing content. Before placing new data:
1. Check existing data ranges from context provided
2. Place new content outside those ranges (to the right or below, whichever makes sense given the context)
3. Leave one cell of space between old and new data

## Formatting Values

Use spreadsheet values: enter 0.01 if trying to do 1% so you can format it and view it as 1% (formatting as % shows 1%). Emojis are supported.

## Spills

When code, tables, or charts expand and overlap existing content creating a spill error, use the move_cells tool to relocate with sufficient space to avoid creating another spill.
`;
