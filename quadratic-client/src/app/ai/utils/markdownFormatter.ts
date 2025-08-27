/**
 * Utility function to convert JavaScript objects to markdown format for AI context messages
 * Uses markdown headers and formatting for clean, readable structure
 */

type Data = boolean | number | string | null | undefined | Array<Data> | object;

function isObject(value: Data): value is Record<string, Data> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatTitle(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function convertToMarkdown(data: Data, rootElement: string, level: number): string {
  let result = '#'.repeat(Math.min(level, 6)) + ' ' + formatTitle(rootElement) + '\n';

  if (data === null || data === undefined) {
    result += '*(empty)*\n\n';
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      result += '*(none)*\n\n';
    } else {
      result += '\n';

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (isObject(item)) {
          result += formatObjectAsMarkdown(item, level + 1);
          if (i < data.length - 1) {
            result += '\n---\n\n'; // Separator between items
          }
        } else {
          result += `- ${String(item)}\n`;
        }
      }
      result += '\n';
    }
  } else if (isObject(data)) {
    result += '\n' + formatObjectAsMarkdown(data, level + 1);
  } else {
    result += '\n' + String(data) + '\n\n';
  }

  return result;
}

function formatObjectAsMarkdown(obj: Record<string, Data>, level: number): string {
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    const label = formatTitle(key);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        result += `${label}: *(none)*\n`;
      } else if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
        // Simple array - format as comma-separated
        result += `${label}: ${value.join(', ')}\n`;
      } else {
        // Complex array - format as nested items
        result += `${label}:\n`;
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (Array.isArray(item)) {
            // Handle 2D arrays (like starting_rect_values)
            result += `  Row ${i + 1}:\n`;
            for (let j = 0; j < item.length; j++) {
              const cellValue = item[j];
              if (isObject(cellValue) && cellValue.value !== undefined && cellValue.pos !== undefined) {
                // Handle cell value objects specifically
                result += `    ${cellValue.pos}: "${cellValue.value}" (${cellValue.kind})\n`;
              } else if (isObject(cellValue)) {
                const cellContent = formatObjectAsMarkdown(cellValue, level + 2);
                result +=
                  cellContent
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n') + '\n';
              } else {
                result += `    - ${String(cellValue)}\n`;
              }
            }
          } else if (isObject(item)) {
            result += formatObjectAsMarkdown(item, level + 1);
            if (i < value.length - 1) {
              result += '\n';
            }
          } else {
            result += `  - ${String(item)}\n`;
          }
        }
      }
    } else if (isObject(value)) {
      result += `${label}:\n`;
      const nestedContent = formatObjectAsMarkdown(value, level + 1);
      // Indent the nested content
      result += nestedContent
        .split('\n')
        .map((line) => (line ? `  ${line}` : ''))
        .join('\n');
      result += '\n';
    } else {
      result += `${label}: ${String(value)}\n`;
    }
  }

  return result;
}

/**
 * Convert data to markdown format for AI context
 * @param data - The data to convert
 * @param rootElement - The root element name (default: 'data')
 * @returns Markdown formatted string
 */
export function toMarkdown(data: Data, rootElement: string = 'data'): string {
  return convertToMarkdown(data, rootElement, 1).trim();
}
