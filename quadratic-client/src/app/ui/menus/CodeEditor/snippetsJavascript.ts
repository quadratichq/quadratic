const snippets = [
  {
    label: 'Read data from the sheet',
    keywords: 'reference cells',
    code: `// Reference a single value from the sheet; replace x,y with coordinates
let data = await cell(x, y);

// Or reference a range of cells (returns an array), replace x's and y's with coordinates
let data = await cells((x1, y1), (x2, y2))

// Reference cell or range of cells in another sheet
let data = await cells((x1, y1), (x2, y2), sheet_name)`,
  },
  {
    label: 'Return data to the sheet',
    keywords: 'return value',
    code: `// displays vertically - 1x4
let x = [1,2,3,4]

// displays horizontally - 4x1
let y = [[1,2,3,4]]

// 4x2
let z = [[1,2,3,4],[1,2,3,4]]

return x;`,
  },
  {
    label: 'Make a GET request',
    keywords: 'fetch data api network json',
    code: `// API for get requests
let res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
let json = await res.json();

console.log(json);

let as = [Object.keys(json), Object.values(json)]

return as;`,
  },
  {
    label: 'Make a relative reference',
    keywords: 'relative reference position cell',
    code: `// c is the cell one cell to the left of the current cell, use either rel_cell or rc
d = rc(-1, 0);

// above for one cell to the left is equivalent to the following
let cellPos = await pos();
let data = getCell(cellPos['x'] - 1, cellPos['y']);

// one cell left
d = rc(-1, 0);
// one cell up
d = rc(0, -1);
// one cell right
d = rc(1, 0);
// one cell down
d = rc(0, 1);
// five cells left, five cells down
d = rc(-5, 5);

return d;`,
  },
  {
    label: 'Create a line chart',
    keywords: 'chart',
    code: `import Chart from 'https://esm.run/chart.js/auto';

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
return canvas;`,
  },
  {
    label: 'Create a bar chart',
    keywords: 'bar chart',
    code: `import Chart from 'https://esm.run/chart.js/auto';

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
return canvas;`,
  },
  {
    label: 'Import a 3rd-party library',
    keywords: 'esm imports',
    code: `// supports esm imports, mileage may vary on what is possible
import Chart from 'https://esm.run/chart.js/auto';`,
  },
];

export default snippets;
