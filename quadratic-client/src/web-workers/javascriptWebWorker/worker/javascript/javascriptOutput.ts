import { javascriptConsole } from './javascriptConsole';

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
    if (isNaN(value)) {
      javascriptConsole.push(
        `Warning: Unsupported output type: 'NaN' ${
          x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
        }`
      );
      return null;
    } else if (value === Infinity) {
      javascriptConsole.push(
        `Warning: Unsupported output type: 'Infinity' ${
          x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
        }`
      );
      return null;
    }
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
  } else if (typeof value === 'boolean') {
    return { output: [value ? 'true' : 'false', 'logical'], displayType: 'boolean' };
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
