export const PythonDocs = `# Python Docs

Python is a first-class citizen that integrates seamlessly with Quadratic spreadsheets.
Below are in-depth details for Python in Quadratic. 

You can reference cells in the spreadsheet to use in code, and you can return results from your Python code back to the spreadsheet. The last line of code is returned to the spreadsheet.
Python does not support conditional returns in Quadratic. Only the last line of code is returned to the sheet. There can be only one type of return from a code cell, data or chart.

Single cell references are placed in a variable of corresponding type. Multi-line references are placed in a DataFrame.

Essential Python basics in Quadratic: 
1. Cell references - use q.cells() to read data from the sheet into Python with table references and A1 notation
2. Return data to the sheet - return Python outputs from code to the sheet; the last line is what gets returned 
3. Import Python packages - supporting some built-in libraries and others via micropip
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into charts with Plotly exclusively, no other charting libraries supported 

## Reference cells from Python

You can reference tables, individual cells, and ranges of cells using Python.

### Referencing tables

Much of Quadratic's data is formatted in Data Tables for ease of use. To perform any reference type you can use \`q.cells\`. For table references this places the table in a DataFrame.

Note the following examples that use table references: 
\`\`\`python
# References entire table, including headers, places into DataFrame 
df = q.cells("Table1")

# Retrieves the column data and its header, places into single column DataFrame
df_column = q.cells("Table1[column_name]")

# Creates an empty DataFrame with just the DataFrame's headers as table's column names
df_headers = q.cells("Table1[#HEADERS]")

# Reference a range of columns from a table, e.g. in following example we reference columns 1, 2, and 3. Columns can then be dropped or manipulated using Pandas DataFrame logic.
df_columns = q.cells("Table1[[Column 1]:[Column 3]]")
\`\`\`python

Tables should be used whenever possible. Use ranged A1 references or single cell references otherwise. 

### Referencing individual cells

To reference an individual cell, use the global function \`q.cells\` which returns the cell value, as shown in following example.

\`\`\`python
# Reads the value in cell A1 and stores in variable x 
x = q.cells('A1')
\`\`\`

You can reference cells and use them directly in a Pythonic fashion, as shown in following example. 

\`\`\`python
q.cells('A1') + q.cells('A2') # Sums the values in cells A1 and A2 
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update; your code will execute whenever it makes a reference to another cell.

### Referencing a range of cells

To reference a range of cells, use the global function \`q.cells\`, ranged references will always return a Pandas DataFrame.

\`\`\`python
q.cells('A1:A5') # Returns a 1x5 DataFrame spanning from A1 to A5
q.cells('A1:C7') # Returns a 3x7 DataFrame spanning from A1 to C7
q.cells('A') # Returns all values in column A into a single-column DataFrame
q.cells('A:C') # Returns all values in columns A to C into a three-column DataFrame
q.cells('A5:A') # Returns all values in column A starting at A5 and going down until the next blank cell 
q.cells('A5:C') # Returns all values in columns A to C, starting at A5 and going down
\`\`\`

If the first row of cells is a header, you should set \`first_row_header\` as an argument. This makes the first row of your DataFrame the column names, otherwise will default to the default integer column names as 0, 1, 2, 3, etc.

Use first_row_header when you have column names that you want as the header of the DataFrame. This should be used commonly. You can tell when a column name should be a header when the column name describes the data below. 

\`\`\`python
# first_row_header=True will be used any time the first row is the intended header for that data.
q.cells('A1:B9', first_row_header=True) # returns a 2x9 DataFrame with first row as DataFrame headers
\`\`\`

### Referencing another sheet

To reference another sheet's table, individual cells , or range of cells use the following: 

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
q.cells("'Sheet_name_here'!A1:C9")

# For individual cell reference 
q.cells("'Sheet_name_here'!A1")

# Since tables are global to a file, they can be referenced across sheets without defining sheet name
q.cells("Table1")
\`\`\`

### Column references

To reference all the data in a column or set of columns without defining the range, use the following syntax. 

Column references span from row 1 to wherever the content in that column ends. 

\`\`\`python
# references all values in the column from row 1 to the end of the content 
q.cells('A') # returns all the data in the column starting from row 1 to end of data 

q.cells('A:D') # returns all the data in columns A to D starting from row 1 to end of data in longest column

q.cells('A5:A') # returns all values from A5 to the end of the content in column A 

q.cells('A5:C') # returns all values from A5 to end of content in C

q.cells('A:C', first_row_header=True) # same rules with first_row_header apply 

q.cells("'Sheet2'!A:C", first_row_header=True) # same rules to reference in other sheets apply
\`\`\`

### Relative vs absolute references

By default when you copy paste a reference it will update the row reference unless you use $ notation in your references. 

\`\`\`python
# Copy pasting this one row down will change reference to A2
q.cells('A1')

# Copy pasting this one row down will keep reference as A1
q.cells('A$1')

# Example using ranges - row references will not change
q.cells('A$1:B$20)

# Only A reference will change when copied down
q.cells('A1:B$20')
\`\`\`

## Returning data to the sheet

The last line of code in a Python cell is returned to the sheet. 

Do not try to use conditional returns. The last line of code is what gets returned no matter what.

## Recommended Python libraries

Common analytics: 
Pandas

Charting:
Plotly (only Plotly is supported for charting)

Machine Learning: 
Scikit-learn
Statsmodels

Time Series: 
Statsmodels

Correlation analysis: 
Pandas

Sentiment analysis: 
NLTK

Web scraping: 
Beautiful Soup

If a library is not installed, you should try using micropip to install it. 

\`\`\`python
import micropip
await micropip.install('library_name')
\`\`\`

If that does not work, then the library is not supported and you should recommend an alternative if possible.

## Negative usage 

Files can not be imported or exported via Python. They can be imported and exported via the sheet by drag and dropping CSVs, Excel files, and Parquet. 

PDF and images can be imported via the AI chat. 

References are not global. You need to create a reference to data in each and every Python cell that needs to read data from the sheet.
`;
