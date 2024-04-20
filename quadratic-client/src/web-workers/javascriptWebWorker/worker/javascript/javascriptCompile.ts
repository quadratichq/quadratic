import * as esbuild from 'esbuild-wasm';

// Adds line number variables to the code. It uses a naive approach to handling
// multi-line strings. We track the ` character and only add the variables where
// there's an even number of them. This may break in some situations, but seeing
// as esbuild strips comments on build, we may be mostly okay here except where

import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { LINE_NUMBER_VAR } from './javascript';
import { JAVASCRIPT_X_COORDINATE, JAVASCRIPT_Y_COORDINATE, javascriptLibrary } from './runner/javascriptLibrary';

export async function javascriptFindSyntaxError(code: string): Promise<{ text: string; lineNumber?: number } | false> {
  try {
    await esbuild.transform(code, { loader: 'js' });
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
// number variables within multiline strings. TODO: A full JS parser would be
// better as it would handle all cases and can be used to move the import
// statements to the top of the code as well.
export function javascriptAddLineNumberVars(code: string): string {
  const list = code.split('\n');
  let multiLineCount = 0;
  let s = '';
  let add = 1;
  for (let i = 0; i < list.length; i++) {
    multiLineCount += [...list[i].matchAll(/`/g)].length;
    s += list[i];
    if (multiLineCount % 2 === 0) {
      s += `;${LINE_NUMBER_VAR} += ${add};\n`;
      add = 1;
    } else {
      add++;
    }
  }
  return s;
}

// Separates imports from the code so it can be placed above anonymous async
// function. This is necessary because JS does not support top-level await (yet).
function transformCode(code: string): { code: string; imports: string } {
  // from https://stackoverflow.com/a/73265022/1955997
  const regExp =
    // eslint-disable-next-line no-useless-escape
    /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/gm;
  const imports = (code.match(regExp)?.join('\n') || '') + ';';
  let transformedCode = code.replace(regExp, '');
  return { code: transformedCode, imports };
}

// Prepares code to be sent to the worker for execution. This includes moving
// moving import statements outside of async wrapper; adding line number
// variables (although if we get an error, we'll try it without the variables);
// and adding the quadratic libraries and console tracking code.
export function prepareJavascriptCode(message: CoreJavascriptRun, withLineNumbers: boolean): string {
  // if (withLineNumbers) {
  //   return (
  //     transform.imports +
  //     javascriptLibrary +
  //     '(async () => {' +
  //     javascriptAddLineNumberVars(transform.code) +
  //     '\n })();debugger'
  //   );
  // } else {
  // const codeTest = `
  // import * as d3 from "https://esm.run/d3";
  // console.log(!!d3);
  // console.log("hello")
  // return 123;
  // `;
  const transform = transformCode(message.code);
  const compiledCode =
    transform.imports +
    `const ${JAVASCRIPT_X_COORDINATE} = ${message.x}; const ${JAVASCRIPT_Y_COORDINATE} = ${message.y}` +
    javascriptLibrary +
    '(async() => {try{' +
    'const results = await (async () => {' +
    transform.code +
    '\n })();' +
    'self.postMessage({ type: "results", results, console: javascriptConsole.output() });' +
    '} catch (e) { self.postMessage({ type: "error", error: e, console: javascriptConsole.output() }); }' +
    '})();';
  return compiledCode;
  // }
}
