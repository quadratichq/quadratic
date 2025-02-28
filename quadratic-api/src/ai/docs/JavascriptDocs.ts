export const JavascriptDocs = `# Javascript Docs

With Javascript in Quadratic, the world's most popular programming language meets the world's most popular tool for working with data - spreadsheets. 

# Reference cells from JavaScript

In Quadratic, reference individual cells from Javascript for single values or reference a range of cells for multiple values. 

## Referencing individual cells

To reference an individual cell, use the global function \`q.cells\` which returns the cell value.

\`\`\`javascript
// NOTE: uses the same A1 notation as Formulas
// Following function reads the value in cell A1 and places in variable x 
let x = q.cells('A1')

# return statement gets returned to the sheet
return x;
\`\`\`

## Referencing a range of cells

To reference a range of cells, use the global function \`q.cells\`. This returns an array.

\`\`\`javascript
let let x = q.cells('A1:A5') // Returns a 1x5 array spanning from A1 to A5

let let x = q.cells('A1:C7') // Returns a 3x7 array of arrays spanning from A1 to C7

let let x = q.cells('A') // Returns all values in column A into a single-column DataFrame

let let x = q.cells('A:C') // Returns all values in columns A to C into a three-column DataFrame

let let x = q.cells('A5:A') // Returns all values in column A starting at A5 and going down

let let x = q.cells('A5:C') // Returns all values in column A to C, starting at A5 and going down
\`\`\`

## Referencing another sheet

To reference another sheet's cells or range of cells use the following: 

\`\`\`javascript
// Use the sheet name as an argument for referencing range of cells 
let x = q.cells("'Sheet_name_here'!A1:C9")

// For individual cell reference 
let x = q.cells("'Sheet_name_here'!A1")
\`\`\`

## Column references

To reference all the data in a column or set of columns without defining the range, use the following syntax. 

Column references span from row 1 to wherever the content in that column ends. 

\`\`\`javascript
// references all values in the column from row 1 to the end of the content 
let x = q.cells('A') // returns all the data in the column starting from row 1 to end of data 

let x = q.cells('A:D') // returns all the data in columns A to D starting from row 1 to end of data in longest column

let x = q.cells('A5:A') // returns all values from A5 to the end of the content in column A 

let x = q.cells('A5:C') // returns all values from A5 to end of content in C

let x = q.cells("'Sheet2'!A:C") // same rules to reference in other sheets apply
\`\`\`

## Relative vs absolute references

By default when you copy paste a reference it will update the row reference unless you use $ notation in your references. 

// Copy pasting this one row down will change reference to A2
let x = q.cells('A1')

// Copy pasting this one row down will keep reference as A1
let x = q.cells('A$1')

// Example using ranges - row references will not change
let x = q.cells('A$1:B$20)

// Only A reference will change when copied down
let x = q.cells('A1:B$20')

# Return data to the sheet

Single values, arrays, and charts are the Javascript types that can be returned to the sheet. Any data can be structured as an array and returned to the sheet. 

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

Perform API requests using the standard Javascript approach of Fetch. javascript

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

If you ever get stuck with Javascript code (especially requests) that doesn't seem to be working but is showing no error, you may be missing an \`await\` somewhere that it is needed. 

# Charts/visualizations

Charts are supported in Javascript using charts.js. No other libraries are currently supported. 

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

Packages in Javascript are supported using ESM. You can use a third-party JS CDN to load third-party packages. Some possible CDNs include: 

* We recommend using esm.run from https://www.jsdelivr.com/esm
* https://www.unpkg.com
* https://esm.sh

Below are examples on how to correctly use esm.run to import packages in JavaScript. 

Examples

Below are some common examples of libraries, imported using esm.run. Many more libraries are available for use in Quadratic and you can use the JS CDN of your choice. Below is how to use esm.run, which we recommend as a top option.

Charting 

Chart.js is the only charting library in Javascript supported in Quadratic. 

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
