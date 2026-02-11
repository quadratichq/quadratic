export const PythonDocs = `# Python Documentation for Quadratic

You can reference cells in the spreadsheet to use in code, and you can return results from your Python code back to the spreadsheet. The last line of code is returned to the spreadsheet.
Python does not support conditional returns in Quadratic. Only the last line of code is returned to the sheet. There can be only one variable returned to the sheet per code cell.

Data, variables, and imports are not global; they are scoped to the code cell they exist in and must be imported or referenced in every code cell that uses them.

When the data that code references is updated, the code cell is automatically re-run. Editing code and data dependencies always re-runs any dependencies.

## Reference cells from Python

You can reference tables, individual cells, and ranges of cells using Python.

Use table references by default when referencing data that is in a table; use A1 references when referencing data not in a table. 

### Referencing tables

\`\`\`python
# References entire table, including headers, places into DataFrame with table headers as DataFrame headers 
df = q.cells("Table1")

# Retrieves the column data and its header, places into single column DataFrame
df_column = q.cells("Table1[column_name]")

# Creates an empty DataFrame with just the DataFrame's headers as table's column names
df_headers = q.cells("Table1[#HEADERS]")

# Reference a range of columns from a table, e.g. in following example we reference columns 1, 2, and 3. Columns can then be dropped or manipulated using Pandas DataFrame logic.
df_columns = q.cells("Table1[[Column 1]:[Column 3]]")
\`\`\`python

Tables should be used whenever possible with tables. Use ranged A1 references or single cell references otherwise. 

### Referencing individual cells

\`\`\`python
# Reads the value in cell A1 and stores in variable x 
x = q.cells('A1')
\`\`\`

\`\`\`python
q.cells('A1') + q.cells('A2') # sum of values in A1 and A2
\`\`\`

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

If the first row of cells is a header, you should set \`first_row_header\` as an argument. This makes the first row of your received DataFrame the column names, otherwise will default to the default integer column names as 0, 1, 2, 3, etc. If the data being referenced in a ranged reference has headers, you should ALWAYS set first_row_header=True.

IMPORTANT: Use first_row_header when you have column names that you want as the header of the DataFrame. You can tell when a column name should be a header when the column name describes the data below. 

\`\`\`python
# first_row_header=True will be used any time the first row is the intended header for that data.
q.cells('A1:B9', first_row_header=True) # returns a 2x9 DataFrame with first row as DataFrame headers
\`\`\`

### Referencing another sheet

\`\`\`python
# Use the sheet name as an argument for referencing range of cells 
q.cells("'Sheet_name_here'!A1:C9", first_row_header=True)

# For individual cell reference 
q.cells("'Sheet_name_here'!A1")

# Since tables are global to a file, they can be referenced across sheets without defining sheet name
q.cells("Table1")
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

## Financial data

You can access financial data directly using \`q.financial\`. This provides built-in functions for retrieving stock prices and other financial data without needing external API keys or libraries.

### Stock prices

Use \`q.financial.stock_prices()\` to get historical stock price data. This function is async, so you must use \`await\`.

\`\`\`python
# Get daily stock prices for Apple
data = await q.financial.stock_prices("AAPL")

# Get stock prices for a specific date range
data = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-01-31")

# Get weekly stock prices for a date range
data = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-06-30", "weekly")
\`\`\`

#### Parameters

- \`identifier\` (required): Stock ticker symbol (e.g., "AAPL", "MSFT", "GOOGL")
- \`start_date\` (optional): Start date in YYYY-MM-DD format
- \`end_date\` (optional): End date in YYYY-MM-DD format
- \`frequency\` (optional): Frequency for price data. One of: "daily" (default), "weekly", "monthly", "quarterly", "yearly"

#### Return value

The function returns a dictionary with the following keys:

- \`stock_prices\`: A list of stock price records. Each record contains:
  - \`date\`: The calendar date for the stock price. For non-daily frequencies, this is the last day in the period (end of the week, month, quarter, year, etc.)
  - \`open\`: Price at the beginning of the period
  - \`high\`: Highest price over the span of the period
  - \`low\`: Lowest price over the span of the period
  - \`close\`: Price at the end of the period
  - \`volume\`: Number of shares exchanged during the period
  - \`frequency\`: The type of period the stock price represents
  - \`intraperiod\`: If True, the stock price represents an unfinished period, meaning the close price is the latest price available, not the official close price for the period
  - \`adj_open\`, \`adj_high\`, \`adj_low\`, \`adj_close\`, \`adj_volume\`: Adjusted values for splits and dividends
  - \`factor\`: Factor by which to multiply stock prices before this date to calculate historically-adjusted stock prices
  - \`split_ratio\`: Ratio of the stock split, if a stock split occurred
  - \`dividend\`: Dividend amount, if a dividend was paid
  - \`change\`: Difference in price from the last price for this frequency
  - \`percent_change\`: Percent difference in price from the last price for this frequency
  - \`fifty_two_week_high\`: The 52 week high price (daily only)
  - \`fifty_two_week_low\`: The 52 week low price (daily only)
- \`security\`: Information about the security, including \`id\`, \`ticker\`, \`name\`, \`exchange\`, \`currency\`, and other identifiers.
- \`next_page\`: A pagination token. If null, no further results are available.

To work with stock price data, extract the \`stock_prices\` list and convert it to a DataFrame.

## Return data to the sheet

Return the data from your Python code to the spreadsheet.

By default, the last line of code is output to the spreadsheet. Primarily return results to the spreadsheet rather than using print statements; print statements do not get returned to the sheet.

Only one value or variable (single value, single list, single dataframe, single series, single chart, etc) can be returned per code cell. If you need to return multiple things, such as numerical results of an analysis and a chart, you should use multiple code cells, outputting the analysis in one cell and the chart in another.

IMPORTANT: only one value or variable being returned means that you cannot return some kind of data and a chart in the same cell. You should return the data in one cell and the chart in another. In all cases, only one value or variable can be returned to the sheet per code cell.

Tuples, dictionaries, and sets are not ideal return types because they are output to a single cell formatted as they would if printed.

### Single value

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

# Each value of list occupies their own cell respectively  
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

DataFrame and series index will not be returned to the sheet. Reset index to return the index to the sheet. 

\`\`\`python
# use reset_index() method where df is the dataframe name
df.reset_index()
\`\`\`

This is necessary any time you use describe() method in Pandas or any method that returns a named index.

### Charts

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

You can not use the \`return\` keyword to return data to the sheet. 
Here is an example of successfully using a Python function to return data to the sheet. 

\`\`\`python
def do_some_math(x): 
    return x+1

# since this is the last line of code, it returns the result of do_some_math(), which in this case is 6 
do_some_math(5)
\`\`\`

Note that conditionals will not return the value to the sheet if the last line is a conditional. The following is an example that will return nothing to the sheet:

NEGATIVE EXAMPLE:  
\`\`\`python
x = 3
y = 0 
if x == 3: 
    y = True
else: 
    y = False
\`\`\`

The following is a positive example of how you would return the result of that conditional to the sheet.
 
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

### Formatting 

Do NOT try to use formatting options like f-strings (f"") or .format() on numerical return types. Returning formatted data will not flow through to the sheet; the sheet will read formatted numerical values as strings, keeping formatting options like currencies and significant digits from working on the returned values. 

### Supported sizes 

When returning DataFrames, default to returning the entire DataFrame. Do not use df.head() unless the user asks for it. The spreadsheet can comfortably handle a few million rows of data.

### Return single item per code cell 

You can only return a single item per code cell. For example, you can only return one table or one chart etc. You cannot return both a table and a chart to the sheet from the same cell. You cannot return multiple tables nor multiple charts from the same cell. Use individual code cells for each subsequent step you want to return to the sheet.

IMPORTANT: THIS IS AN EXAMPLE OF BAD CODE. IT WILL ONLY RETURN THE RAW CORRELATION VALUES AND NOT THE CHART! IF YOU WANT THE CHART AS WELL, CREATE A SEPARATE CODE CELL.

\`\`\`python
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Get the Walmart sales data
df = q.cells("Sales_Data", first_row_header=True)

# Calculate correlation matrix
correlation_matrix = df[['Weekly_Sales', 'Temperature', 'Fuel_Price', 'CPI', 'Unemployment']].corr()

# Create correlation heatmap
fig = px.imshow(correlation_matrix,
               color_continuous_scale='RdBu_r',
               zmin=-1, zmax=1,
               title='Correlation Matrix: Unemployment vs Other Variables',
               text_auto=True)

fig.update_layout(width=600, height=500)
fig.show()

# Return the correlation matrix for reference
correlation_matrix.round(3)
\`\`\`

NOTE THAT IN THE ABOVE EXAMPLE, ONLY THE CORRELATION MATRIX IS RETURNED TO THE SHEET. THE CHART DOES NOT GET SHOWN SINCE IT IS NOT THE LAST LINE OF CODE. IF YOU WANT THE CHART AS WELL, CREATE A SEPARATE CODE CELL. ONLY ONE ITEM CAN BE RETURNED TO THE SHEET PER CODE CELL.

## Packages

Using and installing Python packages.

### Default Packages

Some libraries are included by default, here are some examples (note that they need to be imported in every cell they are used even though they're included by default):

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

## Charts/visualizations

Plotly is the ONLY charting library supported in Quadratic. 

You cannot return multiple charts from the same cell. You must return each chart in a separate code cell or use Plotly subplots to show multiple charts in the same cell.

### Trendlines 

When using Trendlines in Plotly you MUST import statsmodels for the trendline to work. Note an example trendline below.

\`\`\`python
import plotly.express as px
import pandas as pd
import statsmodels

# Get the data
df = q.cells("concrete_data")

# Create scatter plot
fig = px.scatter(df, x='age', y='strength', 
                title='Concrete Strength vs Age',
                # THIS LINE CREATES THE REQUIREMENT FOR STATSMODELS
                trendline="lowess")

# Update layout
fig.update_layout(
    xaxis_title="Age (days)",
    yaxis_title="Strength (MPa)",
    plot_bgcolor='white'
)

fig.show()
\`\`\`

## Time-series analysis

For time-series analysis a good starting point is using statsmodels library for a simple ARIMA analysis. You can reference sheet data using table and sheet references to build these kinds of analysis.

\`\`\`python
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from .tsa.arima.model import ARIMA
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

Second code block visualizes the correlations in a heatmap since only one item can be returned to the sheet per code cell.
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
Python can NOT be used to import files like .xlsx, .pqt, .csv. Users should import xlsx, .pqt, and csv files to Quadratic by drag and dropping them directly into the sheet. They can then be read into Python with q.cells(). Python can not be used to import files (.xlsx, .csv, .pqt, etc).

To import PDF and image files, insert them to the AI chat with the paperclip attach button, copy/paste, or drag and drop directly in the chat. PDF and image files can not be imported via Python. Once in the sheet, they can be analyzed by first being read into Python with q.cells().

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

## Reading JSON strings

It is advised before reading a JSON string to print an example so you can see the format of the data before trying to process it into the sheet. 
`;
