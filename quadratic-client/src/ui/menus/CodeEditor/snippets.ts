const snippets = [
  {
    label: 'Return data to the sheet',
    description: 'Return a value, string, number, or DataFrame to the sheet',
    code: `out = []
for x in range(10):
    out.append(x)

# Last line returns to the sheet
out

# [out] # Wrap in array to expand horizontally`,
  },
  {
    label: 'Make a GET request',
    description: 'Fetch data from an API and display it in the sheet',
    keywords: 'network json',
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
    description: 'Send data to an API and display the response in the sheet',
    keywords: 'network json',
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
    label: 'Reference cells',
    description: 'Reference a single cell or range of cells from the sheet',
    code: `# Reference a single value from the sheet; replace x,y with coordinates
myCell = cell(x, y)

# Or reference a range of cells (returns a Pandas DataFrame), replace x's and y's with coordinates
df = cells((x1, y1), (x2, y2), first_row_header=True)

# Reference cell or range of cells in another sheet 
myCell = cell(2,4, 'Sheet 2')
df = cells((x1, y1), (x2, y2), 'Sheet 2', first_row_header=True)`,
  },
  {
    label: 'Select DataFrame columns',
    description: 'Select a one or more columns by name and return to the sheet',
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
    description: 'Query, filter, or slice a DataFrame and return the result to the sheet',
    code: `import pandas as pd 

# reference range of cells from the sheet, or get you data some other way
df = cells((x1, y1), (x2, y2), first_row_header=True)

# example query
filtered_df = df.query('column_one > 1 and column_two == "Male"')

# filtering range of rows - example gets first 3 rows, zero-indexed
filtered_df = df.loc[0:2]

# get last row of DataFrame 
filtered_df = df.tail(1)

# get first five rows of DataFrame 
filtered_df = df.head(5)

# return your filtered DataFrame to the sheet
filtered_df`,
  },
  {
    label: 'Create a line chart',
    description: 'Use plotly to create a line chart from a DataFrame',
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
    description: 'Use plotly to create a bar chart from a DataFrame',
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
    description: 'Use micropip to install and import a library not included in Pyodide',
    code: `# only necessary for libraries that aren't automatically supported by Pyodide
# https://pyodide.org/en/stable/usage/packages-in-pyodide.html
import micropip
await micropip.install('library_name')

import library_name`,
  },
];

export default snippets;
