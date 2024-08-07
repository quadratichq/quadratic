export const SNIPPET_PY_API = `import requests 
import pandas as pd 

response = requests.get('https://jsonplaceholder.typicode.com/users')
pd.DataFrame(response.json())

# Learn more:
# https://docs.quadratichq.com/python/api-requests`;

export const SNIPPET_PY_CHART = `# import plotly
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

# Learn more:
# https://docs.quadratichq.com/python/charts-visualizations`;

export const SNIPPET_PY_PACKAGE = `import micropip
await micropip.install('faker')
from faker import Faker

fake = Faker()
fake.name()

# Learn more:
# https://docs.quadratichq.com/python/packages`;

export const SNIPPET_PY_READ = `my_value = cell(0, 0)

# Learn more:
# https://docs.quadratichq.com/python/reference-cells`;

export const SNIPPET_PY_RETURN = `out = []
for x in range(10):
    out.append(x)
out # Last line returns to the sheet

# Learn more:
# https://docs.quadratichq.com/python/return-data-to-the-sheet`;

export const snippetsPY = [
  {
    label: 'Read data from the sheet',
    keywords: 'reference cells',
    code: SNIPPET_PY_READ,
  },
  {
    label: 'Return data to the sheet',
    keywords: 'return value',
    code: SNIPPET_PY_RETURN,
  },
  {
    label: 'Make a GET request',
    keywords: 'fetch data api network json',
    code: SNIPPET_PY_API,
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
    code: `import pandas as pd 

# reference range of cells from the sheet, or get your data some other way
df = pd.DataFrame({'num_legs': [2, 4, 8, 0],
                   'num_wings': [2, 0, 0, 0],
                   'num_specimen_seen': [10, 2, 1, 8]})

# get single column by column name 
col = df['num_legs']

# create new DataFrame from multiple columns by column names
df = df.filter(items=['num_legs', 'num_wings'])

# return filtered DataFrame
df`,
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
    code: SNIPPET_PY_CHART,
  },
  {
    label: 'Install a 3rd-party package',
    keywords: 'micropip install',
    code: SNIPPET_PY_PACKAGE,
  },
];
