// Process for updating:
// 1. Go to https://gobble.bot/
// 2. Input https://docs.quadratichq.com/
// 3. Clean the file, removing all excess characters, categories, and other unnecessary text

export const QuadraticDocs = `

# Quadratic Docs

Quadratic is the infinite spreadsheet with Python, SQL, and AI.

Quadratic is a modern spreadsheet built for teams. Quadratic combines familiar spreadsheet UI and formulas with the power of Python, SQL, and AI.

Skip to a section of interest or get started in the short walkthrough below.

If you have any questions or feedback, we’d love to hear it! Share by contacting us.

## 

Getting started

Get started in Quadratic by creating your first blank sheet or picking an example file.

Here is a list of some common first things to do in Quadratic.

### 

Write your first line of Python code 🐍

Start your first first line of code by simply pressing \`/\` after clicking a cell. This will open the command palette. 

Picking your cell type will open the editor where you can start writing code. 

In Quadratic you can reference cells in the spreadsheet to use in your code, and you can return results from your Python analysis back to the spreadsheet. By default, the last line of code is returned to the spreadsheet. 

Single referenced cells are put in a variable with the appropriate data type. Multi-line references are placed in a DataFrame. You can use the first value in the sheet as a DataFrame header by setting \`first_row_header=True\`

To learn more about Python, visit the Python section of the docs.

### 

Use Formulas 🔢

Formulas in Quadratic are similar to how you'd expect in any spreadsheet. Formulas are relatively referenced as seen below. 

To learn more about Formulas, visit the Formulas section of the docs. 

You can go as deep as you'd like in Quadratic via the combo of the spreadsheet, formulas, and Python. Use the docs sidebar to navigate to your sections of interest. 

### 

Create a team 🫂

Quadratic is built to be a team application - go further, faster by working together on spreadsheets with your team. 

To learn more about Teams, visit the Teams section of the docs. 

### 

Query your Databases with SQL 🏡

We are currently building this feature. Sign up for Quadratic to get notified when this feature is ready. 

# Getting started

Get started writing rich Python code inside the spreadsheet.

Quadratic is very focused on a rich developer experience. This means focusing on features that enable you to have a streamlined development workflow inside Quadratic, with Python as a first-class citizen that integrates seamlessly with the spreadsheet.

## 

Quick start

Python cells are created by pressing \`/\` inside a cell. From here, select the Python code cell type. The following are essential knowledge for being effective with Python in Quadratic: 

# Reference cells

Reference cells from Python.

In Quadratic, reference individual cells from Python for single values or reference a range of cells for multiple values. 

## 

Referencing individual cells

To reference an individual cell, use the global function \`cell\` (or \`c\` for short) which returns the cell value.

# NOTE: cell is (x,y), so cell(2,3) means column 2, row 3 
cell(2, 3) # Returns the value of the cell

c(2, 3) # Returns the value of the cell

You can reference cells and use them directly in a Pythonic fashion. 

c(0, 0) + c(0, 1) # Adds cell 0, 0 and cell 0, 1

c(0, 0) == c(0, 1) # Is cell 0, 0 equal to cell 0, 1 ?

Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another. This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a Python cell. 

## Referencing a range of cells

To reference a range of cells, use the global function \`cells\` which returns a Pandas DataFrame.

cells((0, 0), (2, 2)) # Returns a DataFrame with the cell values

If the first row of cells is a header, you can set \`first_row_header\` as an argument. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.

cells((2, 2), (7, 52), first_row_header=True)

As an example, this code references a table of expenses, filters it based on a user-specified column, and returns the resulting DataFrame to the spreadsheet.

# Pull the full expenses table in as a DataFrame
expenses_table = cells((2, 2), (7, 52), first_row_header=True)

# Take user input at a cell (Category = "Gas")
category = cell(10, 0)

# Filter the full expenses table to the "Gas" category, return the resulting DataFrame
expenses_table[expenses_table["Category"] == category]

Alternatively, slicing syntax works for selecting a range of cells (returns a Pandas DataFrame).




# Given a table like this:
#
#    [  0  ][  1  ]
# [0][ 100 ][ 600 ]
# [1][ 200 ][ 700 ]
# [2][ 300 ][ 800 ]
# [3][ 400 ][ 900 ]
# [4][ 500 ][  0  ]

# cells[row, col]
cells[0, 0] # -> [100]
cells[0, 1] # -> [200]
cells[1, 0] # -> [600]
cells[1, 1] # -> [700]

# cells[row_min:row_max, col]
cells[0:5, 0] # -> [100, 200, 300, 400, 500]
cells[0:5, 1] # -> [600, 700, 800, 900, 0]

# cells[row, col_min:col_max]
cells[0, 0:2] # -> [100, 600]
cells[1, 0:2] # -> [200, 700]

# cells[row_min:row_max, col_min:col_max]
cells[0:3, 0:2] # -> [[100, 200, 300], [600, 700, 800]]


## 

Referencing another sheet

To reference another sheet's cells or range of cells use the following: 

# Use the sheet name as an argument for referencing range of cells 
df = cells((0,0), (3,50), 'Sheet Name Here')

# For individual cell reference (alternatively can use just c instead of cell)
x = cell(0,0, 'Sheet Name Here')

## 

Relative references

Reference cells relative to the cell you're currently in with relative cell references in Python. 

### 

Get position of current cell

Keyword \`pos()\` returns a tuple of the \`(x, y)\` coordinates of the current cell. 

# if the current position is cell (1,1) this would return tuple (1,1)
(x, y) = pos() 

### 

Reference values in relative cells

Reference the values of cells relative the current position. 

# c is the cell one cell to the left of the current cell, use either rel_cell or rc
c = rel_cell(-1, 0)
c = rc(-1, 0)

# above for one cell to the left is equivalent to the following 
(x, y) = pos()
c = cell(x - 1, y)

# one cell left
c = rc(-1, 0)
# one cell up 
c = rc(0, -1)
# one cell right 
c = rc(1, 0)
# one cell down
c = rc(0, 1)
# five cells left, five cells down
c = rc(-5, 5)

# Return data to the sheet

Return the data from your Python code to the spreadsheet.

Quadratic is built to seamlessly integrate Python to the spreadsheet. This means being able to manipulate data in code and very simply output that data into the sheet. 

By default, the last line of code is output to the spreadsheet. This should be one of the four basic types: 

1. Single value: for displaying the single number result of a computation
2. List of values: for displaying a list of values from a computation
3. DataFrame:for displaying the workhorse data type of Quadratic
4. Chart: for displaying Plotly charts in Quadratic

You can expect to primarily use DataFrames as Quadratic is heavily built around Pandas DataFrames due to widespread Pandas adoption in almost all data science communities!

## 

1. Single Value

Note the simplest possible example, where we set \`x = 5\` and then return \`x\` to the spreadsheet by placing \`x\` in the last line of code.

# create variable 
x = 5 

# last line of code gets returned to the sheet, so x of value 5 gets returned
x


## 

2. List of values 

Lists can be returned directly to the sheet. They'll be returned value by value into corresponding cells as you can see below. 

# create a list that has the numbers 1 through 5 
my_list = [1, 2, 3, 4, 5]

# returns the list to the spreadsheet 
my_list

## 

3. DataFrame

You can return your DataFrames directly to the sheet by putting the DataFrame's variable name as the last line of code. 

# import pandas 
import pandas as pd
 
# create some sample data 
data = [['tom', 30], ['nick', 19], ['julie', 42]]
 
# Create the DataFrame
df = pd.DataFrame(data, columns=['Name', 'Age'])
 
# return DataFrame to the sheet
df

## 

4. Charts

Build your chart and return it to the spreadsheet by using the \`fig\` variable name or \`.show()\`

# import plotly
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type, for more chart types: https://plotly.com/python/
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada')

# display chart, alternatively can just put fig without the .show()
fig.show()


# Packages

Using and installing Python packages in Quadratic.

## 

Default packages

Many libraries are included by default, here are a few common ones:

* Pandas (https://pandas.pydata.org/)
* NumPy (https://numpy.org/)
* SciPy (https://scipy.org/)

Default packages can be imported like any other native Python package.

import pandas as pd
import numpy as np 
import scipy

Micropip can be used to install additional Python packages that aren't included by default (and their dependencies).

import micropip

# \`await\` is necessary to wait until the package is available
await micropip.install("faker")

# Import installed package
from faker import Faker

# Use the package!
fake = Faker()
fake.name()

This only works for packages that are either pure Python or for packages with C extensions that are built in Pyodide. If a pure Python package is not found in the Pyodide repository, it will be loaded from PyPI. Learn more about how packages work in Pyodide.

# Make an API request

Get the data you want, when you want it.

API requests are made seamless in Quadratic by allowing you to use Python and then display the result of the request directly to the sheet. 

## 

Query API - GET request

Let's break our GET request down into a few different pieces.

Import the basic requests library you're familiar with, query the API, and get the data into a Pandas DataFrame. 

# Imports
import requests
import pandas as pd

# Request
response = requests.get('your_API_url_here')

# JSON to DataFrame
df = pd.DataFrame(response.json())

# Display DataFrame in the sheet 
df

## 

**Query API - POST request**

import requests

# API url
url = 'your_API_url_here'
# API call body 
obj = {'somekey': 'somevalue'}

# create request 
x = requests.post(url, json = myobj)

# return the API response to the sheet
x.text

## 

**Going from CSV to DataFrame** 

Bringing your CSV to Quadratic is as simple as a drag and drop. Once your CSV is in the spreadsheet, reference the range of cells in Python to get your data into a DatarFrame. 

You use the argument \`first_row_header=True\` to avoid the first row of your DataFrame being what is intended to be our header. Note that the output, in this case, is printed to the console since you already have your initial CSV in the sheet. After some manipulation of the data, perhaps you would want to display your new DataFrame. In that case, leave \`df\` as the last line of code.

In this case, the spreadsheet reflects \`cells((0, 0),(0, 160))\` since we want the full span of data in both columns 0 and 1 spanning from rows 0 to 160.

df = cells((0,0),(1,160), first_row_header=True)


# Clean data

Get your data ready for analysis.

Cleaning data in Quadratic is more seamless than you may be used to, as your data is viewable in the sheet as you step through your DataFrame. Every change to your DataFrame can be reflected in the sheet in real-time. Some data cleaning steps you may be interested in taking (very much non-exhaustive!): 

1. View select sections of your DataFrame in the sheet
2. Drop specified columns
3. Field-specific changes
4. Clean columns
5. Delete select rows
6. Delete empty rows
7. Change data types
8. Remove duplicates

## 

1. View select sections of your DataFrame in the sheet

Assume DataFrame named \`df\`. With \`df.head()\` you can display the first x rows of your spreadsheet. With this as your last line the first x rows will display in the spreadsheet. You can do the same except with the last x rows via \`df.tail()\`



# Display first five rows
df.head(5)

# Display last five rows
df.tail(5)

## 

2. Drop specified columns

Deleting columns point and click can be done by highlighting the entire column and pressing \`Delete\`. Alternatively, do this programmatically with the code below. 

# Assuming DataFrame df, pick the columns you want to drop
columns_to_drop = ['Average viewers', 'Followers']

df.drop(columns_to_drop, inplace=True, axis=1)

## 

3. Field-specific changes

There are many ways to make field-specific changes, but this list will give you some ideas. 

# Replace row 7 in column 'Duration' with the value of 45
 df.loc[7, 'Duration'] = 45

## 

4. Clean columns

Going column by column to clean specific things is best done programmatically. 

# Specify things to replace empty strings to prep drop 
df['col1'].replace(things_to_replace, what_to_replace_with, inplace=True)

## 

5. Delete select rows

With the beauty of Quadratic, feel free to delete rows via point and click; in other cases, you may need to do this programmatically. 

# Knowing your row, you can directly drop via
df.drop(x)

# Select a specific index, then drop that index
x = df[((df.Name == 'bob') &( df.Age == 25) & (df.Grade == 'A'))].index
df.drop(x)

## 

6. Delete empty rows

Identifying empty rows should be intuitive in the spreadsheet via point-and-click; in other cases, you may need to do this programmatically. 

# Replace empty strings to prep drop 
df['col1'].replace('', np.nan, inplace=True)

# Delete where specific columns are empty 
df.dropna(subset=['Tenant'], inplace=True)


## 

7. Change data types

By default, Quadratic inputs will be read as strings by Python code. Manipulate these data types as you see fit in your DataFrame. 

# Specify column(s) to change data type
df.astype({'col1': 'int', 'col2': 'float'}).dtypes

# Common types: float, int, datetime, string

## 

8. Remove duplicates

Duplicates are likely best removed programmatically, not visually. Save some time with the code below. 

# Drop duplicates across DataFrame
df.drop_duplicates()

# Drop duplicates on specific columns 
df.drop_duplicates(subset=['col1'])

# Drop duplicates; keep the last 
df.drop_duplicates(subset=['col1', 'col2'], keep='last')


# Manipulate data

Perform novel analysis on your data.

Manipulating data in Quadratic is easier than ever as you can view your changes in the sheet in real-time. Here is a non-exhaustive list of ways to manipulate your data in Quadratic: 

1. Find correlations
2. Basic stats - max, min, average, selections, etc.
3. DataFrame math
4. Data selections

## 

1. Find correlations

# Get the correlation and show the value in the sheet
data['col1'].corr(data['col2'], method='pearson')

# possible methods: pearson, kendall, spearman 

## 

2. Basic stats - max, min, mean, selections, etc.

Reference: https://pandas.pydata.org/docs/getting_started/intro_tutorials/06_calculate_statistics.html

# Get the max value of a column
df["col1"].max()

# Get the min value of a column
df["col1"].min()

# Get the mean value of a column
df["col1"].mean()

# Get the median value of a column
df["col1"].median()

# Get the skew for all columns
df.skew()

# Count the values in a column
df["col1"].value_counts()

# Get the summary of a column
df["col1"].describe()


## 

3. DataFrame math

Do math on data in the DataFrame. Alternatively, use formulas in the sheet on the values. 

# Add, subtract, multiply, divide, etc., will all work on all values in a column
df['col1'] + 1
df['col1'] - 1
df['col1'] * 2
df['col1'] / 2 

# Do any arbitrary math column-wise with the above or do DataFrame-wise via
df + 1 


## 

4. Data selections

Alternatively, cut//paste specific values in the sheet. 

# get a column 
df['col1'] 

# get multiple columns 
df[['col1', 'col2']] 

# filtering


# Visualize data

Glean insights from your data, visually.

Create beautiful visualizations using our in-app Plotly support. Plotly support works just as you're used to in Python, displaying your chart straight to the spreadsheet. 

## 

Getting started

Building charts in Quadratic is centered around Python charting libraries, starting with Plotly. Building charts in Plotly is broken down into 3 simple steps: 

1. Create and display a chart
2. Style your chart
3. Chart controls

## 

1. Create and display a chart

### 

Line charts

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


### 

Bar charts

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


### 

Histograms 

# Import Plotly
import plotly.express as px

# Create figure - replace df with your data
fig = px.histogram(df, x = 'output')

# Display to sheet 
fig.show()


### 

Scatter plots 

import plotly.express as px

# replace df, x, and y and color with your data
fig = px.scatter(df, x="col1", y="col2", color="col3")
fig.update_traces(marker_size=10)
fig.update_layout(scattermode="group")
fig.show()


### 

Heatmaps

# Import library
import plotly.express as px

# Assumes 2d array Z
fig = px.imshow(Z, text_auto=True)

# Display chart
fig.show()


### 

More chart types

For more chart types, explore the Plotly docs: https://plotly.com/python/

## 

2. Styling

For more styling, explore the Plotly styling docs: https://plotly.com/python/styling-plotly-express/

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


## 

3. Chart controls

 Resize by dragging the edges of the chart. 

PreviousManipulate dataNextAI code assistant

Last updated 2 months ago

# AI code assistant

Empower your workflows with AI via ChatGPT in your spreadsheet.

Part of viewing Python as a first-class citizen inside Quadratic means viewing AI code assistance as a first-class citizen. We've integrated ChatGPT directly into the spreadsheet. The AI will understand your context and references to the spreadsheet and help you as you perform your analysis. This feature can be found directly in the code editor. 

See this example where we define a relatively broad and unclear question, but our AI assistant intelligently responds line by line with a solution. 

Once your code is generated, simply make the changes you need and place it directly into your editor, continuing your analysis seamlessly. 

# Getting started

Work with classic spreadsheet logic - math, references, and point and click manipulation for quick data analysis.

Get started with Formulas the same way as any other spreadsheet - click \`=\` on a cell and get started right away. Formulas are in-line by default. 

![](https://docs.quadratichq.com/~gitbook/image?url=https%3A%2F%2F2438361843-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252Ff1Y5UzPF2x1oIzVJbUK8%252Fuploads%252FHTQ9dPB22Zg1MoxOhvOx%252F1.gif%3Falt%3Dmedia%26token%3D26cf9ac2-fcc3-4c1f-975b-32d6a9aaec93&width=768&dpr=4&quality=100&sign=f2c373d&sv=1)

In-line formulas in Quadratic

You can also optionally use multi-line Formulas for those Formulas that need to be expanded to become readable. 

To open the multi-line editor either use / and select it in the cell type selection menu or use the multi-line editor button from the in-line editor as showed below. 

![](https://docs.quadratichq.com/~gitbook/image?url=https%3A%2F%2F2438361843-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252Ff1Y5UzPF2x1oIzVJbUK8%252Fuploads%252FaAS10a8Is66NYjUiMict%252FCleanShot%25202024-05-15%2520at%252009.24.02%25402x.png%3Falt%3Dmedia%26token%3Db35976c2-8040-484e-9199-54bf1a70b06e&width=768&dpr=4&quality=100&sign=3d5ed994&sv=1)

The multi-line editor becomes useful when Formulas become more difficult to read than the space afforded by the in-line editor. Example:




IF( Z0 > 10, 
    IF( Z1 > 10, 
        IF (Z2 > 10, 
            AVERAGE(Z0:Z2), 
            "Invalid Data",
        ),
        "Invalid Data", 
    ),
    "Invalid Data", 
)


Cells are by default referenced relatively in Quadratic. Use $ notation to do absolute references, similar to what you'd be familiar with in traditional spreadsheets. Learn more on the Reference cells page.

Jump to: 👉 **Cell references**

Jump to: 📜 **Formulas cheat sheet**

PreviousAI code assistantNextReference cells

# Reference cells

Reference data in other cells from your formula

## 

1. Reference an individual cell

To reference an individual cell, use standard spreadsheet notation. The only difference is that Quadratic allows negative axes; for negative notation, append \`n\` to the cell reference. Cells are, by default, relatively referenced. Use \`$\` notation to use absolute references. 

**Examples in the table below:**

| Formula Notation | (x, y) coordinate plane equivalent |
| ---------------- | ---------------------------------- |
| A0               | (0,0)                              |
| A1               | (0,1)                              |
| B1               | (1,1)                              |
| An1              | (0,-1)                             |
| nA1              | (-1,1)                             |
| nAn1             | (-1,-1)                            |

## 

2. Relative cell reference 

Individual cells and ranges are, by default, referenced relatively. E.g. -pasting \`A1\` to the following two rows will produce \`A2\`, and \`A3\` respectively.

To reference a range of cells relatively, use the traditional spreadsheet notation that separates two distinct cells using a semicolon as a delimiter, e.g. \`A1:D3\`

Cells in this notation are referenced relatively, so you can drag out a cell to replicate that formula relatively across your selection. 

## 

3. Absolute cell references

To perform absolute cell references, use standard spreadsheet notation with \`$\`, for example \`$A$1:D3\` - \`A1\` will be copied absolutely and \`D3\` will be copied relatively if you drag to replicate.

## 

3. Reference across sheets

To reference the value from another sheet, use the sheet name in quotations with an \`!\`.

### 

Single cell

To reference cell F12 in a sheet named "Sheet 1" from a sheet named "Sheet 2" use: 




"Sheet 1"!F12


### 

Range of cells 

To reference cells F12 to F14 in Sheet 1 from Sheet 2, use:




"Sheet 1"!F12:F14


PreviousGetting startedNextFormulas cheat sheet

Last updated 2 months ago

On this page

* 1. Reference an individual cell
* 2. Relative cell reference
* 3. Absolute cell references
* 3. Reference across sheets
* Single cell
* Range of cells


# Formulas cheat sheet

Using formulas in the spreadsheet.

## 

Navigation

Operators

Math Functions

Trig Functions

Stats Functions

Logic Functions

String Functions

Lookup Functions

Arrays

Criteria

Wildcards

## 

Operators

| Precedence   | Symbol                              | Description              |
| ------------ | ----------------------------------- | ------------------------ |
| 1            | x%                                  | Percent (divides by 100) |
| 2            | +x                                  | positive                 |
| -x          | negative                            |                          |
| 3            | a:b                                 | cell range               |
| 4            | a..b                                | numeric range            |
| 5            | a^b or a**b                       | Exponentiation           |
| 6            | a*b                                | Multiplication           |
| a/b          | Division                            |                          |
| 7            | a+b                                 | Addition                 |
| a-b          | Subtraction                         |                          |
| 8            | a&b                                 | String concatenation     |
| 9            | a=b or a==b                         | Equal comparison         |
| a<>b or a!=b | Not equal comparison                |                          |
| a<b          | Less than comparison                |                          |
| a>b          | Greater than comparison             |                          |
| a<=b         | Less than or equal to comparison    |                          |
| a>=b         | Greater than or equal to comparison |                          |

## 

Math Functions

| Function                                         | Description                                                                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SUM([range])                                   | Adds all values in range and returns 0 if given no values.                                                                                                                                                                                            |
| SUMIF(eval_range, criteria, [numbers_range]) | Evaluates each value based on some criteria, and then adds the ones that meet those criteria. If range_to_sum is given, then values in range_to_sum are added instead wherever the corresponding value in range_to_evaluate meets the criteria. |
| PRODUCT([range])                               | Multiply all values in the range. Returns 1 if given no values.                                                                                                                                                                                       |
| ABS(number)                                      | Return the absolute value of a number.                                                                                                                                                                                                                |
| SQRT(number)                                     | Returns the square root of a number.                                                                                                                                                                                                                  |
| PI()                                             | Returns π, the constant.                                                                                                                                                                                                                              |
| TAU()                                            | Returns τ, the circle constant equal to 2π.                                                                                                                                                                                                           |

## 

Trig Functions

| Function         | Description                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEGREES(radians) | Converts radians to degrees.                                                                                                                                            |
| RADIANS(degrees) | Converts degrees to radians.                                                                                                                                            |
| SIN(radians)     | Returns the sine of an angle in radians.                                                                                                                                |
| ASIN(number)     | Returns the inverse sine of a number, in radians, ranging from 0 to π.                                                                                                  |
| COS(radians)     | Returns the cosine of an angle in radians.                                                                                                                              |
| ACOS(number)     | Returns the inverse cosine of a number, in radians, ranging from 0 to π.                                                                                                |
| ATAN2(x, y)      | Returns the counterclockwise angle, in radians, from the X axis to the point (x, y). Note that the argument order is reversed compared to the typical atan2() function. |
| TAN(radians)     | Returns the tangent of an angle in radians.                                                                                                                             |
| ATAN(number)     | Returns the inverse tangent of a number, in radians, ranging from -π/2 to π/2.                                                                                          |
| CSC(radians)     | Returns the cosecant of an angle in radians.                                                                                                                            |
| ACSC(number)     | Returns the inverse cosecant of a number, in radians, ranging from -π/2 to π/2.                                                                                         |
| SEC(radians)     | Returns the secant of an angle in radians.                                                                                                                              |
| ASEC(number)     | Returns the inverse secant of a number, in radians, ranging from 0 to π.                                                                                                |
| COT(radians)     | Returns the cotangent of an angle in radians.                                                                                                                           |
| ACOT(number)     | Returns the inverse cotangent of a number, in radians, ranging from 0 to π.                                                                                             |
| SINH(radians)    | Returns the hyperbolic sine of an angle in radians.                                                                                                                     |
| ASINH(number)    | Returns the inverse hyperbolic sine of a number, in radians.                                                                                                            |
| COSH(radians)    | Returns the hyperbolic cosine of an angle in radians.                                                                                                                   |
| ACOSH(number)    | Returns the inverse hyperbolic cosine of a number, in radians.                                                                                                          |
| TANH(radians)    | Returns the hyperbolic tangent of an angle in radians.                                                                                                                  |
| ATANH(number)    | Returns the inverse hyperbolic tangent of a number, in radians.                                                                                                         |
| CSCH(radians)    | Returns the hyperbolic cosecant of an angle in radians.                                                                                                                 |
| ACSCH(number)    | Returns the inverse hyperbolic cosecant of a number, in radians.                                                                                                        |
| SECH(radians)    | Returns the hyperbolic secant of an angle in radians.                                                                                                                   |
| ASECH(number)    | Returns the inverse hyperbolic secant of a number, in radians.                                                                                                          |
| COTH(radians)    | Returns the hyperbolic cotangent of an angle in radians.                                                                                                                |
| ACOTH(number)    | Returns the inverse hyperbolic cotangent of a number, in radians.                                                                                                       |

## 

Statistics Functions

| Function                                             | Description                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AVERAGE([numbers...])                              | Returns the arithmetic mean of all values.                                                                                                                                                                                                                                                  |
| AVERAGEIF(eval_range, criteria, [numbers_range]) | Evaluates each value based on some criteria, and then computes the arithmetic mean of the ones that meet those criteria. If range_to_average is given, then values in range_to_average are averaged instead wherever the corresponding value in range_to_evaluate meets the criteria. |
| COUNT([numbers...])                                | Returns the number of numeric values.                                                                                                                                                                                                                                                       |
| COUNTIF(range, criteria)                             | Evaluates each value based on some criteria, and then counts how many values meet those criteria.                                                                                                                                                                                           |
| COUNTBLANK([range...])                             | Counts how many values in the range are empty. Cells with formula or code output of an empty string are also counted.                                                                                                                                                                       |
| MIN([numbers...])                                  | Returns the smallest value. Returns +∞ if given no values.                                                                                                                                                                                                                                  |
| MAX([numbers...])                                  | Returns the largest value. Returns -∞ if given no values.                                                                                                                                                                                                                                   |

## 

Logic Functions

These functions treat \`FALSE\` and \`0\` as "falsey" and all other values are "truthy."

When used as a number, \`TRUE\` is equivalent to \`1\` and \`FALSE\` is equivalent to \`0\`.

| Function       | Description                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| TRUE()         | Returns TRUE.                                                                                                                          |
| FALSE()        | Returns FALSE.                                                                                                                         |
| NOT(a)         | Returns TRUE if a is falsey and FALSE if a is truthy.                                                                                  |
| AND(a, b, ...) | Returns TRUE if all values are truthy and FALSE if any values is falsey. \\ Returns TRUE if given no values.                           |
| OR(a, b, ...)  | Returns TRUE if any value is truthy and FALSE if any value is falsey. Returns FALSE if given no values.                                |
| XOR(a, b, ...) | Returns TRUE if an odd number of values are truthy and FALSE if an even number of values are truthy. Returns FALSE if given no values. |
| IF(cond, t, f) | Returns t if cond is truthy and f if cond if falsey.                                                                                   |

## 

String Functions

| CONCAT(a, b, ...) | Concatenates all values as strings. |
| ----------------- | ----------------------------------- |

## 

Lookup Functions

| INDIRECT(cellref_string) | Returns the value of the cell at a given location. |
| ------------------------- | -------------------------------------------------- |

### 

VLOOKUP

\`VLOOKUP(search_key, search_range, output_col, [is_sorted])\`

Examples:

* \`VLOOKUP(17, A1:C10, 3)\`
* \`VLOOKUP(17, A1:C10, 2, FALSE)\`

Searches for a value in the first vertical column of a range and return the corresponding cell in another vertical column, or an error if no match is found.

If \`is_sorted\` is \`TRUE\`, this function uses a binary search algorithm, so the first column of \`search_range\` must be sorted, with smaller values at the top and larger values at the bottom; otherwise the result of this function will be meaningless. If \`is_sorted\` is omitted, it is assumed to be \`false\`.

If any of \`search_key\`, \`output_col\`, or \`is_sorted\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements.

### 

HLOOKUP

\`HLOOKUP(search_key, search_range, output_row, [is_sorted])\`

Examples:

* \`HLOOKUP(17, A1:Z3, 3)\`
* \`HLOOKUP(17, A1:Z3, 2, FALSE)\`

Searches for a value in the first horizontal row of a range and return the corresponding cell in another horizontal row, or an error if no match is found.

If \`is_sorted\` is \`TRUE\`, this function uses a binary search algorithm, so the first row of \`search_range\` must be sorted, with smaller values at the left and larger values at the right; otherwise the result of this function will be meaningless. If \`is_sorted\` is omitted, it is assumed to be \`false\`.

If any of \`search_key\`, \`output_col\`, or \`is_sorted\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements.

### 

XLOOKUP

\`XLOOKUP(search_key, search_range, output_range, [fallback], [match_mode], [search_mode])\`

Examples:

* \`XLOOKUP("zebra", A1:Z1, A4:Z6)\`
* \`XLOOKUP({"zebra"; "aardvark"}, A1:Z1, A4:Z6)\`
* \`XLOOKUP(50, C4:C834, B4:C834, {-1, 0, "not found"}, -1, 2)\`

Searches for a value in a linear range and returns a row or column from another range.

\`search_range\` must be either a single row or a single column.

### 

Match modes

There are four match modes:

* 0 = exact match (default)
* 1 = next smaller
* 1 = next larger
* 2 = wildcard

### 

Search modes

There are four search modes:

* 1 = linear search (default)
* 1 = reverse linear search
* 2 = binary search
* 2 = reverse binary search

Linear search finds the first matching value, while reverse linear search finds the last matching value.

Binary search may be faster than linear search, but binary search requires that values are sorted, with smaller values at the top or left and larger values at the bottom or right. Reverse binary search requires that values are sorted in the opposite direction. If \`search_range\` is not sorted, then the result of this function will be meaningless.

Binary search is not compatible with the wildcard match mode.

### 

Result

If \`search_range\` is a row, then it must have the same width as \`output_range\` so that each value in \`search_range\` corresponds to a column in \`output_range\`. In this case, the **search axis** is vertical.

If \`search_range\` is a column, then it must have the same height as \`output_range\` so that each value in \`search_range\` corresponds to a row in \`output_range\`. In this case, the **search axis** is horizontal.

If a match is not found, then \`fallback\` is returned instead. If there is no match and \`fallback\` is omitted, then returns an error.

If any of \`search_key\`, \`fallback\`, \`match_mode\`, or \`search_mode\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements. These arrays must also have compatible size with the non-search axis of \`output_range\`.

## 

Arrays

An array can be written using \`{}\`, with \`,\` between values within a row and \`;\` between rows. For example, \`{1, 2, 3; 4, 5, 6}\` is an array with two rows and three columns:

| 1 | 2 | 3 |
| - | - | - |
| 4 | 5 | 6 |

Arrays cannot be empty and every row must be the same length.

Numeric ranges (such as \`1..10\`) and cell ranges (such as \`A1:A10\`) also produce arrays. All operators and most functions can operate on arrays, following these rules:

1. Operators always operate element-wise. For example, \`{1, 2, 3} + {10, 20, 30}\` produces \`{11, 22, 33}\`.
2. Functions that take a fixed number of values operate element-wise. For example, \`NOT({TRUE, TRUE, FALSE})\` produces \`{FALSE, FALSE, TRUE}\`.
3. Functions that can take any number of values expand the array into individual values. For example, \`SUM({1, 2, 3})\` is the same as \`SUM(1, 2, 3)\`.

When arrays are used element-wise, they must be the same size. For example, \`{1, 2} + {10, 20, 30}\` produces an error.

When an array is used element-wise with a single value, the value is expanded into an array of the same size. For example, \`{1, 2, 3} + 10\` produces \`{11, 12, 13}\`.

## 

Criteria

Some functions, such as \`SUMIF()\`, take a **criteria** parameter that other values are compared to. A criteria value can be a literal value, such as \`1\`, \`FALSE\`, \`"blue"\`, etc. A literal value checks for equality (case-insensitive). However, starting a string with a comparison operator enables more complex criteria:

| **Symbol**           | **Description**                  |
| -------------------- | -------------------------------- |
| "=blue" or "==blue"  | Equal comparison                 |
| "<>blue" or "!=blue" | Not-equal comparison             |
| "<blue"              | Less-than comparison             |
| ">blue"              | Greater-than comparison          |
| "<=blue"             | Less-than-or-equal comparison    |
| ">=blue"             | Greater-than-or-equal comparison |

For example, \`COUNTIF(A1:A10, ">=3")\` counts all values greater than or equal to three, and \`COUNTIF(A1:A10, "<>blue")\` counts all values _not_ equal to the text \`"blue"\` (excluding quotes).

Numbers and booleans are compared by value (with \`TRUE\`=1 and \`FALSE\`=0), while strings are compared case-insensitive lexicographically. For example, \`"aardvark"\` is less than \`"Camel"\` which is less than \`"zebra"\`. \`"blue"\` and \`"BLUE"\` are considered equal.

## 

Wildcards

Wildcard patterns can be used …

* … When using a criteria parameter with an equality-based comparison (\`=\`, \`==\`, \`<>\`, \`!=\`, or no operator)
* … When using the \`XLOOKUP\` function with a \`match_mode\` of \`2\`

In wildcards, the special symbols \`?\` and \`*\` can be used to match certain text patterns: \`?\` matches any single character and \`*\` matches any sequence of zero or more characters. For example, \`DEFEN?E\` matches the strings \`"defence"\` and \`"defense"\`, but not \`"defenestrate"\`. \`*ATE\` matches the strings \`"ate"\`, \`"inflate"\`, and \`"late"\`, but not \`"wait"\`. Multiple \`?\` and \`*\` are also allowed.

To match a literal \`?\` or \`*\`, prefix it with a tilde \`~\`: for example, \`COUNTIF(A1:A10, "HELLO~?")\` matches only the string \`"Hello?"\` (and uppercase/lowercase variants).

To match a literal tilde \`~\` in a string with \`?\` or \`*\`, replace it with a double tilde \`~~\`. For example, \`COUNTIF(A1:A10, "HELLO ~~?")\` matches the strings \`"hello ~Q"\`, \`"hello ~R"\`, etc. If the string does not contain any \`?\` or \`*\`, then tildes do not need to be escaped.

PreviousReference cellsNextCreate your team

Last updated 2 months ago

On this page

* Navigation
* Operators
* Math Functions
* Trig Functions
* Statistics Functions
* Logic Functions
* String Functions
* Lookup Functions
* VLOOKUP
* HLOOKUP
* XLOOKUP
* Match modes
* Search modes
* Result
* Arrays
* Criteria
* Wildcards


# Create your team

Work together with your team and organization.

## 

Create your team

Quadratic Teams are the way to extend your analysis beyond your spreadsheets. 

Invite others to your team in a few quick steps. Each of your Teams will show up in the side panel so you can quickly get back to work on your shared team files. 

## 

Team permissions 

Members of your team(s) will, by default, have access to all of your sheets within the team. 

It's up to you to set the team permissions of each member. These permissions are global to your team and will apply to all spreadsheets within that team. 

* **Owner:** creator of the team, can add and remove members and edit all files
* **Editor:** can edit all files but cannot add or remove members
* **Viewer:** can view all files but not edit files and cannot add and remove members

To edit permissions, open the Members tab from the image above. From here, the owner can manage the members. Non-owners can also see all the members of their team. 

PreviousFormulas cheat sheetNextCollaboration

Last updated 2 months ago

On this page

* Create your team
* Team permissions



# Collaboration

Work together with your teammates.

Once team members have joined your team, you can easily edit collaboratively in real-time. 

## 

Editing collaboratively 

Once you have editors in your sheet you can edit cells together in real-time. 

## 

User following

You can follow users by clicking their portrait. This will then put you in follow mode which you can exit by pressing \`escape\`.

PreviousCreate your teamNextPricing

Last updated 3 months ago

On this page

* Editing collaboratively
* User following





# Navigating

Navigate the Quadratic spreadsheet.

For advanced users, feel free to skip to Shortcuts for the condensed list of shortcuts for navigating the spreadsheet. Read the enclosed for a more in-depth feature-by-feature exploration of navigating Quadratic. 

## 

Cell type palette \`/\`

Pressing \`/\` on a cell will open the cell type palette. Once open, choose the type of cell you want to create. 

## 

Panning

Quadratic was built to be the most fluid navigating spreadsheet. Enabling this is the 60 FPS experience from WASM + WebGL. Try it out holding \`Spacebar\` and then panning you can experience the ease of navigation for yourself. 

## 

Presentation mode

You can use presentation mode to directly present your visualizations or data story to your audience with \`Ctrl\` + \`.\` (Mac: \`⌘ Command\` + \`.\` )

## 

Command Palette

Simple search pop-up for all in-app actions. Open the command palette by pressing \`Ctrl\` + \`p\` (Mac: \`⌘ Command\` + \`p\`

## 

Seamless Zooming

Zoom in: \`Ctrl\`+\`+\` (Mac: \`⌘ Command\` + \`+\` ) Zoom out: \`Ctrl\`+\`-\` (Mac: \`⌘ Command\` + \`-\` )

## 

**Formatting**

\`Right-click\` a cell to open a menu of formatting options.

## 

Add tabs

Add tabs to your sheet via the bottom left of the sheet. 

You can add colors, rearrange, rename, and access more settings by right clicking a tab.

## 

More spreadsheet basics



Press / to open the cell selection menu.


# Files

Files are a way to share or save your work for non-team users.

All Files are saved on the Quadratic cloud so you can access your files from any device.

## 

Download files

You can download and share local files from Quadratic. Simply navigate to the top left and use \`File\` --> \`Download local \`. 

## 

Multiplayer files

To get started with working together with your team simply click share in the top right. From here you can add and remove viewers and editors. 

To learn more about multiplayer: 

pageSharing files

## 

Browser permissions

Some browsers have strict permissioning which may block certain browser actions - the only action identified thus far that will be blocked by lack of permissions is to \` selection as PNG\`. 

If you've denied the sheet access to perform permissioned actions the first time this feature will not work. You will need to grant the browser file system access to fix this error. 




# Shortcuts

Shortcuts for navigating your spreadsheets faster.

As you gain familiarity with the spreadsheet, start navigating faster with shortcuts. We break the cheat sheet down into a few sections of shortcuts. 

## 

Code and Formula Editor Shortcuts 

| Code and Formula Editor | Windows / Linux                  | Mac                                   |
| ----------------------- | -------------------------------- | ------------------------------------- |
| Select Cell Type        | =                               | =                                    |
| Run or Re-Run           | Ctrl + Enter                    | ⌘ Command + Enter                    |
| Close Editor            | Esc                              | Esc                                   |
| Run all cells in sheet  | Shift + Windows + Enter        | Shift + ⌘ Command + Enter           |
| Run all cells in file   | Shift + Alt + Windows + Enter | Shift + Option + ⌘ Command + Enter |

## 

Files and Editing Shortcuts 

| Files and Editing | Windows / Linux    | Mac                       |
| ----------------- | ------------------ | ------------------------- |
| Open File         | Ctrl + o          | ⌘ Command + o            |
| Undo              | Ctrl + z          | ⌘ Command + z            |
| Redo              | Ctrl + Shift + z | ⌘ Command + ⇧ Shift + z |
| Cut               | Ctrl + x          | ⌘ Command + x            |
|               | Ctrl + c          | ⌘ Command + c            |
| Paste             | Ctrl + p          | ⌘ Command + v            |
|  as PNG       | Ctrl + Shift + c | ⌘ Command + ⇧ Shift + c |

## 

Cell Selection and Formatting 

| Cell Selection & Formatting | Windows / Linux     | Mac                         |
| --------------------------- | ------------------- | --------------------------- |
| Format Menu                 | Right-click         | Right-click                 |
| Bold                        | Ctrl + b           | ⌘ Command or ⌃ Control + b |
| Italic                      | Ctrl + i           | ⌘ Command or ⌃ Control + i |
| Clear All Formatting        | Ctrl + \\          | ⌘ Cmd + \\                 |
| Select Multiple Cells       | Shift + Arrow keys | ⇧ Shift + Arrow keys       |

## 

Navigation and View

| Navigation & View | Windows / Linux | Mac             |
| ----------------- | --------------- | --------------- |
| Go to Cell        | Ctrl + g       | ⌘ Command + g  |
| Command Palette   | Ctrl + p       | ⌘ Command + p  |
| Presentation Mode | Ctrl + .       | ⌘ Command + .  |
| Drag Canvas       | Spacebar (hold) | Spacebar (hold) |
| Zoom In           | Ctrl + +       | ⌘ Command + +  |
| Zoom Out          | Ctrl + -      | ⌘ Command + - |
| Zoom to Selection | Ctrl + 8       | ⌘ Command + 8  |
| Zoom to Fit       | Ctrl + 9       | ⌘ Command + 9  |
| Zoom to 100%      | Ctrl + 0       | ⌘ Command + 0  |

The following is how to write Javascript in Quadratic. Here are some examples. 

In Quadratic, reference individual cells from JavaScript for single values or reference a range of cells for multiple values. 
Referencing individual cells
To reference an individual cell, use the global function cell (or c for short) which returns the cell value.
// NOTE: cell is (x,y), so cell(2,3) means column 2, row 3 
let data = cell(2, 3);

return data;
You can reference cells and use them directly. 
let data = c(0, 0) + c(0, 1) # Adds cell 0, 0 and cell 0, 1

let data = c(0, 0) == c(0, 1) # Is cell 0, 0 equal to cell 0, 1 ?
Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another. This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a JavaScript cell. 
Referencing a range of cells
To reference a range of cells, use the global function cells. This returns an array.

let data = getCells(x1, y1, x2, y2)
Referencing another sheet
To reference another sheet's cells or range of cells use the following: 
let data = getCells(x1, y1, x2, y2, 'sheet_name')

Relative references
Reference cells relative to the cell you're currently in with relative cell references in JavaScript. 
Get position of current cell
Keyword pos() returns the current cell's position. 
# if the current position is cell (1,1) this would return an object with values 1,1
let cellPos = pos();
Reference values in relative cells
Reference the values of cells relative the current position. 
// c is the cell one cell to the left of the current cell, use either rel_cell or rc
let d = rc(-1, 0);

// above for one cell to the left is equivalent to the following 
let cellPos = pos();
let data = getCell(cellPos['x'] - 1, cellPos['y']);

// one cell left
let d = rc(-1, 0);
// one cell up 
let d = rc(0, -1);
// one cell right 
let d = rc(1, 0);
// one cell down
let d = rc(0, 1);
// five cells left, five cells down
let d = rc(-5, 5);

return d;

Single values, arrays, and charts are the JavaScript types that can be returned to the sheet. Any data can be structured as an array and returned to the sheet. 
Single value 
// from variable with assigned value
let data = 5; 

// return this value to the sheet
return data;
1-d array 
let data = [1, 2, 3, 4, 5];

return data;
2-d array 
let data = [[1,2,3,4,5],[1,2,3,4,5];

return data;
Charts
import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

// create data 
let data = [['Africa', 'Asia', 'Europe', 'Latin America', 'North America'],[2478, 5267, 734, 784, 433]]

// print data to console 
console.log(data);

// Create chart 
new Chart(canvas, {
    type: 'bar',
    data: {
        labels: data[0],
        datasets: [
        {
            label: "Population (millions)",
            backgroundColor: ["#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"],
            data: data[1]
        }
        ]
    },
    options: {
        legend: { display: false },
        title: {
        display: true,
        text: 'Predicted world population (millions) in 2050'
        }
    }
});

// return chart to the sheet 
return canvas;

GET Request
Perform API requests using the standard JavaScript approach of Fetch. 
// API for get requests
let res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
let json = await res.json();

console.log(json);

return [Object.keys(json), Object.values(json)];

Charts are supported in JavaScript using charts.js. No other libraries are currently supported. 
Bar chart
import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

// create data 
let data = [['Africa', 'Asia', 'Europe', 'Latin America', 'North America'],[2478, 5267, 734, 784, 433]]

// print data to console 
console.log(data)

// Create chart 
new Chart(canvas, {
    type: 'bar',
    data: {
        labels: data[0],
        datasets: [
        {
            label: "Population (millions)",
            backgroundColor: ["#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"],
            data: data[1]
        }
        ]
    },
    options: {
        legend: { display: false },
        title: {
        display: true,
        text: 'Predicted world population (millions) in 2050'
        }
    }
});

// return chart to the sheet 
return canvas;
Line chart
import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

// create data 
let data = [['1999', '2000', '2001', '2002', '2003'],[2478, 5267, 734, 784, 433]]

// print data to console 
console.log(data)

// Create chart 
new Chart(canvas, {
    type: 'line',
    data: {
        labels: data[0],
        datasets: [
        {
            label: "Population (millions)",
            backgroundColor: ["#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"],
            data: data[1]
        }
        ]
    },
    options: {
        legend: { display: false },
        title: {
        display: true,
        text: 'Predicted world population (millions) in 2050'
        }
    }
});

// return chart to the sheet 
return canvas;

Packages in JavaScript are supported using ESM. You can use a third-party JS CDN to load third-party packages. Some possible CDNs include: 
https://www.jsdelivr.com/esm
https://www.unpkg.com
https://esm.sh
Example
import Chart from 'https://esm.run/chart.js/auto'`;
