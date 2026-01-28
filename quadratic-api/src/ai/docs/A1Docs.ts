export const A1Docs = `# A1 Docs

Cell references in Quadratic are in A1 notation.

## Rectangular Ranges

Rectangular ranges are references to a range of cells in a sheet. They are referenced by the top left cell and the bottom right cell. For example, A1:C3 is a rectangular range that references the cells A1, B1, C1, A2, B2, C2, A3, B3, and C3.

### Rectangular Range Examples

- D5 - references the cell D5
- A1:C3 - references the cells A1, B1, C1, A2, B2, C2, A3, B3, and C3
- A1:A3 - references the cells A1, A2, and A3
- A1:C1 - references the cells A1, B1, and C1

## Column and Row References

In A1 notation, when referencing an entire column or row, use the column or row name(s).

**IMPORTANT**: Column and row references like \`A\` or \`A3:A\` should only be used for non-table data. When referencing columns within tables, ALWAYS use table column references like \`Table_Name[Column Name]\` instead of column references like \`A\` or infinite ranges like \`A3:A\`.

### Column and Row Examples

- B - references the entire column B (use only for non-table data)
- B3:B - references all rows in column B starting from row 3 (use only for non-table data)
- 10 - references the entire row 10
- C4:C - references all columns in row C starting from row 4
- D2:2 - references all columns in row 2 starting from column D

## Table References

**PREFERRED**: Always use table names (e.g., Table_Name) when working with entire tables or entire columns within tables. Use A1 notation only for non-table data or partial table selections.

**IMPORTANT for Formatting and Conditional Formatting**: When applying formatting or conditional formatting to table columns, ALWAYS use table column references like \`Table_Name[Column Name]\` instead of A1 range notation like \`A2:A2000\`, column references like \`A\`, or infinite ranges like \`A3:A\`. This ensures the formatting applies correctly to the entire column as the table grows or shrinks.

Columns within tables may be referenced by their name in A1 notation, eg, Table1[Column Name]. To reference multiple columns within a table, you use Table1[[Name]:[Address]]. In tables, you can also reference parts of the table. If you only want the table names, you can reference it with Table1[#HEADERS]. If you want the data and the headers, you would use Table1[[#DATA],[#HEADERS]]. By default, tables are referenced as Table1[#DATA].

If you need individual cells within a table, you need to use normal A1 reference. For example, if you want the first row of a table, you would reference it using its corresponding A1 reference. Remember that tables usually include a name row as the first row, and a column header row as the second row. (Although these may sometimes be hidden.)

### Table Examples

- Table1 - references the entire table's data
- Table1[#HEADERS] - references the table headers
- Table1[[#DATA],[#HEADERS]] - references the entire table including the headers
- Table1[Column 2] - references a single column within Table1
- Table1[[Name]:[Address]] - references a range of columns

## Multiple Ranges

 You can reference multiple ranges by combining ranges with commas.

### Multiple Range Examples

- A1:C3,D5:F7
- A1:C3,D5:F7,G9:I11
- Table1[Column 2], A1:C3

## Other Sheets

You can reference cells in other sheets by using the sheet name as part of the reference. Note, table names do not need sheet names as table names are unique within the file.

### Other Sheet Examples

- Sheet1!A1:C3
- Sheet1!A1:C3,Sheet2!D5:F7
- Sheet1!A1:C3,Sheet2!D5:F7,Sheet3!G9:I11
- Table1[Column 2],Sheet2!A1:C3
`;
