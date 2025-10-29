// Converts the Javascript output to the Rust format and the
// display type for use in the Code Editor.

import { CellValueType } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/javascriptLibrary';

// Converts a single cell output and sets the displayType.
export function javascriptConvertOutputType(
  message: string[],
  value: any,
  column: number,
  row: number,
  x?: number,
  y?: number
): { output: [string, CellValueType]; displayType: string; chartPixelOutput?: [number, number] } | null {
  if (Array.isArray(value) && value.flat().length !== 0) {
    return null;
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      message.push(
        `Warning: Unsupported output type: 'NaN' at cell(${column + (x ?? 0)}, ${row + (y ?? 0)}), value ${value}`
      );
      return null;
    } else if (value === Infinity) {
      message.push(`Warning: Unsupported output type: 'Infinity' at cell(${column + (x ?? 0)}, ${row + (y ?? 0)})`);
      return null;
    }
    return { output: [value.toString(), CellValueType.Number], displayType: 'number' };
  } else if (typeof value === 'string' && value.includes('[object Promise]')) {
    message.push(
      `WARNING: Unsupported output type: \`Promise\` at cell(${column + (x ?? 0)}, ${
        row + (y ?? 0)
      }). Likely you are missing \`await\` before a call that returns a Promise, e.g., \`await fetch(...)\`.`
    );
    return null;
  } else if (value instanceof Date) {
    if (isNaN(value as any)) {
      message.push(
        `WARNING: Unsupported output type: 'Invalid Date' at cell(${column + (x ?? 0)}, ${
          row + (y ?? 0)
        }), value ${value}`
      );
      return null;
    }
    return { output: [value.toISOString(), CellValueType.DateTime], displayType: 'Date' };
  } else if (typeof value === 'function') {
    message.push(`WARNING: Unsupported output type: 'function' at cell(${column + (x ?? 0)}, ${row + (y ?? 0)})`);
    return null;
  } else if (value instanceof Blob && (value as Blob).type.includes('image')) {
    const image = new FileReaderSync().readAsDataURL(value as Blob);
    return { output: [image, CellValueType.Image], displayType: 'OffscreenCanvas' };
  } else if (typeof value === 'string') {
    return { output: [value, CellValueType.Text], displayType: 'string' };
  } else if (value === undefined || value === null) {
    return null;
  } else if (typeof value === 'boolean') {
    return { output: [value ? 'true' : 'false', CellValueType.Logical], displayType: 'boolean' };
  } else if (Array.isArray(value)) {
    // this handles the case where the value.flat() is empty
    return { output: ['', CellValueType.Blank], displayType: 'empty array' };
  } else {
    message.push(
      `WARNING: Unsupported output type "${typeof value}" at cell(${column + (x ?? 0)}, ${
        row + (y ?? 0)
      }), value ${value}`
    );
    return null;
  }
}

function isExpectedObjectType(a: any) {
  return typeof a === 'function' || a instanceof Blob || a instanceof Date;
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
  message: string[],
  value: any,
  column: number,
  row: number,
  chartPixelOutput?: [number, number]
): { output: [string, CellValueType][][]; displayType: string; chartPixelOutput?: [number, number] } | null {
  if (!Array.isArray(value) || value.length === 0 || value.flat().length === 0) {
    return null;
  }
  const types: Set<string> = new Set();
  const output: [string, CellValueType][][] = [];

  // It may be an array of objects, where the object name is the heading row.
  if (!Array.isArray(value[0]) && typeof value[0] === 'object' && !isExpectedObjectType(value[0])) {
    const keys = Object.keys(value[0]);
    output.push(keys.map((key) => [key, CellValueType.Text]));

    for (const [y, v] of value.entries()) {
      const rowEntry: any[] = [];
      output.push(rowEntry);

      for (const key of keys) {
        const outputValue = javascriptConvertOutputType(message, v[key], column, row, 0, y);

        if (outputValue) {
          types.add(outputValue.displayType);
          rowEntry.push(outputValue.output);
        } else {
          rowEntry.push(['', CellValueType.Blank]);
        }
      }
    }
  }

  // Otherwise, it's probably a 1D array of values
  else if (!Array.isArray(value[0])) {
    for (const [y, v] of value.entries()) {
      const outputValue = javascriptConvertOutputType(message, v, column, row, 0, y);
      types.add(outputValue?.displayType || 'text');
      if (outputValue) {
        types.add(outputValue.displayType);
        output.push([outputValue.output]);
      } else {
        output.push([['', CellValueType.Blank]]);
      }
    }
  }

  // 2D array of values
  else {
    let longest = 0;
    for (let i = 0; i < value.length; i++) {
      const len = value[i]?.length || 0;
      longest = Math.max(longest, len);
    }

    for (const [y, v] of value.entries()) {
      output.push([]);

      for (let i = 0; i < longest; i++) {
        if (v.length <= i) {
          output[y].push(['', CellValueType.Blank]);
          types.add('undefined');
        } else {
          const v2 = v[i];
          const outputValue = javascriptConvertOutputType(message, v2, column, row, i, y);
          if (outputValue) {
            types.add(outputValue.displayType);
            output[y].push(outputValue.output);
          } else {
            output[y].push(['', CellValueType.Blank]);
          }
        }
      }
    }
  }

  return {
    output,
    displayType: javascriptFormatDisplayType(types, false),
  };
}
