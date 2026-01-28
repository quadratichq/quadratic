import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { JsCellsA1Response, JsCellValueResult, JsCodeResult } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type { CorePythonRun } from '@/app/web-workers/pythonWebWorker/pythonCoreMessages';
import type { InspectPython, PythonError, PythonSuccess } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { pythonClient } from '@/app/web-workers/pythonWebWorker/worker/pythonClient';
import { pythonCore } from '@/app/web-workers/pythonWebWorker/worker/pythonCore';
import type { PyodideInterface } from 'pyodide';
import { loadPyodide } from 'pyodide';

const IS_TEST = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Default chart pixel dimensions (must match DEFAULT_HTML_WIDTH/HEIGHT in quadratic-core)
const DEFAULT_CHART_WIDTH = 600;
const DEFAULT_CHART_HEIGHT = 460;

// Extract chart dimensions from Plotly HTML
function extractChartDimensions(html: string): { width: number; height: number } {
  // Look for width/height in the main layout section (after "layout": or near end of Plotly.newPlot)
  // Match "width":NUMBER,"height":NUMBER or "height":NUMBER nearby "width":NUMBER
  // Only match integers >= 100 to avoid small template values like "width":0.5

  // Try to find all width/height pairs that look like chart dimensions (integers >= 100)
  const widthMatches = html.matchAll(/"width"\s*:\s*(\d{3,4})(?![.\d])/g);
  const heightMatches = html.matchAll(/"height"\s*:\s*(\d{3,4})(?![.\d])/g);

  const widths = Array.from(widthMatches).map((m) => parseInt(m[1], 10));
  const heights = Array.from(heightMatches).map((m) => parseInt(m[1], 10));

  // Use the last valid pair (layout dimensions typically appear last in Plotly HTML)
  if (widths.length > 0 && heights.length > 0) {
    const width = widths[widths.length - 1];
    const height = heights[heights.length - 1];
    if (width >= 100 && width <= 4000 && height >= 100 && height <= 4000) {
      return { width, height };
    }
  }

  return { width: DEFAULT_CHART_WIDTH, height: DEFAULT_CHART_HEIGHT };
}

// eslint-disable-next-line no-restricted-globals
const SELF = self;

function isEmpty(value: JsCellValueResult | string | null | undefined) {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}

class Python {
  private pyodide: PyodideInterface | undefined;
  private awaitingExecution: CodeRun[];
  private state: LanguageState;
  private transactionId?: string;
  private currentJwt?: string;

  constructor() {
    this.awaitingExecution = [];
    this.state = 'loading';
    this.init();
  }

  private getCellsA1 = (a1: string): JsCellsA1Response => {
    if (!this.transactionId) {
      throw new Error('No transactionId in getCellsA1');
    }
    return pythonCore.sendGetCellsA1(this.transactionId, a1);
  };

  private init = async (): Promise<void> => {
    // Store reference to Python instance for use in XHR proxy
    const pythonInstance = this;

    // patch XMLHttpRequest to send requests to the proxy
    SELF['XMLHttpRequest'] = new Proxy(XMLHttpRequest, {
      construct: function (target, args) {
        const xhr = new target();

        xhr.open = new Proxy(xhr.open, {
          apply: function (
            target,
            thisArg,
            args: [
              method: string,
              url: string | URL,
              async: boolean,
              username?: string | null | undefined,
              password?: string | null | undefined,
            ]
          ) {
            Object.defineProperty(xhr, '__url', { value: args[1].toString(), writable: true });
            args[1] = `${pythonClient.env.VITE_QUADRATIC_CONNECTION_URL}/proxy`;
            return target.apply(thisArg, args);
          },
        });

        xhr.setRequestHeader = new Proxy(xhr.setRequestHeader, {
          apply: function (target, thisArg, args: [string, string]) {
            // apply quadratic-authorization header as the only authorization header
            // this is required for authentication with the proxy server
            if (args[0] === 'Quadratic-Authorization') {
              args[0] = 'Authorization';
            } else {
              // apply all headers on the original request prefixed with X-Proxy
              args[0] = `X-Proxy-${args[0]}`;
            }
            return target.apply(thisArg, args);
          },
        });

        xhr.onreadystatechange = function () {
          if (xhr.readyState === XMLHttpRequest.OPENED) {
            // Set auth headers with the current JWT when the connection is opened
            // This must happen synchronously to work with pyodide-http
            const jwt = pythonInstance.currentJwt;
            if (jwt) {
              xhr.setRequestHeader('Quadratic-Authorization', `Bearer ${jwt}`);
              xhr.setRequestHeader('Url', (xhr as any).__url);
            } else {
              console.warn('No JWT available for proxy request');
            }
          }
          // After completion of XHR request
          if (xhr.readyState === 4) {
            if (xhr.status === 401) {
              // Handle unauthorized - JWT may have expired
              console.warn('Proxy request returned 401 - JWT may have expired');
            }
          }
        };

        return xhr;
      },
    });

    this.pyodide = await loadPyodide({
      stdout: () => {},
      indexURL: IS_TEST ? 'public/pyodide' : '/pyodide',
      packages: [
        'micropip',
        'pyodide-http',
        'pandas',
        'requests',
        `${IS_TEST ? 'public' : ''}/quadratic_py-0.1.0-py3-none-any.whl`,
      ],
    });

    this.pyodide.registerJsModule('getCellsA1', this.getCellsA1);

    // patch requests https://github.com/koenvo/pyodide-http
    await this.pyodide.runPythonAsync('import pyodide_http; pyodide_http.patch_all();');

    // disable urllib3 warnings
    await this.pyodide.runPythonAsync(`import requests; requests.packages.urllib3.disable_warnings();`);

    try {
      // make run_python easier to call later
      await this.pyodide.runPythonAsync(`
        from quadratic_py.run_python import run_python
        from quadratic_py.inspect_python import inspect_python
        import sys
        sys.modules['__main__'].run_python = run_python
        sys.modules['__main__'].inspect_python = inspect_python
      `);
    } catch (e: any) {
      pythonClient.sendPythonLoadError(e?.message);
      console.warn(`[Python WebWorker] failed to load`, e);
      this.transactionId = undefined;
      this.state = 'error';
      this.pyodide = undefined;
      return this.init();
    }

    const pythonVersion = await this.pyodide.runPythonAsync('import platform; platform.python_version()');
    const pyodideVersion = this.pyodide.version;

    if (debugFlag('debugWebWorkers'))
      console.log(`[Python] loaded Python v.${pythonVersion} via Pyodide v.${pyodideVersion}`);

    pythonClient.sendInit(pythonVersion);
    this.state = 'ready';
    pythonClient.sendPythonState(this.state);
    return this.next();
  };

  private corePythonRunToCodeRun = (corePythonRun: CorePythonRun): CodeRun => {
    return {
      transactionId: corePythonRun.transactionId,
      sheetPos: { x: corePythonRun.x, y: corePythonRun.y, sheetId: corePythonRun.sheetId },
      code: corePythonRun.code,
      chartPixelWidth: corePythonRun.chartPixelWidth,
      chartPixelHeight: corePythonRun.chartPixelHeight,
    };
  };

  private codeRunToCorePython = (codeRun: CodeRun): CorePythonRun => ({
    type: 'corePythonRun',
    transactionId: codeRun.transactionId,
    x: codeRun.sheetPos.x,
    y: codeRun.sheetPos.y,
    sheetId: codeRun.sheetPos.sheetId,
    code: codeRun.code,
    chartPixelWidth: codeRun.chartPixelWidth,
    chartPixelHeight: codeRun.chartPixelHeight,
  });

  private next = () => {
    if (!this.pyodide) {
      this.state = 'loading';
      pythonClient.sendPythonState(this.state);
      return this.init();
    }

    if (this.state === 'ready' && !this.transactionId && this.awaitingExecution.length > 0) {
      const run = this.awaitingExecution.shift();
      if (run) {
        return this.runPython(this.codeRunToCorePython(run));
      }
    }
  };

  private inspectPython = async (pythonCode: string): Promise<InspectPython | undefined> => {
    if (!this.pyodide) {
      console.warn('Python not loaded');
    } else {
      const output = await this.pyodide.runPythonAsync(`inspect_python(${JSON.stringify(pythonCode)})`);

      if (output === undefined) {
        return undefined;
      }

      return Object.fromEntries(output.toJs()) as InspectPython;
    }
  };

  runPython = async (message: CorePythonRun): Promise<void> => {
    if (!this.pyodide || this.state !== 'ready' || this.transactionId) {
      this.awaitingExecution.push(this.corePythonRunToCodeRun(message));
      // Send state update - Rust handles code running state via coreClientCodeRunningState
      pythonClient.sendPythonState(this.state);
      return;
    }

    this.state = 'running';
    pythonClient.sendPythonState(this.state);

    this.transactionId = message.transactionId;

    // Fetch fresh JWT before execution to handle 5-minute expiration
    try {
      this.currentJwt = (await pythonClient.getJwt()) as string;
    } catch (error) {
      console.error('Failed to get JWT for Python execution:', error);
      // Continue without JWT - requests will fail but code can still run
    }

    // auto load packages
    await this.pyodide.loadPackagesFromImports(message.code, {
      messageCallback: () => 0,
      errorCallback: (e) => console.warn(e),
    });

    let result: any; // result of Python execution
    let pythonRun: any;
    let output: PythonSuccess | PythonError | undefined;
    let inspectionResults: InspectPython | undefined;

    try {
      result = await this.pyodide.runPythonAsync(
        `run_python(${JSON.stringify(message.code)}, (${message.x}, ${message.y}))`
      );
      output = Object.fromEntries(result.toJs()) as PythonSuccess | PythonError;
      inspectionResults = await this.inspectPython(message.code || '');
      let outputType = output?.output_type || '';

      const empty2dArray =
        Array.isArray(output.output_size) && output.output_size[0] === 0 && output.output_size[1] === 0;
      const nothingReturned = (output.output_type === 'NoneType' && isEmpty(output.output)) || empty2dArray;

      if (!output) throw new Error('Expected results to be defined in python.ts');

      if (nothingReturned) {
        output.array_output = undefined;
        output.typed_array_output = undefined;
        output.output = ['', 0];
      } else {
        if (output.array_output && output.array_output.length) {
          if (!Array.isArray(output.array_output[0][0])) {
            output.array_output = output.array_output.map((row: any) => [row]);
          }
        }
      }

      if (output.output_size) {
        outputType = `${output.output_size[0]}x${output.output_size[1]} ${outputType}`;
      }

      pythonRun = {
        ...output,
        ...inspectionResults,
        outputType,
      };
    } catch (e) {
      // gracefully recover from deserialization errors
      console.warn(e);

      pythonRun = output ? output : ({} as PythonError);

      pythonRun = {
        ...pythonRun,
        array_output: [],
        typed_array_output: [],
        success: false,
        std_err: String(e),
        input_python_stack_trace: String(e),
        has_headers: false,
      };
    }

    if (pythonRun.input_python_stack_trace) {
      pythonRun.std_err = pythonRun.input_python_stack_trace;
    }

    let output_array: string[][][] | null = null;
    if (pythonRun.array_output) {
      // A 1d list was provided. We convert it to a 2d array by changing each entry into an array.
      if (!Array.isArray(pythonRun.array_output?.[0]?.[0])) {
        output_array = (pythonRun.array_output as any).map((row: any) => [row]);
      } else {
        output_array = pythonRun.array_output as any as string[][][];
      }
      pythonRun.array_output = [];
    }

    // Capture chart image if output is a Plotly chart
    let chartImage: string | null = null;
    const outputStr = pythonRun.output ? String(pythonRun.output) : '';
    const looksLikePlotly = outputStr.includes('plotly') || outputStr.includes('Plotly');
    const isChart = pythonRun.output_type === 'Chart' || looksLikePlotly;

    if (isChart && pythonRun.output) {
      const outputTuple = pythonRun.output as unknown as [string, number | string];
      let htmlString = outputTuple[0];

      // If the first element isn't a string with HTML, try using the stringified output
      if (!htmlString || typeof htmlString !== 'string' || !htmlString.includes('<html')) {
        if (outputStr.includes('<html')) {
          htmlString = outputStr;
        }
      }

      if (htmlString && typeof htmlString === 'string' && htmlString.includes('<html')) {
        try {
          // Use chart pixel dimensions from core if available, otherwise extract from HTML
          let width: number;
          let height: number;
          if (message.chartPixelWidth && message.chartPixelHeight) {
            width = Math.round(message.chartPixelWidth);
            height = Math.round(message.chartPixelHeight);
            console.log(`[python.ts] Using core dimensions: ${width}x${height}`);
          } else {
            const extracted = extractChartDimensions(htmlString);
            width = extracted.width;
            height = extracted.height;
            console.log(
              `[python.ts] Using extracted dimensions: ${width}x${height} (core had: ${message.chartPixelWidth}x${message.chartPixelHeight})`
            );
          }
          chartImage = await pythonClient.captureChartImage(htmlString, width, height);
        } catch (e) {
          console.error('[python.ts] Failed to capture chart image:', e);
        }
      }
    }

    let codeResult: JsCodeResult | undefined = {
      transaction_id: this.transactionId,
      success: pythonRun.success,
      std_err: pythonRun.std_err,
      std_out: pythonRun.std_out,
      output_value: pythonRun.output ? (pythonRun.output as any as JsCellValueResult) : null,
      output_array: output_array ? (output_array as any as JsCellValueResult[][]) : null,
      line_number: pythonRun.lineno ?? null,
      output_display_type: pythonRun.output_type ?? null,
      chart_pixel_output: null,
      chart_image: chartImage,
      has_headers: !!pythonRun.has_headers,
    };

    result = undefined;
    pythonRun = undefined;
    output = undefined;
    inspectionResults = undefined;

    const uint8Array = toUint8Array(codeResult);
    pythonCore.sendPythonResults(uint8Array.buffer as ArrayBuffer);

    codeResult = undefined;

    this.state = 'ready';
    pythonClient.sendPythonState(this.state);
    this.transactionId = undefined;
    return this.next();
  };
}

export const python = new Python();
