//! Converts the Javascript code before sending it to the worker. This includes
//! using esbuild to find syntax errors, promoting import statements to the top
//! of the file (this is to ensure they are not placed inside of the async
//! anonymous function that allows await at the top level), and adding line
//! numbers to all return statements via a caught thrown error (the only way to
//! get line numbers in JS).

// todo: can remove the line number vars as we are no longer using them.

import { getJavascriptFetchOverride } from '@/app/web-workers/javascriptWebWorker/worker/javascript/getJavascriptFetchOverride';
import { getJavascriptXHROverride } from '@/app/web-workers/javascriptWebWorker/worker/javascript/getJavascriptXHROverride';
import { LINE_NUMBER_VAR } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { addAwaitToCellCalls } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascriptTransformAsync';
import { javascriptLibrary } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generateJavascriptForRunner';
import { COMMUNITY_A1_FILE_UPDATE_URL } from '@/shared/constants/urls';
import * as esbuild from 'esbuild-wasm';
export interface JavascriptTransformedCode {
  imports: string;
  code: string;
}

export async function javascriptFindSyntaxError(transformed: {
  code: string;
  imports: string;
}): Promise<{ text: string; lineNumber?: number } | false> {
  try {
    await esbuild.transform(`${transformed.imports};(async() => {;${transformed.code};\n})()`, { loader: 'js' });
    return false;
  } catch (e: any) {
    const error = e as esbuild.TransformFailure;
    if (error.errors.length) {
      const location = error.errors[0].location
        ? ` at line ${error.errors[0].location.line}:${error.errors[0].location.column} `
        : '';
      return { text: error.errors[0].text + location, lineNumber: error.errors[0].location?.line };
    }
    return { text: error.message };
  }
}

// Uses a thrown error to find the line number of the return statement.
export function javascriptAddLineNumberVars(transform: JavascriptTransformedCode): string {
  const list = transform.code.split('\n');
  let s = '';
  for (let i = 0; i < list.length; i++) {
    if (list[i].includes('return')) {
      s += `try { throw new Error() } catch (e) { const stackLines = e.stack.split("\\n"); let lineNumber; for (let i = 0; i < stackLines.length; i++) { const match = stackLines[i].match(/:(\\d+):(\\d+)/); if (match) { lineNumber = match[1]; break; } } if (lineNumber) { ${LINE_NUMBER_VAR} = lineNumber; } }`;
    }
    s += list[i] + '\n';
  }
  return s;
}

// Separates imports from the code so it can be placed above anonymous async
// function. This is necessary because JS does not support top-level await (yet).
export function transformCode(code: string): JavascriptTransformedCode {
  // from https://stackoverflow.com/a/73265022/1955997
  const regExp =
    // eslint-disable-next-line no-useless-escape
    /^import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/gm;
  const imports = (code.match(regExp)?.join('\n') || '') + ';';
  let transformedCode = code.replace(regExp, '');
  return { code: transformedCode, imports };
}

/**
 * Async cells override for when SharedArrayBuffer is not available.
 * This code is injected into the runner to override q.cells with a Promise-based version.
 */
const asyncCellsOverride = `
const __pendingCellRequests = new Map();
let __nextCellRequestId = 0;

// Override q.cells with async version
const __originalQCells = q.cells.bind(q);
q.cells = function(a1) {
  if (typeof a1 !== 'string') {
    throw new Error('q.cell requires at least 1 argument, received q.cell(' + a1 + ')');
  }
  return new Promise((resolve, reject) => {
    const requestId = __nextCellRequestId++;
    __pendingCellRequests.set(requestId, { resolve, reject });
    self.postMessage({ type: 'getCellsA1Async', requestId, a1 });
  });
};

// Listen for async cell responses
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'getCellsA1AsyncResponse') {
    const pending = __pendingCellRequests.get(e.data.requestId);
    if (pending) {
      __pendingCellRequests.delete(e.data.requestId);
      if (e.data.error) {
        pending.reject(new Error(e.data.error));
      } else {
        try {
          const results = JSON.parse(e.data.resultsStringified);
          if (!results || !results.values || results.error) {
            pending.reject(new Error(results?.error?.core_error ?? 'Failed to get cells'));
            return;
          }
          const startY = results.values.y;
          const startX = results.values.x;
          const height = results.values.h;
          const width = results.values.w;
          const cells = Array(height).fill(null).map(() => Array(width).fill(undefined));
          for (const cell of results.values.cells) {
            const typed = cell ? convertType(cell) : undefined;
            cells[cell.y - startY][cell.x - startX] = typed === null ? undefined : typed;
          }
          if (cells.length === 1 && cells[0].length === 1 && !results.values.one_dimensional) {
            pending.resolve(cells[0][0]);
          } else if (!results.values.two_dimensional) {
            if (cells.every(row => row.length === 1)) {
              pending.resolve(cells.map(row => row[0]));
            } else if (cells.length === 1) {
              pending.resolve(cells[0]);
            } else {
              pending.resolve(cells);
            }
          } else {
            pending.resolve(cells);
          }
        } catch (err) {
          pending.reject(err);
        }
      }
    }
  }
});
`;

// Prepares code to be sent to the worker for execution. This includes moving
// moving import statements outside of async wrapper; adding line number
// variables (although if we get an error, we'll try it without the variables);
// and adding the quadratic libraries and console tracking code.
export function prepareJavascriptCode(
  transform: JavascriptTransformedCode,
  x: number,
  y: number,
  withLineNumbers: boolean,
  proxyUrl: string,
  jwt: string,
  hasSharedArrayBuffer: boolean = true
): string {
  let userCode = withLineNumbers ? javascriptAddLineNumberVars(transform) : transform.code;

  // When SAB is not available, transform user code to add await before q.cells() calls
  if (!hasSharedArrayBuffer) {
    userCode = addAwaitToCellCalls(userCode);
  }

  const javascriptXHROverride = getJavascriptXHROverride(proxyUrl, jwt);
  const javascriptFetchOverride = getJavascriptFetchOverride(proxyUrl, jwt);
  let replacedJavascriptLibrary = javascriptLibrary;
  replacedJavascriptLibrary = replacedJavascriptLibrary.replace('{x:0,y:0}', `{x:${x},y:${y}}`); // replace the pos() with the correct x,y coordinates
  replacedJavascriptLibrary = replacedJavascriptLibrary.replace(
    '{COMMUNITY_A1_FILE_UPDATE_URL}',
    COMMUNITY_A1_FILE_UPDATE_URL
  ); // replace the COMMUNITY_A1_FILE_UPDATE_URL with the correct url

  // When SAB is not available, inject async cells override after the library
  const asyncOverride = hasSharedArrayBuffer ? '' : asyncCellsOverride;

  const compiledCode =
    javascriptXHROverride +
    javascriptFetchOverride +
    transform.imports +
    (withLineNumbers ? `let ${LINE_NUMBER_VAR} = 0;` : '') +
    replacedJavascriptLibrary +
    asyncOverride +
    '(async() => {try{' +
    'let results = await (async () => {' +
    userCode +
    '\n })();' +
    'let chartPixelOutput = undefined;' +
    'if (results instanceof OffscreenCanvas) { chartPixelOutput = [results.width, results.height]; results = await results.convertToBlob(); }' +
    `self.postMessage({ type: "results", results, console: javascriptConsole.output()${
      withLineNumbers ? `, lineNumber: Math.max(${LINE_NUMBER_VAR} - 1, 0)` : ''
    }, chartPixelOutput });` +
    `} catch (e) { const error = e.message; const stack = e.stack; self.postMessage({ type: "error", error, stack, console: javascriptConsole.output() }); }` +
    '})();';

  return compiledCode;
}
