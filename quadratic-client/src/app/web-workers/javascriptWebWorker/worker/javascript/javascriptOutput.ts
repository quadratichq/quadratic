// Converts the Javascript output to the Rust format and the
// display type for use in the Code Editor.

// Converts a single cell output and sets the displayType.
export function javascriptConvertOutputType(
  message: string[],
  value: any,
  column: number,
  row: number,
  x?: number,
  y?: number
): { output: [string, string]; displayType: string } | null {
  if (Array.isArray(value) && value.flat().length !== 0) {
    return null;
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      message.push(
        `Warning: Unsupported output type: 'NaN' ${
          x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
        }`
      );
      return null;
    } else if (value === Infinity) {
      message.push(
        `Warning: Unsupported output type: 'Infinity' ${
          x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
        }`
      );
      return null;
    }
    return { output: [value.toString(), 'number'], displayType: 'number' };
  } else if (typeof value === 'string' && value.includes('[object Promise]')) {
    message.push(
      'WARNING: Unsupported output type: `Promise`' +
        (x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : '') +
        '. Likely you are missing `await` before a call that returns a Promise, e.g., `await fetch(...)`.'
    );
    return null;
  } else if (typeof value === 'function') {
    message.push(
      `WARNING: Unsupported output type: 'function' ${
        x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
      }`
    );
    return null;
  } else if (value instanceof Blob && (value as Blob).type.includes('image')) {
    const image = new FileReaderSync().readAsDataURL(value as Blob);
    return { output: [image, 'image'], displayType: 'OffscreenCanvas' };
  } else if (typeof value === 'string') {
    return { output: [value, 'text'], displayType: 'string' };
  } else if (value === undefined) {
    return null;
  } else if (typeof value === 'boolean') {
    return { output: [value ? 'true' : 'false', 'logical'], displayType: 'boolean' };
  } else if (Array.isArray(value)) {
    // this handles the case where the value.flat() is empty
    return { output: ['', 'array'], displayType: 'empty array' };
  } else {
    message.push(
      `WARNING: Unsupported output type "${typeof value}" ${
        x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
      }`
    );
    return null;
  }
}

function isExpectedObjectType(a: any) {
  return typeof a === 'function' || a instanceof Blob;
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
  row: number
): { output: [string, string][][]; displayType: string } | null {
  if (!Array.isArray(value) || value.length === 0 || value.flat().length === 0) {
    return null;
  }
  const types: Set<string> = new Set();
  const output: [string, string][][] = [];

  // It may be an array of objects, where the object name is the heading row.
  if (!Array.isArray(value[0]) && typeof value[0] === 'object' && !isExpectedObjectType(value[0])) {
    const keys = Object.keys(value[0]);
    output.push(keys.map((key) => [key, 'text']));
    for (const [y, v] of value.entries()) {
      const rowEntry: any[] = [];
      output.push(rowEntry);
      for (const key of keys) {
        const outputValue = javascriptConvertOutputType(message, v[key], column, row, 0, y);
        if (outputValue) {
          types.add(outputValue.displayType);
          rowEntry.push(outputValue.output);
        } else {
          rowEntry.push(['', 'blank']);
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
        output.push([['', 'blank']]);
      }
    }
  }

  // 2D array of values
  else {
    const longest = Math.max(...value.map((v) => v.length));
    for (const [y, v] of value.entries()) {
      output.push([]);
      for (let i = 0; i < longest; i++) {
        if (v.length <= i) {
          output[y].push(['', 'blank']);
          types.add('undefined');
        } else {
          const v2 = v[i];
          const outputValue = javascriptConvertOutputType(message, v2, column, row, i, y);
          if (outputValue) {
            types.add(outputValue.displayType);
            output[y].push(outputValue.output);
          } else {
            output[y].push(['', 'blank']);
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
