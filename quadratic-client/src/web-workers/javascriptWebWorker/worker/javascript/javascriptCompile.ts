// Adds line number variables to the code. It uses a naive approach to handling
// multi-line strings. We track the ` character and only add the variables where
// there's an even number of them. This may break in some situations, but seeing
// as esbuild strips comments on build, we may be mostly okay here except where

import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { LINE_NUMBER_VAR } from './javascript';
import { JAVASCRIPT_X_COORDINATE, JAVASCRIPT_Y_COORDINATE, javascriptLibrary } from './javascriptLibrary';

// ` is used within other strings.
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

// separates imports from code so it can be placed above anonymous async function
function transformCode(code: string): { code: string; imports: string } {
  // from https://stackoverflow.com/a/73265022/1955997
  const regExp =
    // eslint-disable-next-line no-useless-escape
    /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/gm;
  const imports = (code.match(regExp)?.join('\n') || '') + ';';
  let transformedCode = code.replace(regExp, '');
  return { code: transformedCode, imports };
}

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
  return (
    transform.imports +
    `const ${JAVASCRIPT_X_COORDINATE} = ${message.x}; const ${JAVASCRIPT_Y_COORDINATE} = ${message.y}` +
    javascriptLibrary +
    '(async() => {' +
    'const results = await (async () => {' +
    transform.code +
    '\n })();' +
    'self.postMessage({ type: "results", results }) })(); '
  );
  // }
}
