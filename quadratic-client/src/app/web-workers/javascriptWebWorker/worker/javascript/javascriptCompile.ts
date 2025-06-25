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
  jwt: string
): string {
  const code = withLineNumbers ? javascriptAddLineNumberVars(transform) : transform.code;
  const javascriptXHROverride = getJavascriptXHROverride(proxyUrl, jwt);
  const javascriptFetchOverride = getJavascriptFetchOverride(proxyUrl, jwt);
  let replacedJavascriptLibrary = javascriptLibrary;
  replacedJavascriptLibrary = replacedJavascriptLibrary.replace('{x:0,y:0}', `{x:${x},y:${y}}`); // replace the pos() with the correct x,y coordinates
  replacedJavascriptLibrary = replacedJavascriptLibrary.replace(
    '{COMMUNITY_A1_FILE_UPDATE_URL}',
    COMMUNITY_A1_FILE_UPDATE_URL
  ); // replace the COMMUNITY_A1_FILE_UPDATE_URL with the correct url
  const compiledCode =
    javascriptXHROverride +
    javascriptFetchOverride +
    transform.imports +
    (withLineNumbers ? `let ${LINE_NUMBER_VAR} = 0;` : '') +
    replacedJavascriptLibrary +
    '(async() => {try{' +
    'let results = await (async () => {' +
    code +
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
