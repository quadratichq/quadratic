export const PythonDocs = `# Python Documentation for Quadratic

The last line of code is returned to the spreadsheet. Conditional returns are not supported. Only one value can be returned per code cell.

Data, variables, and imports are scoped to each code cell and must be imported/referenced in every cell that uses them. When referenced data is updated the code with the dependency is automatically re-ran.

## Reference cells from Python

\`q.cells()\` is the ONLY way to reference data from the sheet in Python. It returns a single value for single cell references (e.g., \`q.cells('A1')\` returns a number, string, or boolean). For ranges, tables, and multi-cell references, it ALWAYS returns a pandas DataFrame. You can use standard pandas operations (filtering, groupby, merge, etc.) directly on the result.

### Referencing tables

\`\`\`python
df = q.cells("Table1")  # Full table as DataFrame
df_column = q.cells("Table1[column_name]")  # Single column
df_headers = q.cells("Table1[#HEADERS]")  # Headers only
df_columns = q.cells("Table1[[Column 1]:[Column 3]]")  # Range of columns
\`\`\`

### Referencing cells and ranges

\`\`\`python
x = q.cells('A1')  # Single cell
q.cells('A1:C7')  # Range as DataFrame
q.cells('A')  # Entire column
q.cells('A5:A')  # Column from A5 down to next blank
\`\`\`

Use \`first_row_header=True\` when the first row contains column headers:
\`\`\`python
q.cells('A1:B9', first_row_header=True)
\`\`\`

### Referencing another sheet

\`\`\`python
q.cells("'Sheet_name'!A1:C9", first_row_header=True)
q.cells("'Sheet_name'!A1")
q.cells("Table1")  # Tables are global, no sheet prefix needed
\`\`\`

### Absolute references

Use \`$\` to prevent reference changes when copy/pasting:
\`\`\`python
q.cells('A$1')  # Row won't change
q.cells('A$1:B$20')  # Range rows won't change
\`\`\`

## Return data to the sheet

The last line of code is returned. Only ONE item per code cell (one value OR one table OR one chart, not multiple).

\`\`\`python
x = 5
x  # Returns 5
\`\`\`

\`\`\`python
my_list = [1, 2, 3, 4, 5]
my_list  # Each value in its own cell
\`\`\`

\`\`\`python
import pandas as pd
df = pd.DataFrame({'Name': ['tom', 'nick'], 'Age': [30, 19]})
df  # Returns DataFrame with headers
\`\`\`

Use \`reset_index()\` to return DataFrame index to the sheet (needed after \`describe()\` and similar methods).

### Charts

\`\`\`python
import plotly.express as px

df = px.data.gapminder().query("country=='Canada'")
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy')
fig.show()
\`\`\`

Plotly is the ONLY charting library supported. For trendlines, you MUST import statsmodels.

### Function outputs

\`\`\`python
def do_some_math(x):
    return x + 1

do_some_math(5)  # Returns 6
\`\`\`

## Common Mistakes

**Conditional returns don't work** - The last line must be an expression, not inside an if/else:
\`\`\`python
# WRONG: Returns nothing
if x == 3:
    y = True

# CORRECT: Return variable after conditional
if x == 3:
    y = True
else:
    y = False
y  # Returns the value
\`\`\`

**Multiple returns don't work** - Only ONE item per cell. If you need a chart AND data, use separate code cells.

**Don't use try-except** - Let errors surface to the console.

**Don't format numbers** - Avoid f-strings on numerical returns; the sheet handles formatting.

**Don't use \`return\` keyword** - Only the last line expression is returned.

## Packages

Default packages (import required): Pandas, NumPy, SciPy, Plotly, Scikit-learn, Statsmodels, Nltk, Regex

Additional packages via micropip:
\`\`\`python
import micropip
await micropip.install("faker")
from faker import Faker
\`\`\`

## API requests

Use the Requests library for API calls.

## File imports/exports

Python cannot import files (.xlsx, .csv, .pqt). Drag and drop files directly into the sheet, then read with \`q.cells()\`.

To export: highlight data > right-click > "Download as CSV"

PDFs and images: attach via AI chat paperclip button, don't use Python for this task.
`;
