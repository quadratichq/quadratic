export const getPyodide = (pyodide: any) => {
  let pyodide_obj = pyodide;

  if (pyodide_obj === undefined) {
    if (typeof window !== 'undefined') {
      // Browser environment, get pyodide from window
      pyodide_obj = window.pyodide;
    }
  }

  if (pyodide_obj === undefined) {
    throw new Error('Pyodide not found');
  }
  return pyodide_obj;
};
