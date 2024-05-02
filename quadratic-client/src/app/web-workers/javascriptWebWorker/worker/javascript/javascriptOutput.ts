// Converts the Javascript output to the Rust format and the
// display type for use in the Code Editor.

// Converts a single cell output and sets the displayType.
export async function javascriptConvertOutputType(
  message: string[],
  value: any,
  column: number,
  row: number,
  x?: number,
  y?: number
): Promise<{ output: [string, string]; displayType: string } | null> {
  if (Array.isArray(value)) {
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
        '. Likely you are missing `await` before a call that returns a Promise, e.g., `await getCells(...)`.'
    );
    return null;
  } else if (value === 'function') {
    message.push(
      `WARNING: Unsupported output type: 'function' ${
        x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
      }`
    );
    return null;
  } else if (value instanceof Blob && (value as Blob).type.includes('image')) {
    const image = new FileReaderSync().readAsDataURL(value as Blob);
    return { output: [image, 'image'], displayType: 'Blob/image' };
  } else if (typeof value === 'string') {
    return { output: [value, 'text'], displayType: 'string' };
  } else if (value === undefined) {
    return null;
  } else if (typeof value === 'boolean') {
    return { output: [value ? 'true' : 'false', 'logical'], displayType: 'boolean' };
  } else {
    message.push(
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
export async function javascriptConvertOutputArray(
  message: string[],
  value: any,
  column: number,
  row: number
): Promise<{ output: [string, string][][]; displayType: string } | null> {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const types: Set<string> = new Set();
  const output: [string, string][][] = [];
  if (!Array.isArray(value[0])) {
    for (const [y, v] of value.entries()) {
      const outputValue = await javascriptConvertOutputType(message, v, column, row, 0, y);
      types.add(outputValue?.displayType || 'text');
      if (outputValue) {
        types.add(outputValue.displayType);
        output.push([outputValue.output]);
      } else {
        output.push([['', 'blank']]);
      }
    }
  } else {
    for (const [y, v] of value.entries()) {
      output.push([]);
      for (const [x, v2] of v.entries()) {
        const outputValue = await javascriptConvertOutputType(message, v2, column, row, x, y);
        if (outputValue) {
          types.add(outputValue.displayType);
          output[y].push(outputValue.output);
        } else {
          output[y].push(['', 'blank']);
        }
      }
    }
  }
  return {
    output,
    displayType: javascriptFormatDisplayType(types, false),
  };
}
