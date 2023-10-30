// this file cannot include any imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

export const runPython = (
  python_code: string,
  getCells: (sheetId: string | undefined, rect: any) => string[]
): boolean => {
  return window.startPython(python_code, getCells);
};
