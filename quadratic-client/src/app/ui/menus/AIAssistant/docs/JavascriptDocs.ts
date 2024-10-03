export const JavascriptDocs = `# Javascript Docs

With JavaScript in Quadratic, the world's most popular programming language meets the world's most popular tool for working with data - spreadsheets. 

Below are a bunch of quick links to find more details on how to write JavaScript in Quadratic.

# Reference cells

Reference cells from JavaScript.

In Quadratic, reference individual cells from JavaScript for single values or reference a range of cells for multiple values. 

Referencing individual cells

To reference an individual cell, use the global function \`cell\` (or \`c\` for short) which returns the cell value.

\`\`\`javascript
// NOTE: cell is (x,y), so cell(2,3) means column 2, row 3 
let data = cell(2, 3);

return data;
\`\`\`

You can reference cells and use them directly. 

\`\`\`javascript
let data = c(0, 0) + c(0, 1) # Adds cell 0, 0 and cell 0, 1

let data = c(0, 0) == c(0, 1) # Is cell 0, 0 equal to cell 0, 1 ?
\`\`\`

Any time cells dependent on other cells update the dependent cell will also update. This means your code will execute in one cell if it is dependent on another. This is the behavior you want in almost all situations, including user inputs in the sheet that cause calculation in a JavaScript cell. 

Referencing a range of cells

To reference a range of cells, use the global function \`cells\`. This returns an array.

\`\`\`javascript
let data = cells(x1, y1, x2, y2)
\`\`\`

Referencing another sheet

To reference another sheet's cells or range of cells use the following: 

\`\`\`javascript
let data = cells(x1, y1, x2, y2, 'sheet_name')
\`\`\`

Relative references

Reference cells relative to the cell you're currently in with relative cell references in JavaScript. 

Get position of current cell

Keyword \`pos()\` returns the current cell's position. 

\`\`\`javascript
// if the current position is cell (1,1) this would return an object with values 1,1
let cellPos = pos();
\`\`\`

Reference values in relative cells

Reference the values of cells relative the current position. 

\`\`\`javascript
// c is the cell one cell to the left of the current cell, use either rel_cell or rc
let d = rc(-1, 0);

// above for one cell to the left is equivalent to the following 
let cellPos = pos();
let data = cell(cellPos['x'] - 1, cellPos['y']);

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
\`\`\`

# Return data to the sheet

Single values, arrays, and charts are the JavaScript types that can be returned to the sheet. Any data can be structured as an array and returned to the sheet. 

Single value 

\`\`\`javascript
// from variable with assigned value
let data = 5; 

// return this value to the sheet
return data;
\`\`\`

1-d array 

\`\`\`javascript
let data = [1, 2, 3, 4, 5];

return data;
\`\`\`

2-d array 

\`\`\`javascript
let data = [[1,2,3,4,5],[1,2,3,4,5]];

return data;
\`\`\`

Charts

\`\`\`javascript
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
\`\`\`

# API Requests

How to make API requests in JavaScript.

GET request

Perform API requests using the standard JavaScript approach of Fetch. javascript

\`\`\`javascript
// API for get requests
let res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
let json = await res.json();

console.log(json);

return [Object.keys(json), Object.values(json)];
\`\`\`

GET request with error handling 

\`\`\`javascript
async function getData() {
  const url = "https://jsonplaceholder.typicode.com/todos/1";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(\`Response status: \${response.status}\`);
    }

    const json = await response.json();
    // Return the JSON object as a 2D array
    return [Object.keys(json), Object.values(json)];
  } catch (error) {
    console.error(error.message);
    // Return the error message to the sheet
    return \`Error: \${error.message}\`;
  }
}

// Call the function and return its result to the sheet
return await getData();
\`\`\`

POST request with body

\`\`\`javascript
async function getData() {
  // replace with your API URL and body parameters 
  const url = "https://example.org/products.json";
  const requestBody = {
    key1: "value1",
    key2: "value2"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(\`Response status: \${response.status}\`);
    }

    const json = await response.json();
    // Return the JSON object as a 2D array
    return [Object.keys(json), Object.values(json)];
  } catch (error) {
    console.error(error.message);
    // Return the error message to the sheet
    return \`Error: \${error.message}\`;
  }
}

// Call the function and return its result to the sheet
return await getData();
\`\`\`

If you ever get stuck with JavaScript code (especially requests) that doesn't seem to be working but is showing no error, you may be missing an \`await\` somewhere that it is needed. 

# Charts/visualizations

Charts are supported in JavaScript using charts.js. No other libraries are currently supported. 

Bar chart

\`\`\`javascript
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
\`\`\`

Line chart

\`\`\`javascript
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
\`\`\`

# Packages

Packages in JavaScript are supported using ESM. You can use a third-party JS CDN to load third-party packages. Some possible CDNs include: 

* We recommend using esm.run from https://www.jsdelivr.com/esm
* https://www.unpkg.com
* https://esm.sh

Below are examples on how to correctly use esm.run to import packages in JavaScript. 

Examples

Below are some common examples of libraries, imported using esm.run. Many more libraries are available for use in Quadratic and you can use the JS CDN of your choice. Below is how to use esm.run, which we recommend as a top option.

Charting 

Chart.js is the only charting library in JavaScript supported in Quadratic. 

\`\`\`javascript
import Chart from 'https://esm.run/chart.js/auto';
\`\`\`

Analytics

D3.js is a common analytics library for JavaScript.

\`\`\`javascript
import * as d3 from 'https://esm.run/d3';

let my_data = [1,2,3]
let sum = d3.sum(my_data)
return sum
\`\`\`

Brain.js is a Machine Learning library that works in Quadratic

\`\`\`javascript
import * as brain from 'https://esm.run/brain.js';

// provide optional config object (or undefined). Defaults shown.
const config = {
  binaryThresh: 0.5,
  hiddenLayers: [3], // array of ints for the sizes of the hidden layers in the network
  activation: 'sigmoid', // supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
  leakyReluAlpha: 0.01, // supported for activation type 'leaky-relu'
};

// create a simple feed-forward neural network with backpropagation
const net = new brain.NeuralNetwork(config);

await net.train([
  { input: [0, 0], output: [0] },
  { input: [0, 1], output: [1] },
  { input: [1, 0], output: [1] },
  { input: [1, 1], output: [0] },
]);

const output = net.run([1, 0]); // [0.987]

return output[0]
\`\`\`
`;
