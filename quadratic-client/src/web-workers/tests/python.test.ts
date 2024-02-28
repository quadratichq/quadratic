import { beforeAll, describe, expect, test } from 'vitest';

const { loadPyodide } = require('pyodide');

export {};

let pyodide: any | undefined;

beforeAll(async () => {
  pyodide = await loadPyodide();
  // const python_code = await (await fetch(define_run_python)).text();
  // await pyodide.registerJsModule('getCellsDB', getCellsDB);
  // await pyodide.loadPackage(['numpy', 'pandas', 'micropip']);
});

describe('Python/Pyodide', () => {
  test('can perform a simple calculation', async () => {
    const result = await pyodide.runPython(`
    x = cell(0, 0)
    x
  `);
    console.log(result);
    expect(result).toBe(5);
  });
});
