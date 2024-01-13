// this file cannot include any imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats

declare global {
  interface Window {
    runPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
    addTransaction: (transactionId: string, operations: string) => void;
    sendTransaction: (transactionId: string, operations: string) => void;
  }
}

export const runPython = (transactionId: string, x: number, y: number, sheetId: string, code: string): void => {
  return window.runPython(transactionId, x, y, sheetId, code);
};

export const addUnsentTransaction = (transactionId: string, operations: string) => {
  return window.addTransaction(transactionId, operations);
};

export const sendTransaction = (transactionId: string, operations: string) => {
  return window.sendTransaction(transactionId, operations);
};
