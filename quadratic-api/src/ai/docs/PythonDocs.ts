export const PythonDocs = `# Python Docs

Quadratic is very focused on a rich developer experience.
This means focusing on features that enable you to have a streamlined development workflow inside Quadratic, with Python as a first-class citizen that integrates seamlessly with the spreadsheet.
Below is a quick start to get going with Python in Quadratic. 

In Quadratic you can reference cells in the spreadsheet to use in your code, and you can return results from your Python analysis back to the spreadsheet. By default, the last line of code is returned to the spreadsheet.
In Quadratic python does not support conditional returns. Only the last line of code is returned to the sheet. Also there can be only one type of return from a code cell, data or chart.

Single referenced cells are put in a variable with the appropriate data type. Multi-line references are placed in a DataFrame.

The following is a list of essential information for learning how Python works in Quadratic. 

1. Reference cells - get data from the sheet into Python with table references and cell references
2. Return data to the sheet - return Python outputs from code to the sheet as values or tables
3. Import packages - import packages for use in your Python code
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into beautiful charts and graphs with Plotly

The most common starting point is learning how to reference spreadsheet cells from Python in Quadratic. 

# Reference cells

Reference cells from Python.

In Quadratic, reference tables and named outputs for simplest references, reference individual cells from Python for single values, or reference a range of cells for multiple values. 

Referencing tables (and named outputs) 

Much of Quadratic's data is formatted in Data Tables for ease of use. Data Tables also make references more straightforward. To reference a table you can use \`q.cells\` which will bring the table into a DataFrame. 

\`\`\`python
# Note: uses same table reference style as Formulas
# References entire table, including headers 
df = q.cells("Table1[#ALL]")

# Reads the values in Table1 and places them into variable df
# Note: this only retrieves the values, not the column names/headers
df_values = q.cells("Table1")

# Get a single column out of table into DataFrame
# Note: this only retrieves the column's data, not the header
df_column = q.cells("Table1[column_name]")

# Creates an empty DataFrame with just the headers as column names of the table referenced
df_headers = q.cells("Table1[#HEADERS]")
\`\`\`python

All code outputs are also named and in tables by default; they can be referenced in the same fashion, using their names. Tables are the best choice when trying to select an entire selection of data. For precise selections A1 references are preferred. 

Referencing individual cells

To reference an individual cell, use the global function \`q.cells\` which returns the cell value.

\`\`\`python
# NOTE: uses the same A1 notation as Formulas
# Reads the value in cell A1 and places in variable x 
x = q.cells('A1')

q.cells('A3') # Returns the value of the cell at A3
\`\`\`

You can reference cells and use them directly in a Pythonic fashion. 

\`\`\`python
q.cells('A1') + q.cells('A2') # Adds the values in cells A1 and A2 
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another.
This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a Python cell. 

Referencing a range of cells

To reference a range of cells, use the global function \`q.cells\` which returns a Pandas DataFrame.

\`\`\`python
q.cells('A1:A5') # Returns a 1x5 DataFrame spanning from A1 to A5

q.cells('A1:C7') # Returns a 3x7 DataFrame spanning from A1 to C7

q.cells('A') # Returns all values in column A into a single-column DataFrame

q.cells('A:C') # Returns all values in columns A to C into a three-column DataFrame

q.cells('A5:A') # Returns all values in column A starting at A5 and going down

q.cells('A5:C') # Returns all values in column A to C, starting at A5 and going down
\`\`\`

If the first row of cells is a header, you should set \`first_row_header\` as an argument. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.

Use first_row_header when you have column names that you want as the header of the DataFrame. This should be used commonly. You can tell when a column name should be a header when the column name describes the data below. 

\`\`\`python
# first_row_header=True will be used any time the first row is the intended header for that data.
q.cells('A1:B9', first_row_header=True) # returns a 2x9 DataFrame with first rows as DataFrame headers
\`\`\`

Referencing another sheet

To reference another sheet's table, individual cells , or range of cells use the following: 

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
q.cells("'Sheet_name_here'!A1:C9")

# For individual cell reference 
q.cells("'Sheet_name_here'!A1")

# Since tables are global to a file, they can be referenced across sheets without defining sheet name
q.cells("Table1[#ALL]"
\`\`\`

Column references

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

Relative vs absolute references

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

Quadratic is built to seamlessly integrate Python to the spreadsheet. This means being able to manipulate data in code and very simply output that data into the sheet. 

By default, the last line of code is output to the spreadsheet. This should be one of the five basic types: 

1. Single value: for displaying the single number result of a computation
2. List of values: for displaying a list of values from a computation
3. DataFrame: for displaying the workhorse data type of Quadratic
4. Chart: for displaying Plotly charts in Quadratic
5. Function outputs: return the results of functions to the sheet

All code outputs by default are given names that can be referenced, regardless of their return type. 

You can expect to primarily use DataFrames as Quadratic is heavily built around Pandas DataFrames due to widespread Pandas adoption in almost all data science communities!

1. Single Value

Note the simplest possible example, where we set \`x = 5\` and then return \`x\` to the spreadsheet by placing \`x\` in the last line of code.

\`\`\`python
# create variable 
x = 5 

# last line of code gets returned to the sheet, so x of value 5 gets returned
x
\`\`\`

2. List of values 

Lists can be returned directly to the sheet. They'll be returned as tables with default column headings. You can edit or remove those headers in the table menu.  
\`\`\`python
# create a list that has the numbers 1 through 5 
my_list = [1, 2, 3, 4, 5]

# returns the list to the spreadsheet 
my_list
\`\`\`

3. DataFrame

You can return your DataFrames directly to the sheet by putting the DataFrame's variable name as the last line of code. DataFrames are returned to the sheet as Data Tables. The DataFrame's column names will be returned to the sheet as table headers. 

\`\`\`python
# import pandas 
import pandas as pd
 
# create some sample data 
data = [['tom', 30], ['nick', 19], ['julie', 42]]
 
# Create the DataFrame
df = pd.DataFrame(data, columns=['Name', 'Age'])
 
# return DataFrame to the sheet
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
# import plotly
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type, for more chart types: https://plotly.com/python/
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada')

# display chart, alternatively can just put fig without the .show()
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

Many libraries are included by default, here are some examples:

* Pandas (https://pandas.pydata.org/)
* NumPy (https://numpy.org/)
* SciPy (https://scipy.org/)

Default packages can be imported like any other native Python package.

\`\`\`python
import pandas as pd
import numpy as np 
import scipy
\`\`\`

Micropip can be used to install additional Python packages that aren't automatically supported (and their dependencies).

\`\`\`python
import micropip

# \`await\` is necessary to wait until the package is available
await micropip.install("faker")

# Import installed package
from faker import Faker

# Use the package!
fake = Faker()
fake.name()
\`\`\`

This only works for packages that are either pure Python or for packages with C extensions that are built in Pyodide.
If a pure Python package is not found in the Pyodide repository, it will be loaded from PyPI. Learn more about how packages work in Pyodide.

# Make an API request

Get the data you want, when you want it.

API requests are made seamless in Quadratic by allowing you to use Python and then display the result of the request directly to the sheet. 

Query API - GET request

Let's break our GET request down into a few different pieces.

Import the basic requests library you're familiar with, query the API, and get the data into a Pandas DataFrame. 

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

**Query API - POST request**

\`\`\`python
import requests

# API url
url = 'your_API_url_here'
# API call body 
obj = {'somekey': 'somevalue'}

# create request 
x = requests.post(url, json = myobj)

# return the API response to the sheet
x.text
\`\`\`

**Going from CSV to DataFrame** 

Bringing your CSV to Quadratic is as simple as a drag and drop. Once your CSV is in the spreadsheet, reference the range of cells in Python to get your data into a DatarFrame. 

You use the argument \`first_row_header=True\` to set the first row of DataFrame to be your headers as column names.
Note that the output, in this case, is printed to the console since you already have your initial CSV in the sheet.
After some manipulation of the data, perhaps you would want to display your new DataFrame. In that case, leave \`df\` as the last line of code.

In this case, the spreadsheet reflects \`q.cells('A1:B160')\` since we want the full span of data in both columns A and B spanning from rows 1 to 160.

\`\`\`python
df = q.cells('A1:B160'), first_row_header=True)
\`\`\`

# Clean data

Get your data ready for analysis.

Cleaning data in Quadratic is more seamless than you may be used to, as your data is viewable in the sheet as you step through your DataFrame.
Every change to your DataFrame can be reflected in the sheet in real-time. Some data cleaning steps you may be interested in taking (very much non-exhaustive!): 

1. View select sections of your DataFrame in the sheet
2. Drop specified columns
3. Field-specific changes
4. Clean columns
5. Delete select rows
6. Delete empty rows
7. Change data types
8. Remove duplicates

1. View select sections of your DataFrame in the sheet

Assume DataFrame named \`df\`. With \`df.head()\` you can display the first x rows of your spreadsheet.
With this as your last line the first x rows will display in the spreadsheet. You can do the same except with the last x rows via \`df.tail()\`

\`\`\`python
# Display first five rows
df.head(5)

# Display last five rows
df.tail(5)
\`\`\`

2. Drop specified columns

Deleting columns point and click can be done by highlighting the entire column and pressing \`Delete\`. Alternatively, do this programmatically with the code below. 

\`\`\`python
# Assuming DataFrame df, pick the columns you want to drop
columns_to_drop = ['Average viewers', 'Followers']

df.drop(columns_to_drop, inplace=True, axis=1)
\`\`\`

3. Field-specific changes

There are many ways to make field-specific changes, but this list will give you some ideas. 

\`\`\`python
# Replace row 7 in column 'Duration' with the value of 45
 df.loc[7, 'Duration'] = 45
\`\`\`

4. Clean columns

Going column by column to clean specific things is best done programmatically. 

\`\`\`python
# Specify things to replace empty strings to prep drop 
df['col1'].replace(things_to_replace, what_to_replace_with, inplace=True)
\`\`\`

5. Delete select rows

With the beauty of Quadratic, feel free to delete rows via point and click; in other cases, you may need to do this programmatically. 

\`\`\`python
# Knowing your row, you can directly drop via
df.drop(x)

# Select a specific index, then drop that index
x = df[((df.Name == 'bob') &( df.Age == 25) & (df.Grade == 'A'))].index
df.drop(x)
\`\`\`

6. Delete empty rows

Identifying empty rows should be intuitive in the spreadsheet via point-and-click; in other cases, you may need to do this programmatically. 

\`\`\`python
# Replace empty strings to prep drop 
df['col1'].replace('', np.nan, inplace=True)

# Delete where specific columns are empty 
df.dropna(subset=['Tenant'], inplace=True)
\`\`\`

7. Change data types

By default, Quadratic inputs will be read as strings by Python code. Manipulate these data types as you see fit in your DataFrame. 

\`\`\`python
# Specify column(s) to change data type
df.astype({'col1': 'int', 'col2': 'float'}).dtypes

# Common types: float, int, datetime, string
\`\`\`

8. Remove duplicates

Duplicates are likely best removed programmatically, not visually. Save some time with the code below. 

\`\`\`python
# Drop duplicates across DataFrame
df.drop_duplicates()

# Drop duplicates on specific columns 
df.drop_duplicates(subset=['col1'])

# Drop duplicates; keep the last 
df.drop_duplicates(subset=['col1', 'col2'], keep='last')
\`\`\`

# Charts/visualizations

Glean insights from your data, visually.

Create beautiful visualizations using our in-app Plotly support. Plotly support works just as you're used to in Python, displaying your chart straight to the spreadsheet. 

Getting started

Building charts in Quadratic is centered around Python charting libraries, starting with Plotly. Building charts in Plotly is broken down into 3 simple steps: 

1. Create and display a chart
2. Style your chart
3. Chart controls

1. Create and display a chart

Line charts

\`\`\`python
# import plotly
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type, for more chart types: https://plotly.com/python/
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada')

# make chart prettier
fig.update_layout(
    plot_bgcolor="White",
)

# display chart 
fig.show()
\`\`\` 

Bar charts

\`\`\`python
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country == 'Canada'")

# create your chart type, for more chart types: https://plotly.com/python/
fig = px.bar(df, x='year', y='pop')

# make chart prettier
fig.update_layout(
    plot_bgcolor="White",
)

# display chart
fig.show()
\`\`\`

Histograms 

\`\`\`python
# Import Plotly
import plotly.express as px

# Create figure - replace df with your data
fig = px.histogram(df, x = 'output')

# Display to sheet 
fig.show()
\`\`\`

Scatter plots 

\`\`\`python
import plotly.express as px

# replace df, x, and y and color with your data
fig = px.scatter(df, x="col1", y="col2", color="col3")
fig.update_traces(marker_size=10)
fig.update_layout(scattermode="group")
fig.show()
\`\`\`

Heatmaps

\`\`\`python
# Import library
import plotly.express as px

# Assumes 2d array Z
fig = px.imshow(Z, text_auto=True)

# Display chart
fig.show()
\`\`\`

2. Styling

\`\`\`python
# Example chart styling options to get started
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
    title='Historical power usage by month (1985-2018)'
)
\`\`\`

3. Chart controls

Resize by dragging the edges of the chart. Click chart to enable interactive options like resizing, exporting as png, and more. 

Time-series analysis

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
