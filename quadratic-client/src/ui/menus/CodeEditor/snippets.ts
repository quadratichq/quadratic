const snippets = [
  {
    label: 'GET request',
    description: 'Fetch data from an API and display it in the sheet',
    code: `import requests 
import pandas as pd 

# Fetch data - replace URL with your API
response = requests.get('https://jsonplaceholder.typicode.com/users')

# Get json response into dataframe
df = pd.DataFrame(response.json())

# Display dataframe to sheet
df`,
  },
  {
    label: 'POST request',
    description: 'Send data to an API and display the response in the sheet',
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
    label: 'Cell references',
    description: 'Reference a single cell or range of cells from the sheet',
    code: `# Reference a single value from the sheet; replace x,y with coordinates
myCell = cell(x, y)

# Or reference a range of cells (returns a Pandas DataFrame), replace x's and y's with coordinates
df = cells((x1, y1), (x2, y2), first_row_header=True)

# Reference cell or range of cells in another sheet 
myCell = cell(2,4, 'Sheet 2')
df = cells((x1, y1), (x2, y2), 'Sheet 2', first_row_header=True)`,
  },
];

export default snippets;
