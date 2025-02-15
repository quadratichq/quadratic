export const PythonDocs = `# Python Docs

Python is a first-class citizen that integrates seamlessly with Quadratic spreadsheets.
Below are in-depth details for Python in Quadratic. 

You can reference cells in the spreadsheet to use in code, and you can return results from your Python code back to the spreadsheet. The last line of code is returned to the spreadsheet.
Python does not support conditional returns in Quadratic. Only the last line of code is returned to the sheet. There can be only one type of return from a code cell, data or chart.

Single cell references are placed in a variable of corresponding type. Multi-line references are placed in a DataFrame.

Essential Python basics in Quadratic: 
1. Reference cells - read data from the sheet into Python using table references or cell references
2. Return data to the sheet - return Python outputs from code to the sheet
3. Import Python packages - supporting some built-in libraries and others via micropip
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into charts with Plotly

# Reference cells from Python

You can reference tables, individual cells, and ranges of cells using Python.

## Referencing tables

Much of Quadratic's data is formatted in Data Tables for ease of use. To perform any reference type you can use \`q.cells\`. For table references this places the table in a DataFrame.

\`\`\`python
# References entire table, including headers 
df = q.cells("Table1[#ALL]")

# Reads the values in Table1 and places them into variable df
# Only retrieves the values of the table
df_values = q.cells("Table1")

# Only retrieves the column's data without the header
df_column = q.cells("Table1[column_name]")

# Creates an empty DataFrame with just the DataFrame's headers as table's column names
df_headers = q.cells("Table1[#HEADERS]")
\`\`\`python

Tables should be used whenever possible. Use ranged A1 references or single cell references otherwise. 

## Referencing individual cells

To reference an individual cell, use the global function \`q.cells\` which returns the cell value.

\`\`\`python
# Reads the value in cell A1 and places in variable x 
x = q.cells('A1')
\`\`\`

You can reference cells and use them directly in a Pythonic fashion, as shown below. 

\`\`\`python
q.cells('A1') + q.cells('A2') # Sums the values in cells A1 and A2 
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update; your code will execute whenever it makes a reference to another cell.

## Referencing a range of cells

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

## Referencing another sheet

To reference another sheet's table, individual cells , or range of cells use the following: 

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
q.cells("'Sheet_name_here'!A1:C9")

# For individual cell reference 
q.cells("'Sheet_name_here'!A1")

# Since tables are global to a file, they can be referenced across sheets without defining sheet name
q.cells("Table1[#ALL]")
\`\`\`

## Column references

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

## Relative vs absolute references

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

# Return data to the sheet

Return the data from your Python code to the spreadsheet.

By default, the last line of code is output to the spreadsheet.

All code outputs by default are given names that can be referenced, regardless of their return type. 

You can expect to primarily use DataFrames as Quadratic is heavily built around Pandas DataFrames.

1. Single value

Note the simplest possible example, where we set \`x = 5\` and then return \`x\` to the spreadsheet by placing \`x\` in the last line of code.

\`\`\`python
# create variable 
x = 5 

# last line of code gets returned to the sheet, so the value 5 gets returned
x
\`\`\`

2. List of values 

Lists can be returned directly to the sheet.  
\`\`\`python
my_list = [1, 2, 3, 4, 5]

# Returns the list to the spreadsheet, with each value occupying subsequent cells  
my_list
\`\`\`

3. DataFrame

You can return your DataFrames directly to the sheet by putting the DataFrame's variable name as the last line of code. The DataFrame's column names will be returned to the sheet as table headers. If no columns are named, column headers will not display in the sheet. To display column headers in the sheet, name the headers. The columns can still be referenced by their default DataFrame integer values. 

\`\`\`python
# import pandas 
import pandas as pd
 
# create some sample data 
data = [['tom', 30], ['nick', 19], ['julie', 42]]
 
# Create the DataFrame
df = pd.DataFrame(data, columns=['Name', 'Age'])
 
# return DataFrame to the sheet with "Name" and "Age" as column headers
df
\`\`\`

Note that if your DataFrame has an index it will not be returned to the sheet. If you want to return the index to the sheet use the following code:

\`\`\`python
# use reset_index() method where df is the dataframe name
df.reset_index()
\`\`\`

An example of when this is necessary is any time you use the describe() method in Pandas.
This creates an index so you'll need to use reset_index() if you want to correctly display the index in the sheet when you return the DataFrame. 

4. Charts

Build your chart and return it to the spreadsheet by using the \`fig\` variable name or \`.show()\`

\`\`\`python
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada')

# display chart in sheet
fig.show()
\`\`\`

5. Function outputs

You can not use the \`return\` keyword to return data to the sheet, as that keyword only works inside of Python functions.
Here is an example of using a Python function to return data to the sheet. 

\`\`\`python
def do_some_math(x): 
    return x+1

# returns the result of do_some_math(), which in this case is 6 
do_some_math(5)
\`\`\`

# Packages

Using and installing Python packages.

Default Packages

Some libraries are included by default, here are some examples:

* Pandas (https://pandas.pydata.org/)
* NumPy (https://numpy.org/)
* SciPy (https://scipy.org/)

Default packages can be imported like any other native Python package.

\`\`\`python
import pandas as pd
import numpy as np 
import scipy
\`\`\`

Micropip can be used to install additional Python packages that aren't automatically supported.

\`\`\`python
import micropip

# \`await\` is required to wait until the package is installed
await micropip.install("faker")

from faker import Faker

fake = Faker()
fake.name()
\`\`\`

This only works for packages that are either pure Python or for packages with C extensions that are built in Pyodide.
If a pure Python package is not found in the Pyodide repository, it will be loaded from PyPI.

# API requests

API Requests in Python must use the Requests library.

## GET request

Import the basic Requests library, query the API, and get the data into a Pandas DataFrame. 

\`\`\`python
# Imports
import requests
import pandas as pd

# Request
response = requests.get('your_API_url_here')

# JSON to DataFrame
df = pd.DataFrame(response.json())

# Display DataFrame in the sheet 
df
\`\`\`

POST request

\`\`\`python
import requests

url = 'your_API_url_here'

obj = {'somekey': 'somevalue'}

x = requests.post(url, json = myobj)

# return the API response to the sheet
x.text
\`\`\`

**Going from CSV to DataFrame** 

Bringing your CSV to Quadratic is as simple as a drag and drop. Once your CSV is in the spreadsheet, reference the range of cells in Python to get your data into a DatarFrame. 

You use the argument \`first_row_header=True\` to set the first row of DataFrame to be your headers as column names.
After some manipulation of the data, perhaps you would want to display your new DataFrame. In that case, leave \`df\` as the last line of code.

In this case, the spreadsheet reflects \`q.cells('A:B')\` since we want the full span of data in both columns A and B.

\`\`\`python
df = q.cells('A:B'), first_row_header=True)
\`\`\`

# Charts/visualizations

Plotly is the only charting library supported in Quadratic. Don't try to use other libraries. 

To return a chart to the sheet, put fig.show() as the last line of code. 

\`\`\`python
# Here are some example styling options for prettier charts
fig.update_layout(
    xaxis=dict(
        showline=True,
        showgrid=False,
        showticklabels=True,
        linecolor='rgb(204, 204, 204)',
        linewidth=2,
        ticks='outside',
        tickfont=dict(
            family='Arial',
            size=12,
            color='rgb(82, 82, 82)',
        ),
    ),
    yaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=False,
        showticklabels=True,
    ),
    autosize=False,
    showlegend=False,
    plot_bgcolor='white',
    title='Your_title_here' # replace with the relevant chart title based on the data in the chart/x and y-axis names
)
\`\`\`

3. Chart controls

Charts can be resized by dragging the edges of the chart. You can also click chart to enable interactive options like resizing, exporting as png, and more. 

# Time-series analysis

For time-series analysis a good starting point is using statsmodels library for a simple ARIMA analysis. You can reference sheet data using table and sheet references to build these kinds of analysis.

\`\`\`python
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

# Generate sample time series data
dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
np.random.seed(42)
values = np.random.normal(loc=100, scale=10, size=len(dates))
values = np.cumsum(values)

# Create DataFrame
df = pd.DataFrame({
    'Date': dates,
    'Value': values
})

# Fit ARIMA model
model = ARIMA(df['Value'], order=(1,1,1))
results = model.fit()

# Make predictions
forecast = results.get_forecast(steps=30)
forecast_mean = forecast.predicted_mean
forecast_dates = pd.date_range(start=dates[-1], periods=31)[1:]

# Create plot with original data and forecast
fig = go.Figure()

# Add original data
fig.add_trace(go.Scatter(x=dates, y=values, name='Original Data'))

# Add forecast
fig.add_trace(go.Scatter(x=forecast_dates, y=forecast_mean, 
                        name='ARIMA Forecast',
                        line=dict(dash='dash')))

# Update layout
fig.update_layout(
    title='Time Series with ARIMA(1,1,1) Forecast',
    xaxis_title='Date',
    yaxis_title='Value',
    plot_bgcolor='white'
)

fig.show()
\`\`\`

For machine learning, Scikit-learn is recommended. Here's a simple sk-learn example. 

\`\`\`python
import pandas as pd
import numpy as np
import plotly.express as px

# Generate sample data
np.random.seed(42)
n_samples = 100

# Create features
X = np.random.normal(0, 1, n_samples)
y = 2 * X + np.random.normal(0, 0.5, n_samples)

# Create DataFrame
df = pd.DataFrame({
    'Feature': X,
    'Target': y
})

# Create scatter plot
fig = px.scatter(df, x='Feature', y='Target', 
                 title='Simple Linear Relationship with Noise')

# Update layout
fig.update_layout(
    plot_bgcolor='white',
    xaxis_title='Feature Value',
    yaxis_title='Target Value'
)

fig.show()
\`\`\`
`;
