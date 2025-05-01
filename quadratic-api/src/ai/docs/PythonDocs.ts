export const PythonDocs = `# Python Docs

Python is a first-class citizen that integrates seamlessly with Quadratic spreadsheets.
Below are in-depth details for Python in Quadratic. 

Essential Python basics in Quadratic: 
1. Cell references - use q.cells() to read data from the sheet into Python with table references and A1 notation
2. Return data to the sheet - return Python outputs from code to the sheet; the last line is what gets returned 
3. Import Python packages - supporting some built-in libraries and others via micropip
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into charts with Plotly exclusively, no other charting libraries supported 

## Examples of referencing cells from Python

### Recommended when possible: table references

q.cells('Table_Name')
q.cells('Table_Name['column_name'])

### Single cell 

q.cells('A1')

### Multiple cells 

q.cells('A1:D20')

### Columns

q.cells('A:D')

## Return types

### Single values

Return a single value to the sheet with its variable as the last line of code. 

### Lists

Return a list to the sheet with its variable as the last line of code.

### Charts 

Return a chart to the sheet with fig or fig.show() as the last line of code.
### DataFrames

DataFrames can be returned to the sheet with the variable name as the last line of code. The DataFrame's column names will be returned to the sheet as table headers. If no columns are named, column headers will be displayed as Column 1, Column 2, etc. 

## Packages

### Recommended libraries by use-case

Charting: Plotly is the only charting library supported in Quadratic.
Data cleaning: Pandas
Time-series analysis: ARIMA
Trendlines: When using the trendline feature in Plotly, you'll need to import statsmodels first. 
API requests: Requests
Correlation analysis: Pandas
Scientific computing: SciPy
Machine learning: Scikit-learn
Sentiment analysis: NLTK
Web scraping: BeautifulSoup

### Install additional packages with micropip

\`\`\`python
import micropip
micropip.install('package_name')
\`\`\`

These are all included by default in Quadratic. Many others will need to be installed via micropip.

### Import packages

Packages are not globally imported. You will need to import them in each individual code cell. Do not try to reuse libraries across code cells.

## Sample code

A good data summary will likely include some summary statistics and visualizations. 

Here is a successful summary statistics example.
\`\`\`python
import pandas as pd
import plotly.express as px

# This example references a table named "Sales_Data"
df = q.cells("Sales_Data")

# Explicitly set types to what they should be for each DataFrame column
df['Units_Sold'] = pd.to_numeric(df['Units_Sold'])
df['Revenue'] = pd.to_numeric(df['Revenue'])
df['Cost'] = pd.to_numeric(df['Cost'])
df['Profit'] = pd.to_numeric(df['Profit'])
df['Date'] = pd.to_datetime(df['Date'])

# Generate a statistical summary
summary = df.describe().reset_index()

# Add additional metrics
product_summary = df.groupby('Product').agg({
    'Units_Sold': 'sum',
    'Revenue': 'sum',
    'Profit': 'sum'
}).reset_index()

region_summary = df.groupby('Region').agg({
    'Units_Sold': 'sum',
    'Revenue': 'sum',
    'Profit': 'sum'
}).reset_index()

# Return the summary statistics
summary
\`\`\`

It would probably make sense to follow up these summary statistics with a visualization. 
`;
