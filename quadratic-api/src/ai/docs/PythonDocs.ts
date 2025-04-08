export const PythonDocs = `# Python Docs

Python is a first-class citizen that integrates seamlessly with Quadratic spreadsheets.
Below are in-depth details for Python in Quadratic. 

You can reference cells in the spreadsheet to use in code, and you can return results from your Python code back to the spreadsheet. The last line of code is returned to the spreadsheet.
Python does not support conditional returns in Quadratic. Only the last line of code is returned to the sheet. There can be only one type of return from a code cell, data or chart.

Single cell references are placed in a variable of corresponding type. Multi-line references are placed in a DataFrame.

Essential Python basics in Quadratic: 
1. Cell references - use q.cells() to read data from the sheet into Python with table references and A1 notation
2. Return data to the sheet - return Python outputs from code to the sheet; the last line is what gets returned 
3. Import Python packages - supporting some built-in libraries and others via micropip
4. Make API requests - use the Requests library to query APIs
5. Visualize data - turn your data into charts with Plotly exclusively, no other charting libraries supported 

## Reference cells from Python

You can reference tables, individual cells, and ranges of cells using Python.

### Referencing tables

Much of Quadratic's data is formatted in Data Tables for ease of use. To perform any reference type you can use \`q.cells\`. For table references this places the table in a DataFrame.


Note the following examples that use table references: 
\`\`\`python
# References entire table, including headers, places into DataFrame 
df = q.cells("Table1")

# Retrieves the column data and its header, places into single column DataFrame
df_column = q.cells("Table1[column_name]")

# Creates an empty DataFrame with just the DataFrame's headers as table's column names
df_headers = q.cells("Table1[#HEADERS]")

# Reference a range of columns from a table, e.g. in following example we reference columns 1, 2, and 3. Columns can then be dropped or manipulated using Pandas DataFrame logic.
df_columns = q.cells("Table1[[Column 1]:[Column 3]]")
\`\`\`python

Tables should be used whenever possible. Use ranged A1 references or single cell references otherwise. 

### Referencing individual cells

To reference an individual cell, use the global function \`q.cells\` which returns the cell value, as shown in following example.

\`\`\`python
# Reads the value in cell A1 and stores in variable x 
x = q.cells('A1')
\`\`\`

You can reference cells and use them directly in a Pythonic fashion, as shown in following example. 

\`\`\`python
q.cells('A1') + q.cells('A2') # Sums the values in cells A1 and A2 
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update; your code will execute whenever it makes a reference to another cell.

### Referencing a range of cells

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

### Referencing another sheet

To reference another sheet's table, individual cells , or range of cells use the following: 

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
q.cells("'Sheet_name_here'!A1:C9")

# For individual cell reference 
q.cells("'Sheet_name_here'!A1")

# Since tables are global to a file, they can be referenced across sheets without defining sheet name
q.cells("Table1")
\`\`\`

### Column references

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

### Relative vs absolute references

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

## Return data to the sheet

Return the data from your Python code to the spreadsheet.

By default, the last line of code is output to the spreadsheet. Primarily return results to the spreadsheet rather than using print statements; print statements do not get returned to the sheet.

Only one value or variable (single value, single list, single dataframe, single series, single chart, etc) can be returned per code cell. If you need to return multiple things, such as numerical results of an analysis and a chart, you should use multiple code cells, outputting the analysis in one cell and the chart in another.

All code outputs by default are given names that can be referenced, regardless of their return type. 

You can expect to primarily use DataFrames as Quadratic is heavily built around Pandas DataFrames.

### Single value

Note the simplest possible example, where we set \`x = 5\` and then return \`x\` to the spreadsheet by placing \`x\` in the last line of code.

\`\`\`python
# create variable 
x = 5 

# last line of code gets returned to the sheet, so the value 5 gets returned
x
\`\`\`

### List of values 

Lists can be returned directly to the sheet.  
\`\`\`python
my_list = [1, 2, 3, 4, 5]

# Returns the list to the spreadsheet, with each value from the list occupying their own cell  
my_list
\`\`\`

### DataFrame

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

This is necessary any time you use describe() method in Pandas or any method that returns a named index.
These methods create a named index so you'll need to use reset_index() if you want to correctly display the index in the sheet when you return the DataFrame. The index is never returned to the sheet. 

### Charts

Build your chart and return it to the spreadsheet by using the \`fig\` variable name or \`fig.show()\` as the last line of code. Chart will only get displayed if fig (or whatever the chart variable name is) or fig.show() are the last line of code.

\`\`\`python
import plotly.express as px

# replace this df with your data
df = px.data.gapminder().query("country=='Canada'")

# create your chart type
fig = px.line(df, x="year", y="lifeExp", title='Life expectancy in Canada')

# display chart in sheet
fig.show()
\`\`\`

### Function outputs

You can not use the \`return\` keyword to return data to the sheet, as that keyword only works inside of Python functions. The last line of code is what gets returned to the sheet, even if it's a function call.
Here is an example of using a Python function to return data to the sheet. 

\`\`\`python
def do_some_math(x): 
    return x+1

# since this is the last line of code, it returns the result of do_some_math(), which in this case is 6 
do_some_math(5)
\`\`\`

Note that conditionals will not return the value to the sheet if the last line is a conditional. The following is an example that will return nothing to the sheet:

Negative example: 
\`\`\`python
x = 3
y = 0 
if x == 3: 
    y = True
else: 
    y = False
\`\`\`

The following is how you would return the result of that conditional to the sheet.

Positive example: 
\`\`\`python
x = 3
y = 0 
if x == 3: 
    y = True
else: 
    y = False
y
\`\`\`

Do NOT try to use try-except blocks. It is much more useful to simply return the output to the sheet and let the error surface in the sheet and the console. 

If you create an error and need to see the data, a print statement (e.g. print(df.head(3)) of the data can allow you to see the data to continue with a more useful result. 

Negative example: 
\`\`\`python
x = 3

try: 
    x += 1 
except: 
    print('error')
\`\`\`

Instead, simply return the output to the sheet. If an error occurs it will surface to the sheet and the console correctly. Never use try-except blocks.
Positive example: 
\`\`\`python
x = 3

# since this is the last line of code, it returns the result of x + 1, which in this case is 4 
x += 1
\`\`\`

## Packages

Using and installing Python packages.

### Default Packages

Some libraries are included by default, here are some examples:

* Pandas 
* NumPy 
* SciPy 
* Plotly
* Scikit-learn
* Statsmodels
* Nltk
* Regex

Default packages can be imported like any other native Python package.

\`\`\`python
import pandas as pd
import numpy as np 
import scipy
\`\`\`

### Additional packages

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

If you receive the following error then the library is likely not available in Quadratic or you've misspelled the library name: 
"Can't find a pure Python 3 wheel."

## API requests

API Requests in Python must use the Requests library.

### GET request

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

### POST request

\`\`\`python
import requests

url = 'your_API_url_here'

obj = {'somekey': 'somevalue'}

x = requests.post(url, json = myobj)

# return the API response to the sheet
x.text
\`\`\`

## Charts/visualizations

Plotly is the only charting library supported in Quadratic. Do not try to use other libraries like Seaborn or Matplotlib. Matplotlib DOES NOT WORK in Quadratic. 

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

## Time-series analysis

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

## Machine learning

For machine learning, Scikit-learn is recommended. Here's a simple sklearn example. 

When generating scikit-learn examples it helps to add a visualization, but it is not strictly required.

\`\`\`python
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

# Load data from the Sample_Data table
df = q.cells("Sample_Data_Table")

# Extract features and target
X = df[['Feature1', 'Feature2']].values
y = df['Target'].astype(int).values  # Convert target to integers

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Create and train the model
model = LogisticRegression()
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

# Calculate accuracy
accuracy = accuracy_score(y_test, y_pred)

# Create a meshgrid for visualization
x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
xx, yy = np.meshgrid(np.arange(x_min, x_max, 0.01),
                     np.arange(y_min, y_max, 0.01))

# Get predictions for the meshgrid
Z = model.predict(np.c_[xx.ravel(), yy.ravel()])
Z = Z.reshape(xx.shape)

# Create plot with decision boundary
fig = go.Figure()

# Add decision boundary contour
fig.add_trace(
    go.Contour(
        z=Z,
        x=np.arange(x_min, x_max, 0.01),
        y=np.arange(y_min, y_max, 0.01),
        showscale=False,
        colorscale='RdBu',
        opacity=0.4,
        contours=dict(showlines=False)
    )
)

# Add scatter points for class 0
fig.add_trace(
    go.Scatter(
        x=X[y==0, 0],
        y=X[y==0, 1],
        mode='markers',
        name='Class 0',
        marker=dict(color='blue', size=10)
    )
)

# Add scatter points for class 1
fig.add_trace(
    go.Scatter(
        x=X[y==1, 0],
        y=X[y==1, 1],
        mode='markers',
        name='Class 1',
        marker=dict(color='red', size=10)
    )
)

# Update layout
fig.update_layout(
    title=f'Logistic Regression Decision Boundary (Accuracy: {accuracy:.2f})',
    xaxis_title='Feature 1',
    yaxis_title='Feature 2',
    plot_bgcolor='white'
)

fig.show()
\`\`\`

## Correlations

Do not attempt to build a correlation analysis unless the user asks for it. 

Note there are two code examples here. A good correlation analysis will have two code cells generated - the first is for the correlations, the second visualizes in a heatmap.

Here is an example of a successful correlation analysis.

First code block finds the correlations. 
\`\`\`python
import pandas as pd
import numpy as np

# Get the stock data
df = q.cells("Stock_Market_Data")

# Calculate daily returns for each stock (better for correlation analysis than raw prices)
stock_columns = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']
df_returns = df.copy()

for col in stock_columns:
    df_returns[f'{col}_return'] = df[col].pct_change() * 100

# Drop the first row (which has NaN returns) and keep only return columns
df_returns = df_returns.drop(columns=stock_columns + ['Date']).dropna()

# Calculate correlation matrix of returns
correlation_matrix = df_returns.corr()

# Round the result that is returned to the sheet so it is more readable 
correlation_matrix.round(3)
\`\`\`

Second code block visualizes the correlations in a heatmap.
\`\`\`python
import plotly.express as px

# Get the correlation matrix from previous code - previous code outputs table is named "Python2"
df = q.cells("Python2")

# Create a heatmap visualization
fig = px.imshow(df,
               color_continuous_scale='RdBu_r',
               zmin=-1, zmax=1,
               title='Stock Returns Correlation Matrix')

fig.update_layout(
    xaxis_title='Stock',
    yaxis_title='Stock',
    coloraxis_colorbar=dict(
        title='Correlation',
    ),
    plot_bgcolor='white'
)

# Display the heatmap
fig.show()
\`\`\`

## File imports and exports
Python can NOT be used to import files like .xlsx or .csv. Users should import those files directly to Quadratic by drag and dropping them directly into the sheet. They can then be read into Python with q.cells(). Python can not be used to import files (.xlsx, .csv, .pqt, etc).

Python can also not be used to export/download data as various file types. To download data from Quadratic, highlight the data you'd like to download, right click, and select the "Download as CSV" button.

## Sentiment analysis 

For sentiment analysis, NLTK is recommended. Here's a simple NLTK example.

\`\`\`python
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
import pandas as pd

# Download required NLTK data
nltk.download('vader_lexicon')

# Get text data and create DataFrame
text_data = q.cells('A1:A3')
df = pd.DataFrame(text_data).rename(columns={0: 'Text'})

# Initialize the NLTK sentiment analyzer
sia = SentimentIntensityAnalyzer()

# Analyze sentiment
df['Sentiment_Scores'] = df['Text'].apply(lambda x: sia.polarity_scores(x)['compound'])

# Define sentiment categories
df['Sentiment'] = df['Sentiment_Scores'].apply(lambda x: 'Positive' if x > 0.05 
                                             else ('Negative' if x < -0.05 
                                             else 'Neutral'))

# Return the resulting DataFrame
df
\`\`\`

## Web scraping

You should use Beautifulsoup4 for web scraping.

Here is a successful example of web scraping. 
\`\`\`python
# Import necessary libraries
import requests
import pandas as pd
import micropip

# Install BeautifulSoup4
await micropip.install('beautifulsoup4')
from bs4 import BeautifulSoup

# URL of the Denver Nuggets Wikipedia page
url = 'https://en.wikipedia.org/wiki/Denver_Nuggets'

# Send a GET request to fetch the webpage
response = requests.get(url)

# Parse the HTML content
soup = BeautifulSoup(response.content, 'html.parser')

# Extract the page title
title = soup.find('h1', {'id': 'firstHeading'}).text
print(f"Page title: {title}")

# Extract team information from the infobox
infobox = soup.find('table', {'class': 'infobox'})

# Initialize lists to store the data
info_labels = []
info_values = []

# Extract data from the infobox
if infobox:
    rows = infobox.find_all('tr')
    for row in rows:
        header = row.find('th')
        data = row.find('td')
        if header and data:
            info_labels.append(header.text.strip())
            info_values.append(data.text.strip())

# Create a DataFrame with the extracted information
nuggets_info = pd.DataFrame({
    'Category': info_labels,
    'Information': info_values
})

# Extract section headers for team history
section_titles = []
section_ids = []

for heading in soup.find_all(['h2', 'h3']):
    if heading.get('id'):
        section_titles.append(heading.text.strip())
        section_ids.append(heading.get('id'))

sections_df = pd.DataFrame({
    'Section': section_titles,
    'ID': section_ids
})

# Return the team information DataFrame
nuggets_info
\`\`\`

## Summarizing data 

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

## Reading JSON strings

It is advised before reading a JSON string to print an example so you can see the format of the data before trying to process it into the sheet. 
`;
