export const SNIPPET_JS_API = `let res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
let json = await res.json();

console.log(json);

let data = [Object.keys(json), Object.values(json)];
return data;

// Learn more:
// https://docs.quadratichq.com/javascript/api-requests`;

export const SNIPPET_JS_PACKAGE = `import { faker } from "https://esm.run/@faker-js/faker";

let name = faker.person.fullName();
return name;

// Learn more:
// https://docs.quadratichq.com/javascript/packages`;

export const SNIPPET_JS_CHART = `import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

// create data
let data = [['Africa', 'Asia', 'Europe', 'Latin America', 'North America'],[2478, 5267, 734, 784, 433]];

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
return canvas;`;

export const SNIPPET_JS_READ = `let my_value = cell(0, 0);

// Learn more:
// https://docs.quadratichq.com/javascript/reference-cells`;
export const SNIPPET_JS_RETURN = `let out = [];
for(let i=0; i<50; i++) {
  out++;
}
return out; // Use \`return\` to return to the sheet

// Learn more:
// https://docs.quadratichq.com/javascript/return-data-to-the-sheet`;

export const snippetsJS = [
  {
    label: 'Read data from the sheet',
    keywords: 'reference cells',
    code: SNIPPET_JS_READ,
  },
  {
    label: 'Return data to the sheet',
    keywords: 'return value',
    code: SNIPPET_JS_RETURN,
  },
  {
    label: 'Make a GET request',
    keywords: 'fetch data api network json',
    code: SNIPPET_JS_API,
  },
  {
    label: 'Make a relative reference',
    keywords: 'relative reference position cell',
    code: `// c is the cell one cell to the left of the current cell, use either rel_cell or rc
let d = rc(-1, 0);

// above for one cell to the left is equivalent to the following
let cellPos = pos();
let data = cell(cellPos['x'] - 1, cellPos['y']);

// one cell left
let d_left = rc(-1, 0);
// one cell up
let d_up = rc(0, -1);
// one cell right
let d_right = rc(1, 0);
// one cell down
let d_down = rc(0, 1);
// five cells left, five cells down
let d_left_down = rc(-5, 5);

return d_left_down;`,
  },
  {
    label: 'Create a line chart',
    keywords: 'chart',
    code: `import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

// create data
let data = [['1999', '2000', '2001', '2002', '2003'],[2478, 5267, 734, 784, 433]];

// print data to console
console.log(data);

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
return canvas;`,
  },
  {
    label: 'Create a bar chart',
    keywords: 'bar chart',
    code: SNIPPET_JS_CHART,
  },
  {
    label: 'Import a 3rd-party module',
    keywords: 'esm imports',
    code: SNIPPET_JS_PACKAGE,
  },
];
