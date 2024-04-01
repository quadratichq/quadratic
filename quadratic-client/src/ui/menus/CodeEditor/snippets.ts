const snippets = [
  {
    label: 'Read data from the sheet',
    keywords: 'reference cells',
    code: `# Reference a single value from the sheet; replace x,y with coordinates
my_cell = cell(x, y)

# Or reference a range of cells (returns a Pandas DataFrame), replace x's and y's with coordinates
df = cells((x1, y1), (x2, y2), first_row_header=True)

# Reference cell or range of cells in another sheet 
my_cell = cell(2, 4, 'Sheet 2')
df = cells((x1, y1), (x2, y2), 'Sheet 2', first_row_header=True)`,
  },
  {
    label: 'Return data to the sheet',
    keywords: 'return value',
    code: `out = []
for x in range(10):
    out.append(x)

# Last line returns to the sheet
out

# [out] # Wrap in array to expand horizontally`,
  },
  {
    label: 'Make a GET request',
    keywords: 'fetch data api network json',
    code: `import requests 
import pandas as pd 

# Fetch data - replace URL with your API
response = requests.get('https://jsonplaceholder.typicode.com/users')

# Get json response into DataFrame
df = pd.DataFrame(response.json())

# Display DataFrame to sheet
df`,
  },
  {
    label: 'Make a POST request',
    keywords: 'fetch data api network json',
    code: `import requests

# replace with your API url 
url = 'https://jsonplaceholder.typicode.com/users'

# json to send to API
myobj = {'somekey': 'somevalue'}

# url and json sent 
# for additional parameters commonly used in POST request: https://www.w3schools.com/python/ref_requests_post.asp
x = requests.post(url, json = myobj)

print(x.text)`,
  },
  {
    label: 'Select DataFrame columns',
    code: `# reference range of cells from the sheet, or get you data some other way
df = cells((x1, y1), (x2, y2), first_row_header=True)

# get single column by column name 
col = df['column_name_here']

# create new DataFrame from multiple columns by column names
df = df.filter(items=['column_name_one', 'column_name_two', 'etc.'])

# return column as series to sheet or return filtered df
col`,
  },
  {
    label: 'Filter a DataFrame',
    keywords: 'query filter slice',
    code: `import pandas as pd 

# reference range of cells from the sheet, or get your data some other way
df = pd.DataFrame({'num_legs': [2, 4, 8, 0],
                   'num_wings': [2, 0, 0, 0],
                   'num_specimen_seen': [10, 2, 1, 8]})

# filtering range of rows - example gets first 3 rows, zero-indexed
filtered_df = df.loc[0:2]

# get last row of DataFrame 
filtered_df = df.tail(1)

# get first five rows of DataFrame 
filtered_df = df.head(5)

# example query
filtered_df = df.query('num_legs > 2 and num_specimen_seen >= 1')

# return your filtered DataFrame to the sheet
filtered_df`,
  },
  {
    label: 'Relative cell reference',
    keywords: 'relative reference position cell',
    code: `# reference one cell to the left of the current cell
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
c = rc(-5, 5)`,
  },
  {
    label: 'Create a line chart',
    keywords: 'plotly',
    code: `# import plotly
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
fig.show()`,
  },
  {
    label: 'Create a bar chart',
    keywords: 'plotly',
    code: `# import plotly
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
fig.show()`,
  },
  {
    label: 'Import a 3rd-party library',
    keywords: 'micropip install',
    code: `# only necessary for libraries that aren't automatically supported by Pyodide
# https://pyodide.org/en/stable/usage/packages-in-pyodide.html
# packages from micropip
# https://pypi.org/search/?q=faker
import micropip
await micropip.install('library_name')

import library_name`,
  },
];

export default snippets;
