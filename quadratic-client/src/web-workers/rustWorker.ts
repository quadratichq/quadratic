// this file cannot include any imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

export const runPython = (transactionId: string, x: number, y: number, sheetId: string, code: string): boolean => {
  return window.runPython(transactionId, x, y, sheetId, code);
};
