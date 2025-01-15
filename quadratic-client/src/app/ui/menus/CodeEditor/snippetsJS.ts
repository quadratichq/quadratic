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

export const SNIPPET_JS_READ = `let my_value = q.cells('A1');
let my_range = q.cells('A1:A10');
return my_range;

// Learn more:
// https://docs.quadratichq.com/javascript/reference-cells`;
export const SNIPPET_JS_RETURN = `let out = [];
for(let i=0; i<10; i++) {
  out.push(i);
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
