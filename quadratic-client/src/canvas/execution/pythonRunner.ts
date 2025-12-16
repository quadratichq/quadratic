/**
 * Lightweight Pyodide runner for Canvas code cells.
 * This is a simplified version that runs Python code with access to inputs via q.get().
 */

import type { CodeExecutionResult } from '@/canvas/types';
import { loadPyodide as loadPyodideLib, type PyodideInterface } from 'pyodide';

// Input values map: name -> value
export type InputValues = Map<string, string | number | boolean | null | string[][]>;

// Singleton Pyodide instance
let pyodideInstance: PyodideInterface | null = null;
let pyodideLoading: Promise<PyodideInterface> | null = null;

/**
 * Load Pyodide (lazy initialization)
 */
async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodideLoading) {
    return pyodideLoading;
  }

  pyodideLoading = (async () => {
    console.log('[Canvas Python] Loading Pyodide...');

    // Load Pyodide - uses the same local pyodide as the main app
    const pyodide = await loadPyodideLib({
      indexURL: '/pyodide/',
    });

    // Pre-load commonly used packages
    await pyodide.loadPackage(['pandas', 'numpy']);

    console.log('[Canvas Python] Pyodide loaded successfully');
    pyodideInstance = pyodide;
    return pyodideInstance;
  })();

  return pyodideLoading;
}

/**
 * Execute Python code with the given input values.
 * The code can use q.get("name") to access input values.
 */
export async function executePython(code: string, inputValues: InputValues): Promise<CodeExecutionResult> {
  const startTime = Date.now();
  let stdout = '';

  try {
    const pyodide = await loadPyodide();

    // Create the q object for accessing inputs
    const qGetCode = createQGetCode(inputValues);

    // Capture stdout
    await pyodide.runPythonAsync(`
import sys
from io import StringIO

# Redirect stdout
_stdout_capture = StringIO()
_original_stdout = sys.stdout
sys.stdout = _stdout_capture
`);

    // Set up the q.get function
    await pyodide.runPythonAsync(qGetCode);

    // Auto-load packages from imports
    try {
      await pyodide.loadPackagesFromImports(code, {
        messageCallback: () => 0,
        errorCallback: (e) => console.warn('[Canvas Python] Package load warning:', e),
      });
    } catch (e) {
      console.warn('[Canvas Python] Package load error (continuing):', e);
    }

    // Execute the user code and get the result
    // Use a wrapper that captures the last expression value
    const resultCode = `
import re as __re

# Store the code
__user_code = ${JSON.stringify(code)}

# Execute code and capture last expression
__result = None

# Try to find and evaluate the last expression
# First, execute all the code
exec(__user_code)

# Now try to capture the last expression by evaluating it
# We'll try different strategies based on the code structure
__code_lines = [line.rstrip() for line in __user_code.split('\\n') if line.strip() and not line.strip().startswith('#')]

if __code_lines:
    # Strategy 1: If last line is a simple expression, evaluate it
    __last_line = __code_lines[-1].strip()
    
    # Check if last line is just closing braces (like '})' from DataFrame)
    __is_closing_only = bool(__re.match(r'^[})\\]]+$', __last_line.strip())) if __last_line else False
    
    if __is_closing_only:
        # Last line is closing braces - find the start of this expression
        # Look backwards for opening of function call or dict/list
        __expr_start_idx = len(__code_lines) - 1
        __open_count = 0
        for i in range(len(__code_lines) - 1, -1, -1):
            line = __code_lines[i]
            __open_count += line.count('(') + line.count('[') + line.count('{')
            __open_count -= line.count(')') + line.count(']') + line.count('}')
            if __open_count == 0 and i < len(__code_lines) - 1:
                __expr_start_idx = i
                break
        
        # Try to evaluate the expression from expr_start_idx to end
        try:
            __expr_code = '\\n'.join(__code_lines[__expr_start_idx:])
            import ast
            # Verify it's a valid expression
            ast.parse(__expr_code, mode='eval')
            __result = eval(__expr_code)
        except:
            # Couldn't parse as expression, result stays None
            pass
    else:
        # Last line might be a complete expression
        try:
            import ast
            ast.parse(__last_line, mode='eval')
            # Valid expression - evaluate it
            __result = eval(__last_line)
        except:
            # Not a simple expression, result stays None
            pass

# Get stdout
sys.stdout = _original_stdout
_captured_output = _stdout_capture.getvalue()

__result
`;

    const result = await pyodide.runPythonAsync(resultCode);

    // Get captured stdout
    const capturedOutput = pyodide.globals.get('_captured_output');
    stdout = capturedOutput ? String(capturedOutput) : '';

    // Process the result
    return processResult(result, stdout, startTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Enhanced console logging
    console.error('[Canvas Python] Execution error:', {
      error: errorMessage,
      stack: errorStack,
      code: code.substring(0, 200), // First 200 chars of code
      stdout,
    });

    return {
      type: 'error',
      error: errorMessage,
      stdout,
      executedAt: startTime,
    };
  }
}

/**
 * Create Python code that defines the q.get() function with the input values.
 */
function createQGetCode(inputValues: InputValues): string {
  // Convert input values to Python dict literal
  const entries: string[] = [];

  inputValues.forEach((value, name) => {
    if (value === null) {
      entries.push(`"${name}": None`);
    } else if (typeof value === 'string') {
      // Try to parse as number
      const num = parseFloat(value);
      if (!isNaN(num) && isFinite(num)) {
        entries.push(`"${name}": ${num}`);
      } else {
        // Escape the string for Python
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        entries.push(`"${name}": "${escaped}"`);
      }
    } else if (typeof value === 'number') {
      entries.push(`"${name}": ${value}`);
    } else if (typeof value === 'boolean') {
      entries.push(`"${name}": ${value ? 'True' : 'False'}`);
    } else if (Array.isArray(value)) {
      // It's a 2D array (data table) - convert to DataFrame
      const pyList = JSON.stringify(value);
      entries.push(`"${name}": __create_df(${pyList})`);
    }
  });

  return `
import pandas as pd

# Helper to create DataFrame from 2D array
def __create_df(data):
    if not data or len(data) == 0:
        return pd.DataFrame()
    # First row is headers
    if len(data) == 1:
        return pd.DataFrame(columns=data[0])
    return pd.DataFrame(data[1:], columns=data[0])

# Input values
_input_values = {${entries.join(', ')}}

# The q object for accessing inputs
class q:
    @staticmethod
    def get(name):
        if name not in _input_values:
            raise ValueError(f"Input '{name}' not found. Available inputs: {list(_input_values.keys())}")
        return _input_values[name]
`;
}

/**
 * Process the Python result and convert to our result format.
 */
function processResult(result: unknown, stdout: string, executedAt: number): CodeExecutionResult {
  // Handle None/undefined
  if (result === undefined || result === null) {
    if (stdout) {
      return {
        type: 'value',
        value: stdout.trim(),
        stdout,
        executedAt,
      };
    }
    return {
      type: 'value',
      value: null,
      stdout,
      executedAt,
    };
  }

  // Check if it's a pandas DataFrame (has toJs method and shape attribute)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pyResult = result as any;

  if (pyResult.type === 'DataFrame' || (pyResult.toJs && pyResult.shape)) {
    try {
      // Get DataFrame as list of lists with headers
      const columns = pyResult.columns.tolist().toJs() as string[];
      const values = pyResult.values.tolist().toJs() as unknown[][];

      return {
        type: 'table',
        columns,
        rows: values.map((row) => row.map((cell) => cell as string | number | boolean | null)),
        stdout,
        executedAt,
      };
    } catch (e) {
      console.warn('[Canvas Python] DataFrame conversion error:', e);
    }
  }

  // Check if it's HTML (plotly figure or raw HTML)
  if (typeof pyResult === 'string' && pyResult.includes('<')) {
    return {
      type: 'html',
      htmlContent: pyResult,
      stdout,
      executedAt,
    };
  }

  // Check if it has a _repr_html_ method (plotly figures, etc.)
  if (pyResult._repr_html_) {
    try {
      const html = pyResult._repr_html_();
      return {
        type: 'chart',
        htmlContent: typeof html === 'string' ? html : String(html),
        stdout,
        executedAt,
      };
    } catch (e) {
      console.warn('[Canvas Python] HTML repr error:', e);
    }
  }

  // Check if it has to_html method (plotly figures)
  if (pyResult.to_html) {
    try {
      const html = pyResult.to_html({ include_plotlyjs: 'cdn' });
      return {
        type: 'chart',
        htmlContent: typeof html === 'string' ? html : String(html),
        stdout,
        executedAt,
      };
    } catch (e) {
      console.warn('[Canvas Python] to_html error:', e);
    }
  }

  // Convert to JS value if it's a Python object
  let jsValue = result;
  if (pyResult.toJs) {
    try {
      jsValue = pyResult.toJs();
    } catch (e) {
      // Keep original value
    }
  }

  // Handle arrays (could be a table)
  if (Array.isArray(jsValue) && jsValue.length > 0 && Array.isArray(jsValue[0])) {
    // 2D array - treat as table
    const firstRow = jsValue[0] as unknown[];
    return {
      type: 'table',
      columns: firstRow.map((_, i) => `Column ${i + 1}`),
      rows: jsValue.map((row) => (row as unknown[]).map((cell) => cell as string | number | boolean | null)),
      stdout,
      executedAt,
    };
  }

  // Simple value
  return {
    type: 'value',
    value: typeof jsValue === 'object' ? JSON.stringify(jsValue) : (jsValue as string | number | boolean | null),
    stdout,
    executedAt,
  };
}

/**
 * Check if Pyodide is loaded
 */
export function isPyodideLoaded(): boolean {
  return pyodideInstance !== null;
}

/**
 * Preload Pyodide (call early to reduce first execution delay)
 */
export function preloadPyodide(): void {
  loadPyodide().catch((e) => console.warn('[Canvas Python] Preload error:', e));
}
