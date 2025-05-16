export const PythonDocs = `# Python Docs

When the data that code references is updated, the code cell is automatically re-run. 

## Cell references 
Single-cell references are placed in a variable of corresponding type. Multi-line references are placed in a DataFrame.

# Single cell reference
q.cells('A5')

# Multi-line reference
q.cells('A1:B5')

# Multi-line reference with headers 
q.cellls('A5:D9', first_row_header=True)

# Table references
q.cells('table_name')

# Table column reference 
q.cells('table_name[column_name]')

## Return data to the sheet 
Last line is returned to the sheet. Do NOT use the return keyword. Conditional statements do not get returned. Only one variable can be returned.

DataFrame index does not get returned to sheet. Use reset_index() if you want to show it in sheet. 

## Importing packages 

Many libraries are supported by default. Use micropip to install additional libraries. 

await micropip.install('package-name')
import package-name

## API requests 

Use the Requests library. 

## Visualize data 

Only Plotly is supported. 
`;
