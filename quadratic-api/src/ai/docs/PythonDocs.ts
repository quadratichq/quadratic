export const PythonDocs = `# Python Documentation for Quadratic

The last line of code is returned to the spreadsheet. Conditional returns are not supported. Only one value can be returned per code cell.

Data, variables, and imports are scoped to each code cell and must be imported/referenced in every cell that uses them. When referenced data is updated the code with the dependency is automatically re-ran.

## Reference cells from Python

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

## Financial data

You can access financial data directly using \`q.financial\`. This provides built-in functions for retrieving stock prices and other financial data without needing external API keys or libraries.

### Stock prices

Use \`q.financial.stock_prices()\` to get historical stock price data. This function is async, so you must use \`await\`.

\`\`\`python
# Get daily stock prices for Apple
data = await q.financial.stock_prices("AAPL")

# Get stock prices for a specific date range
data = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-01-31")

# Get weekly stock prices for a date range
data = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-06-30", "weekly")
\`\`\`

#### Parameters

- \`identifier\` (required): Stock ticker symbol (e.g., "AAPL", "MSFT", "GOOGL")
- \`start_date\` (optional): Start date in YYYY-MM-DD format
- \`end_date\` (optional): End date in YYYY-MM-DD format
- \`frequency\` (optional): Frequency for price data. One of: "daily" (default), "weekly", "monthly", "quarterly", "yearly"

#### Return value

The function returns a dictionary with the following keys:

- \`stock_prices\`: A list of stock price records. Each record contains:
  - \`date\`: The calendar date for the stock price. For non-daily frequencies, this is the last day in the period (end of the week, month, quarter, year, etc.)
  - \`open\`: Price at the beginning of the period
  - \`high\`: Highest price over the span of the period
  - \`low\`: Lowest price over the span of the period
  - \`close\`: Price at the end of the period
  - \`volume\`: Number of shares exchanged during the period
  - \`frequency\`: The type of period the stock price represents
  - \`intraperiod\`: If True, the stock price represents an unfinished period, meaning the close price is the latest price available, not the official close price for the period
  - \`adj_open\`, \`adj_high\`, \`adj_low\`, \`adj_close\`, \`adj_volume\`: Adjusted values for splits and dividends
  - \`factor\`: Factor by which to multiply stock prices before this date to calculate historically-adjusted stock prices
  - \`split_ratio\`: Ratio of the stock split, if a stock split occurred
  - \`dividend\`: Dividend amount, if a dividend was paid
  - \`change\`: Difference in price from the last price for this frequency
  - \`percent_change\`: Percent difference in price from the last price for this frequency
  - \`fifty_two_week_high\`: The 52 week high price (daily only)
  - \`fifty_two_week_low\`: The 52 week low price (daily only)
- \`security\`: Information about the security, including \`id\`, \`ticker\`, \`name\`, \`exchange\`, \`currency\`, and other identifiers.
- \`next_page\`: A pagination token. If null, no further results are available.

To work with stock price data, extract the \`stock_prices\` list and convert it to a DataFrame.

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
