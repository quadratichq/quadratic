import './python';
import { pythonClient } from './pythonClient';

pythonClient.start();

/*

self.onmessage = async (e: MessageEvent<PythonMessage>) => {
  const event = e.data;

  if (event.type === 'get-cells') {
    if (event.cells && getCellsMessages) {
      getCellsMessages(event.cells);
    }
  } else if (event.type === 'inspect') {
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    } else {
      if (event.python) {
        const output = await inspectPython(event.python, pyodide);

        return self.postMessage({
          type: 'inspect-results',
          results: output,
          python: event.python,
        });
      }
    }
  } else if (event.type === 'execute') {
    // make sure loading is done
    if (!pyodide) {
      self.postMessage({ type: 'not-loaded' } as PythonMessage);
    } else {
      // auto load packages
      await pyodide.loadPackagesFromImports(event.python);

      let output, results, inspection_results;

      try {
        output = await pyodide.globals.get('run_python')(event.python, event.pos);
        results = Object.fromEntries(output.toJs());
        inspection_results = await inspectPython(event.python || '', pyodide);

        return self.postMessage({
          type: 'results',
          results: {
            ...results,
            ...inspection_results,
          },
          python_code: event.python,
        });
      } catch (e) {
        // gracefully recover from deserialization errors
        console.warn(e);
        const error_results = {
          ...results,
          output_value: null,
          output_size: null,
          array_output: [],
          input_python_stack_trace: String(e),
          std_err: String(e),
          success: false,
        };
        return self.postMessage({
          type: 'results',
          results: error_results,
          python_code: event.python,
        });
      } finally {
        // destroy the output as it can cause memory leaks
        if (output) output.destroy();
      }
    }
  }
};

async function inspectPython(
  pythonCode: string,
  pyodide: any = undefined
): Promise<InspectPythonReturnType | undefined> {
  if (!pyodide) {
    self.postMessage({ type: 'not-loaded' } as PythonMessage);
  } else {
    const output = await pyodide.globals.get('inspect_python')(pythonCode);

    if (output === undefined) {
      return undefined;
    }

    return Object.fromEntries(output.toJs()) as InspectPythonReturnType;
  }
}

pythonWebWorker();

*/
