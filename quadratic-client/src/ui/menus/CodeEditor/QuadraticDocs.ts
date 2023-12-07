export const QuadraticDocs = `Getting started
The infinite spreadsheet with Python, SQL, and AI.
Quadratic is a spreadsheet built for modern teams. Quadratic combines the familiar spreadsheet UI and formulas with the power of Python, SQL (coming soon), and AI.
Get started in ​
If you have any questions or feedback, we’d love to hear it! Share by , sending us an email at support@quadratichq.com

Presentation mode
You can use presentation mode to directly present your visualizations or data story to your audience with Ctrl + .  (Mac: ⌘ Command + . )
Command Palette
Simple search pop-up for all in-app actions. Open the command palette by pressing Ctrl + p (Mac: ⌘ Command + p
Seamless Zooming
Zoom in: Ctrl + +  (Mac: ⌘ Command + + )
Zoom out: Ctrl + -  (Mac: ⌘ Command + - )
Formatting
Right-click a cell to open a menu of formatting options.
Cell type palette =
Pressing = on a cell will open the cell type palette. Once open, choose the type of cell you want to create. 
Add tabs
Add tabs to your sheet via the bottom left of the sheet. 
You can add colors, rearrange, rename, and access more settings by right clicking a tab.

More spreadsheet basics​
Shortcuts
Shortcuts for navigating your spreadsheets faster.
As you gain familiarity with the spreadsheet, start navigating faster with shortcuts. We break the cheat sheet down into a few sections of shortcuts. 
Code and Formula Editor Shortcuts 
Code and Formula Editor
Windows / Linux
Mac
Select Cell Type
=
=
Run or Re-Run
Ctrl + Enter
⌘ Command + Enter 
Close Editor
Esc
Esc
Files and Editing Shortcuts 
Files and Editing
Windows / Linux
Mac
Open File
Ctrl + o
⌘ Command + o
Undo
Ctrl + z
⌘ Command + z
Redo
Ctrl + Shift + z
⌘ Command + ⇧ Shift + z
Cut
Ctrl + x
⌘ Command + x
Copy
Ctrl + c
⌘ Command + c
Paste
Ctrl + p
⌘ Command + v
Copy as PNG
Ctrl + Shift + c
⌘ Command + ⇧ Shift + c
Cell Selection and Formatting 
Cell Selection & Formatting
Windows / Linux
Mac
Format Menu
Right-click
Right-click
Bold
Ctrl + b
⌘ Command or ⌃ Control + b
Italic
Ctrl + i
⌘ Command or ⌃ Control + i
Clear All Formatting 
Ctrl + \
⌘ Cmd + \
Select Multiple Cells
Shift + Arrow keys
⇧ Shift + Arrow keys 
Navigation and View
Navigation & View
Windows / Linux
Mac
Go to Cell
Ctrl + g
⌘ Command + g
Command Palette 
Ctrl + p
⌘ Command + p 
Presentation Mode
Ctrl + . 
⌘ Command + .
Drag Canvas
Spacebar (hold)
Spacebar (hold)
Zoom In
Ctrl + + 
⌘ Command + +
Zoom Out
Ctrl + -
⌘ Command + -
Zoom to Selection
Ctrl + 8 
⌘ Command + 8
Zoom to Fit
Ctrl + 9 
⌘ Command + 9
Zoom to 100%
Ctrl + 0
⌘ Command + 0 

Data
Get started putting data in the spreadsheet.
There are four ways to get data into your spreadsheet: 
​​
1. Manual input
Self-explanatory, manually input your data. Quadratic enables rich copy-pasting from other sources (sheets, notepad, etc) into Quadratic. As you input your data, manually change formatting via the toolbar. 
2. Drag and drop a .CSV 
Simply drag the file from your system directly into the spreadsheet. Supports up to millions of rows in a few seconds, tops.
3. Connect to database via SQL
We are currently building this feature. 
4. Ingest from API 
Connect to your data APIs to GET, POST, etc. Supported via the standard Python requests library. This simple example shows how to get your data from request to Pandas DataFrame. 

import requests
import pandas as pd
​
response = requests.get('your_API_url_goes_here')
df = pd.DataFrame(response.json())

Importing Excel Files (and other data file formats) - this is not currently supported. To import your Excel file's data to Quadratic you can save as .CSV and then use the .CSV drag and drop feature to import your data straight into Quadratic.

Present & share
Glean insights from your data, visually.
​ make your spreadsheet more viewable while not editing.
​ turn raw data into beautiful visualizations. 
​ let others play with and edit your work as a team. 
​ copy and paste data into any presentation, design tool, or anywhere else you'd want to share your PNG.
​ get your spreadsheets into any page on the web.
1. Present your data
Ctrl + . (Mac: ⌘ Command + .) enters presentation mode, removing the grid lines to present your data and visualizations, seamlessly. 
Notice how the grid and toolbars disappear in presentation mode, enabling a smooth presentation mode.  We recommend using Spacebar + Mouse to smoothly pan as you present your workbooks.
2. Visualize your data
Create beautiful Plotly charts in Quadratic. View the visualize your data page to learn more.
​
​
3. Share your work
By sharing, you allow other users to view your sheet, code, etc. We are currently working on adding multiplayer editing. 
Note: You are allowing anyone with the link to see your sheet by sharing.
Multiplayer editing is a feature we are currently working on. Users can only share in 'view mode' with other users. 
4. Copy as PNG
Select the cells you wish to copy and simply Right-click and select copy as PNG or use the shortcut Ctrl + Shift + c (Mac: ⌘ Command + Shift + c)
You can then paste your PNG into your presentations, articles, etc.
Note: the below sample data has used the copy-paste as PNG feature to copy/paste straight into our docs! 
5. Embed in a webpage via iFrame
If you have public sharing permissions turned ON in your spreadsheet, you can freely embed your spreadsheet in any site that allows embedding. Use the URL to your spreadsheet in an <iframe> HTML tag.
Example:
<iframe src="Quadratic_sheet_URL" title="your sheet description"></iframe>

Getting started
Get started writing rich Python code inside the spreadsheet.
Quadratic is very focused on a rich developer experience. This means focusing on features that enable you to have a streamlined development workflow, not unlike what you might experience in your favorite IDE.
Python is a first-class citizen in Quadratic. This means ample room to extend the code editor, AI code assistance, and rich error messaging. 
We view Python as having four key roles in the spreadsheet: 
​ ingest data - get the data you're looking for into the spreadsheet for analysis 
​ clean data - wrangle your data and get it in a format that is clear and readable 
​ manipulate data - merge cleaned datasets, glean basic insights, move data from point A to point B
​ present and visualize data - glean key business insights from your data, reference it in other sources, visualize it, and deliver it as PDFs, apps, etc.
Each step above is a major step in the data analysis process and often involves multiple applications. In Quadratic we want teams to go from ingesting data to understanding and referencing their data in a short time, with minimal tooling. 
The following pages summarize the four steps we think are important for using Python in Quadratic, starting with ingesting data. First, however, you need to learn how to reference the sheet from Python, how Python packages work in Quadratic, and how to display your data in the spreadsheet. 

Reference cells
Reference cells from Python.
In Quadratic,  from Python for single values or  for multiple values. 
Referencing individual cells
To reference an individual cell, use the global function cell (or c for short) which returns the cell value.
# NOTE: cell is (x,y), so cell(2,3) means column 2, row 3 
cell(2, 3) # Returns the value of the cell
​
c(2, 3) # Returns the value of the cell
You can reference cells and use them directly in a Pythonic fashion. 
c(0, 0) + c(0, 1) # Adds cell 0, 0 and cell 0, 1
​
c(0, 0) == c(0, 1) # Is cell 0, 0 equal to cell 0, 1 ?
Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another. This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a Python cell. 
Referencing a range of cells
To reference a range of cells, use the global function cells which returns a .
cells((0, 0), (2, 2)) # Returns a DataFrame with the cell values
If the first row of cells is a header, you can set first_row_header as an argument. This makes the first row of your DataFrame the column names, otherwise will default to integer column names as 0, 1, 2, 3, etc.
cells((2, 2), (7, 52), first_row_header=True)
As an example, this code references a table of expenses, filters it based on a user-specified column, and returns the resulting DataFrame to the spreadsheet.
# Pull the full expenses table in as a DataFrame
expenses_table = cells((2, 2), (7, 52), first_row_header=True)
​
# Take user input at a cell (Category = "Gas")
category = cell(10, 0)
​
# Filter the full expenses table to the "Gas" category, return the resulting DataFrame
expenses_table[expenses_table["Category"] == category]
Alternatively,  works for selecting a range of cells (returns a Pandas DataFrame).
# Given a table like this:
#
#    [  0  ][  1  ]
# [0][ 100 ][ 600 ]
# [1][ 200 ][ 700 ]
# [2][ 300 ][ 800 ]
# [3][ 400 ][ 900 ]
# [4][ 500 ][  0  ]
​
# cells[row, col]
cells[0, 0] # -> [100]
cells[0, 1] # -> [200]
cells[1, 0] # -> [600]
cells[1, 1] # -> [700]
​
# cells[row_min:row_max, col]
cells[0:5, 0] # -> [100, 200, 300, 400, 500]
cells[0:5, 1] # -> [600, 700, 800, 900, 0]
​
# cells[row, col_min:col_max]
cells[0, 0:2] # -> [100, 600]
cells[1, 0:2] # -> [200, 700]
​
# cells[row_min:row_max, col_min:col_max]
cells[0:3, 0:2] # -> [[100, 200, 300], [600, 700, 800]]
Referencing another sheet
To reference another sheet's cells or range of cells use the following: 
# simply use the sheet name as an argument for referencing range of cells 
df = cells((0,0), (3,50), 'Sheet Name Here')
​
# for individual cell reference (alternatively can use just c instead of cell)
x = cell(0,0, 'Sheet Name Here')

Return data to the sheet
Return the data from your Python code to the spreadsheet.
Quadratic is built to seamlessly integrate Python to the spreadsheet. This means being able to manipulate data in code and very simply output that data into the sheet. 
By default, the last line of code is output to the spreadsheet. This should be one of the three basic types: 
​: for displaying the single number result of a computation 
​ for displaying a list of values from a computation
​ for displaying the workhorse data type of Quadratic
(you can expect to primarily use DataFrames as Quadratic is heavily built around Pandas DataFrames due to widespread Pandas adoption in almost all data science communities!)
1. Single Value
Note the simplest possible example, where we set x = 5 and then return x to the spreadsheet by placing x in the last line of code.
2. List of values 
In this example, note that we do a basic calculation to fill our list result. Since we want that list output to the sheet, we put the result in the last line and its output to the sheet, starting with the $2,154,446,753 value you see in the sheet.
3. DataFrame
In this example, we query the Mercury Bank Sandbox API, manipulating our data into a DataFrame. Since the DataFrame is our last line of code, we output to the sheet. Note that the column headers are the column headers in our DataFrame. Supports up to millions of rows. 

Ingest data
Get the data you want, when you want it.
Ingesting data into spreadsheets can be cumbersome. We believe data ingestion is best performed with programming languages, specifically Python; APIs and databases are the standard data sources for any data team. 
Pandas DataFrames are the de-facto data wrangling surface in Quadratic. Once your data has been ingested, getting it into your DataFrame is the obvious first choice. Once in a DataFrame, your data can be returned to the spreadsheet and manipulated outside of Python. In the following examples, we showcase the entire workflow from querying data sources to getting the data into a DataFrame to display in the spreadsheet. 
Query API - GET Request
Let's break our GET request down into a few different pieces. 
Import the basic requests library you're familiar with, query the API, and get the data into a Pandas DataFrame. 
# imports 
import requests
import pandas as pd
​
# request
response = requests.get('your_API_url_here')
​
# json to DataFrame
df = pd.DataFrame(response.json())
​
# display DataFrame in the sheet 
df

Going from CSV to DataFrame 
Bringing your CSV to Quadratic is as simple as a drag and drop. Once your CSV is in the spreadsheet, reference the range of cells in Python to get your data into a DatarFrame. 
You use the argument first_row_header=True to avoid the first row of your DataFrame being what is intended to be our header. Note that the output, in this case, is printed to the console since you already have your initial CSV in the sheet. After some manipulation of the data, perhaps you would want to display your new DataFrame. In that case, leave df as the last line of code.
In this case, the spreadsheet reflects cells((0, 0),(0, 160)) since we want the full span of data in both columns 0 and 1 spanning from rows 0 to 160.
df = cells((0,0),(1,160), first_row_header=True)

Visualize data
Glean insights from your data, visually.
More chart types
For more chart types, explore the Plotly docs: ​
Styling
For more styling for Plotly charts: ​
# some chart styling options to assist getting started
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
Chart controls
Use Plotly chart controls to pan, zoom, download your plot as a PNG, and reset axes. 
Use chart controls
 Additionally, you can resize by dragging the edges of the chart. 

Quadratic does not support .show() When displaying your chart use plain fig, not fig.show().

Here is a code example for creating a chart 
# import library 
import plotly.express as px

# create figure 
fig = px.line(df, x='col1', y='col2', title="Power generation") 

# display figure to the spreadsheet
fig

Packages
Using and installing Python packages.
Default Packages
The following libraries are included by default:
Pandas
NumPy
SciPy 
Requests 

Default packages can be imported like any other native Python package.
import pandas as pd
import numpy as np 
import scipy
​ can be used to install additional Python packages (and their dependencies).
import micropip
​
# \`await\` is necessary to wait until the package is available
await micropip.install("faker")
​
# import installed package
from faker import Faker
​
# use the package!
fake = Faker()
fake.name()
This only works for packages that are either pure Python or for packages with C extensions that are built in Pyodide. If a pure Python package is not found in the Pyodide repository, it will be loaded from PyPI. .

Here's an example of a GET request in Python
# imports 
import requests
import pandas as pd

# request
response = requests.get('your_API_url_here')

# json to DataFrame
df = pd.DataFrame(response.json())

# display DataFrame in the sheet 
df`;
