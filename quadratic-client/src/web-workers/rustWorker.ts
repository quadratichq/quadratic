// this file cannot include any imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

export const runPython = (
  transactionId: string,
  python_code: string,
  getCells: (sheetId: string | undefined, rect: any) => string[]
): boolean => {
  return window.startPython(transactionId, python_code, getCells);
};
