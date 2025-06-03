export const JavascriptDocs = `# Javascript Docs

## Referencing tables (and named outputs)

\`\`\`javascript
// Reference full table 
let x = q.cells("Table_name")

// Single table column 
let x = q.cells("Table_name[column_name]")

// Table headers
let x = q.cells("Table_name[#HEADERS]")

// Range of columns in a table
let x = q.cells("Table_name[[Column_name]:[Column_name]]")
\`\`\`

## Referencing individual cells

\`\`\`javascript
// single value
let x = q.cells('A1')

// return statement gets returned in JavaScript 
return x;
\`\`\`

## Referencing a range of cells

To reference a range of cells, use the global function \`q.cells\`. This returns an array.

\`\`\`javascript
let x = q.cells('A1:A5') // Returns a 1x5 array spanning from A1 to A5
\`\`\`

## Referencing another sheet

\`\`\`javascript
// Use the sheet name as an argument for referencing range of cells 
let x = q.cells("'Sheet_name_here'!A1:C9")

// For individual cell reference 
let x = q.cells("'Sheet_name_here'!A1")
\`\`\`

## Return data to the sheet

\`\`\`javascript
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

## Charts

Chart.js is the only JavaScript charting library supported. 

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

## API Requests

How to make API requests in JavaScript.

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

## Packages

Packages in Javascript are supported using ESM. You can use a third-party JS CDN to load third-party packages. Some possible CDNs include: 

* We recommend using esm.run from https://www.jsdelivr.com/esm
* https://www.unpkg.com
* https://esm.sh

Below are examples on how to correctly use esm.run to import packages in JavaScript. 

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

## File imports and exports
JavaScript can not be used to import files like .xlsx or .csv. Users should import those files directly to Quadratic by drag and dropping them directly into the sheet. They can then be read into JavaScript with q.cells(). JavaScript can not be used to import files (.xlsx, .csv, .pqt, etc).

JavaScript can also not be used to export/download data as various file types. To download data from Quadratic highlight the data you'd like to download, right click, and select the "Download as CSV" button.
`;
