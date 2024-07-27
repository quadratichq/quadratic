// Converts the Javascript code before sending it to the worker. This includes
// using esbuild to find syntax errors, promoting import statements to the top
// of the file (this is to ensure they are not placed inside of the async
// anonymous function that allows await at the top level), and attempting to
// track line numbers so we can return a lineNumber for the return statement. It
// uses a naive approach to handling multi-line strings with return numbers. We
// track the ` character and only add the variables where there's an even number
// of them. We always try to compile and run the code with and without line
// numbers to ensure that we don't break something when inserting the line
// numbers.

import * as esbuild from 'esbuild-wasm';

import { LINE_NUMBER_VAR } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptLibrary } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generateJavascriptForRunner';

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

// Adds line number variable, keeping track of ` to ensure we don't place line
// number variables within multiline strings.
//
// TODO: A full JS parser would be better as it would handle all cases and can
// be used to move the import statements to the top of the code as well.
export function javascriptAddLineNumberVars(transform: JavascriptTransformedCode): string {
  const imports = transform.imports.split('\n');
  const list = transform.code.split('\n');
  let multiLineCount = 0;
  let s = '';
  let add = imports.length + 1;
  let inMultiLineComment = false;
  for (let i = 0; i < list.length; i++) {
    multiLineCount += [...list[i].matchAll(/`/g)].length;
    s += list[i];
    if (multiLineCount % 2 === 0) {
      // inserts a line break if the line includes a comment marker
      if (s.includes('//')) s += '\n';

      // track multi-line comments created with /* */
      if (inMultiLineComment) {
        if (s.includes('*/')) {
          inMultiLineComment = false;
        } else {
          add++;
          continue;
        }
      }

      // if we're inside a multi-line comment, don't add line numbers but track it
      if (s.includes('/*') && !s.includes('*/')) {
        inMultiLineComment = true;
        add++;
        continue;
      } else {
        s += `;${LINE_NUMBER_VAR} += ${add};\n`;
      }
      add = 1;
    } else {
      add++;
    }
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
  withLineNumbers: boolean
): string {
  const code = withLineNumbers ? javascriptAddLineNumberVars(transform) : transform.code;
  const compiledCode =
    transform.imports +
    (withLineNumbers ? `let ${LINE_NUMBER_VAR} = 1;` : '') +
    javascriptLibrary.replace('{x:0,y:0}', `{x:${x},y:${y}}`) + // replace the pos() with the correct x,y coordinates
    '(async() => {try{' +
    'let results = await (async () => {' +
    code +
    '\n })();' +
    'if (results instanceof OffscreenCanvas) results = await results.convertToBlob();' +
    `self.postMessage({ type: "results", results, console: javascriptConsole.output()${
      withLineNumbers ? `, lineNumber: ${LINE_NUMBER_VAR} - 1` : ''
    } });` +
    `} catch (e) { const error = e.message; const stack = e.stack; self.postMessage({ type: "error", error, stack, console: javascriptConsole.output() }); }` +
    '})();';
  return compiledCode;
}
