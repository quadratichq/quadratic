export const JavascriptDocs = `# Javascript Docs

## Referencing tables

\`\`\`javascript
let x = q.cells("Table_name")  // Full table
let x = q.cells("Table_name[column_name]")  // Single column
let x = q.cells("Table_name[#HEADERS]")  // Headers only
let x = q.cells("Table_name[[Col1]:[Col2]]")  // Range of columns
\`\`\`

## Referencing cells and ranges

\`\`\`javascript
let x = q.cells('A1')  // Single cell
let x = q.cells('A1:A5')  // Range as array
let x = q.cells("'Sheet_name'!A1:C9")  // Another sheet
\`\`\`

## Return data to the sheet

Use \`return\` statement:
\`\`\`javascript
let data = 5;
return data;
\`\`\`

\`\`\`javascript
let data = [[1,2,3],[4,5,6]];  // 2D array
return data;
\`\`\`

## Charts

Chart.js is the only supported charting library:
\`\`\`javascript
import Chart from 'https://esm.run/chart.js/auto';

let canvas = new OffscreenCanvas(800, 450);
let context = canvas.getContext('2d');

new Chart(canvas, {
    type: 'bar',
    data: {
        labels: ['A', 'B', 'C'],
        datasets: [{ label: "Values", data: [10, 20, 30] }]
    }
});

return canvas;
\`\`\`

## API Requests

\`\`\`javascript
let res = await fetch("https://api.example.com/data");
let json = await res.json();
return [Object.keys(json), Object.values(json)];
\`\`\`

## Packages

Use ESM imports from CDNs (recommended: esm.run):
\`\`\`javascript
import Chart from 'https://esm.run/chart.js/auto';
import * as d3 from 'https://esm.run/d3';
\`\`\`

## File imports/exports

JavaScript cannot import files (.xlsx, .csv). Drag and drop files directly into the sheet, then read with \`q.cells()\`.

To export: highlight data > right-click > "Download as CSV"
`;
