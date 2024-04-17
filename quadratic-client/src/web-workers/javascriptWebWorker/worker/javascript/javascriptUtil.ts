import { LINE_NUMBER_VAR } from './javascript';
import { javascriptConsole } from './javascriptConsole';
import { javascriptCompiledLibraryLines } from './javascriptLibrary';

// The number of spaces the transpiled code is indented.
const ESBUILD_INDENTATION = 2;

// Converts a single cell output and sets the displayType.
export function javascriptConvertOutputType(
  value: any,
  column: number,
  row: number,
  x?: number,
  y?: number
): { output: string[]; displayType: string } | null {
  if (Array.isArray(value)) {
    return null;
  }
  if (typeof value === 'number') {
    return { output: [value.toString(), 'number'], displayType: 'number' };
  } else if (value === 'function') {
    javascriptConsole.push(
      `WARNING: Unsupported output type: 'function' ${
        x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
      }`
    );
    return null;
  } else if (typeof value === 'string') {
    return { output: [value, 'text'], displayType: 'string' };
  } else if (value === undefined) {
    return null;
  } else {
    javascriptConsole.push(
      `WARNING: Unsupported output type "${typeof value}" ${
        x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
      }`
    );
    return null;
  }
}

// Formats the display type for an array based on a Set of types.
export function javascriptFormatDisplayType(types: Set<string>, twoDimensional: boolean): string {
  if (types.size === 1) {
    return types.values().next().value + '[]' + (twoDimensional ? '[]' : '');
  } else {
    return `(${Array.from(types).join('|')})[]` + (twoDimensional ? '[]' : '');
  }
}

// Converts an array output and sets the displayType.
export function javascriptConvertOutputArray(
  value: any,
  column: number,
  row: number
): { output: string[][][]; displayType: string } | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const types: Set<string> = new Set();
  if (!Array.isArray(value[0])) {
    return {
      output: value.map((v: any, y: number) => {
        const outputValue = javascriptConvertOutputType(v, column, row, 0, y);
        types.add(outputValue?.displayType || 'text');
        if (outputValue) {
          types.add(outputValue.displayType);
          return [outputValue.output];
        }
        return [['', 'text']];
      }),
      displayType: javascriptFormatDisplayType(types, false),
    };
  } else {
    return {
      output: value.map((v: any[], y: number) => {
        return v.map((v2: any[], x: number) => {
          const outputValue = javascriptConvertOutputType(v2, column, row, x, y);
          if (outputValue) {
            types.add(outputValue.displayType);
            return outputValue.output;
          }
          return ['', 'text'];
        });
      }),
      displayType: javascriptFormatDisplayType(types, true),
    };
  }
}

// calculate the error line number but excluding the Quadratic library size
export function javascriptErrorLineNumber(stack: string): { text: string; line: number | null } {
  const match = stack.match(/<anonymous>:(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1]) - javascriptCompiledLibraryLines;
    if (line >= 0) {
      return { text: ` at line ${line}:${parseInt(match[2]) - ESBUILD_INDENTATION}`, line };
    } else console.log(stack, match, line, javascriptCompiledLibraryLines);
  }
  return { text: '', line: null };
}

// Adds line number variables to the code. It uses a naive approach to handling
// multi-line strings. We track the ` character and only add the variables where
// there's an even number of them. This may break in some situations, but seeing
// as esbuild strips comments on build, we may be mostly okay here except where
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
