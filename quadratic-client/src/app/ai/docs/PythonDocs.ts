export const PythonDocs = `# Python Docs

Quadratic is very focused on a rich developer experience.
This means focusing on features that enable you to have a streamlined development workflow inside Quadratic, with Python as a first-class citizen that integrates seamlessly with the spreadsheet.
Below is a quick start to get going with Python in Quadratic. 

In Quadratic you can reference cells in the spreadsheet to use in your code, and you can return results from your Python analysis back to the spreadsheet. By default, the last line of code is returned to the spreadsheet. 

Single referenced cells are put in a variable with the appropriate data type. Multi-line references are placed in a DataFrame.

The following is a list of essential information for learning how Python works in Quadratic. 

1. Reference cells - get data from the sheet into Python with cell references
2. Return data to the sheet - return Python outputs from code to the sheet
3. Import packages - import packages for use in your Python code
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into beautiful charts and graphs with Plotly

The most common starting point is learning how to reference spreadsheet cells from Python in Quadratic. 

# Reference cells

Reference cells from Python.

In Quadratic, reference individual cells from Python for single values or reference a range of cells for multiple values. 

Referencing individual cells

To reference an individual cell, use the global function \`cell\` (or \`c\` for short) which returns the cell value.

\`\`\`python
# NOTE: cell is (x,y), so cell(2,3) means column 2, row 3 
cell(2, 3) # Returns the value of the cell

c(2, 3) # Returns the value of the cell
\`\`\`

You can reference cells and use them directly in a Pythonic fashion. 

\`\`\`python
cell(0, 0) + cell(0, 1) # Adds cell 0, 0 and cell 0, 1

cell(0, 0) == cell(0, 1) # Is cell 0, 0 equal to cell 0, 1 ?
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another.
This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a Python cell. 

Referencing a range of cells

To reference a range of cells, use the global function \`cells\` which returns a Pandas DataFrame.

\`\`\`python
cells((0, 0), (2, 2)) # Returns a DataFrame with the cell values
\`\`\`

If the first row of cells is a header, you should set \`first_row_header\` as an argument. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.

Use first_row_header when you have column names that you want as the header of the DataFrame. This should be used commonly. You can tell when a column name should be a header when the column name describes the data below. 

\`\`\`python
# first_row_header=True will be used any time the first row is the intended header for that data.
cells((2, 2), (7, 52), first_row_header=True)
\`\`\`

As an example, this code references a table of expenses, filters it based on a user-specified column, and returns the resulting DataFrame to the spreadsheet.

\`\`\`python
# Pull the full expenses table in as a DataFrame
expenses_table = cells((2, 2), (7, 52), first_row_header=True)

# Take user input at a cell (Category = "Gas")
category = cell(10, 0)

# Filter the full expenses table to the "Gas" category, return the resulting DataFrame
expenses_table[expenses_table["Category"] == category]
\`\`\`

Alternatively, slicing syntax works for selecting a range of cells (returns a Pandas DataFrame).

\`\`\`python
# Given a table like this:
#
#    [  0  ][  1  ]
# [0][ 100 ][ 600 ]
# [1][ 200 ][ 700 ]
# [2][ 300 ][ 800 ]
# [3][ 400 ][ 900 ]
# [4][ 500 ][  0  ]

# table[row, col]
table[0, 0] # -> [100]
table[0, 1] # -> [200]
table[1, 0] # -> [600]
table[1, 1] # -> [700]

# table[row_min:row_max, col]
table[0:5, 0] # -> [100, 200, 300, 400, 500]
table[0:5, 1] # -> [600, 700, 800, 900, 0]

# table[row, col_min:col_max]
table[0, 0:2] # -> [100, 600]
table[1, 0:2] # -> [200, 700]

# table[row_min:row_max, col_min:col_max]
table[0:3, 0:2] # -> [[100, 200, 300], [600, 700, 800]]
\`\`\`

Referencing another sheet

To reference another sheet's cells or range of cells use the following: 

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
df = cells((0,0), (3,50), 'Sheet Name Here')

# For individual cell reference (alternatively can use just c instead of cell)
x = cell(0,0, 'Sheet Name Here')
\`\`\`

Relative references

Reference cells relative to the cell you're currently in with relative cell references in Python. 

Get position of current cell

Keyword \`pos()\` returns a tuple of the \`(x, y)\` coordinates of the current cell. 

\`\`\`python
# if the current position is cell (1,1) this would return tuple (1,1)
(x, y) = pos() 
\`\`\`

Reference values in relative cells

Reference the values of cells relative the current position. 

\`\`\`python
# data is the cell one cell to the left of the current cell, use either rel_cell or rc
data = rel_cell(-1, 0)
data = rc(-1, 0)

# above for one cell to the left is equivalent to the following 
(x, y) = pos()
data = cell(x - 1, y)

# one cell left
data = rel_cell(-1, 0)
# one cell up 
data = rel_cell(0, -1)
# one cell right 
data = rel_cell(1, 0)
# one cell down
data = rel_cell(0, 1)
# five cells left, five cells down
data = rel_cell(-5, 5)
\`\`\`

# Return data to the sheet

Return the data from your Python code to the spreadsheet.

Quadratic is built to seamlessly integrate Python to the spreadsheet. This means being able to manipulate data in code and very simply output that data into the sheet. 

By default, the last line of code is output to the spreadsheet. This should be one of the four basic types: 

1. Single value: for displaying the single number result of a computation
2. List of values: for displaying a list of values from a computation
3. DataFrame:for displaying the workhorse data type of Quadratic
4. Chart: for displaying Plotly charts in Quadratic
5. Function outputs: return the results of functions to the sheet

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

Lists can be returned directly to the sheet. They'll be returned value by value into corresponding cells as you can see below. 

\`\`\`python
# create a list that has the numbers 1 through 5 
my_list = [1, 2, 3, 4, 5]

# returns the list to the spreadsheet 
my_list
\`\`\`

3. DataFrame

You can return your DataFrames directly to the sheet by putting the DataFrame's variable name as the last line of code. 

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

You use the argument \`first_row_header=True\` to avoid the first row of your DataFrame being what is intended to be our header.
Note that the output, in this case, is printed to the console since you already have your initial CSV in the sheet.
After some manipulation of the data, perhaps you would want to display your new DataFrame. In that case, leave \`df\` as the last line of code.

In this case, the spreadsheet reflects \`cells((0, 0),(0, 160))\` since we want the full span of data in both columns 0 and 1 spanning from rows 0 to 160.

\`\`\`python
df = cells((0,0),(1,160), first_row_header=True)
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

Resize by dragging the edges of the chart. 

# Manipulate data

Perform novel analysis on your data.

Manipulating data in Quadratic is easier than ever as you can view your changes in the sheet in real-time. Here is a non-exhaustive list of ways to manipulate your data in Quadratic: 

1. Find correlations
2. Basic stats - max, min, average, selections, etc.
3. DataFrame math
4. Data selections

1. Find correlations

\`\`\`python
# Get the correlation and show the value in the sheet
data['col1'].corr(data['col2'], method='pearson')

# possible methods: pearson, kendall, spearman 
\`\`\`

2. Basic stats - max, min, mean, selections, etc.

\`\`\`python
# Get the max value of a column
df["col1"].max()
\`\`\`

\`\`\`python
# Get the min value of a column
df["col1"].min()
\`\`\`

\`\`\`python
# Get the mean value of a column
df["col1"].mean()
\`\`\`

\`\`\`python
# Get the median value of a column
df["col1"].median()
\`\`\`

\`\`\`python
# Get the skew for all columns
df.skew()
\`\`\`

\`\`\`python
# Count the values in a column
df["col1"].value_counts()
\`\`\`

\`\`\`python
# Get the summary of a column
df["col1"].describe()
\`\`\`

3. DataFrame math

Do math on data in the DataFrame. Alternatively, use formulas in the sheet on the values. 

\`\`\`python
# Add, subtract, multiply, divide, etc., will all work on all values in a column
df['col1'] + 1
df['col1'] - 1
df['col1'] * 2
df['col1'] / 2 
\`\`\`

\`\`\`python
# Do any arbitrary math column-wise with the above or do DataFrame-wise via
df + 1 
\`\`\`

4. Data selections

Alternatively, cut/copy/paste specific values in the sheet. 

\`\`\`python
# get a column 
df['col1'] 
\`\`\`

\`\`\`python
# get multiple columns 
df[['col1', 'col2']] 
\`\`\`
`;
