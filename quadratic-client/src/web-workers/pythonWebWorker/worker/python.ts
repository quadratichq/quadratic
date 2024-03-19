declare var self: WorkerGlobalScope & typeof globalThis & {};

let pyodide: any | undefined;

class Python {
  constructor() {
    try {
      self.importScripts('/pyodide/pyodide.js');
    } catch (e) {
      // do nothing, we're in a test
    }
  }

  async init() {
    pythonClient.postMessage({ type: 'not-loaded' } as PythonMessage);
  }
}

export const python = new Python();
