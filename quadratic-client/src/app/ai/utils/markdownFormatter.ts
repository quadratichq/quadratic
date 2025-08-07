/**
 * Utility function to convert JavaScript objects to markdown format for AI context messages
 * Uses markdown headers and formatting for clean, readable structure
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function convertToMarkdown(data: any, rootElement: string = 'data', level: number = 1): string {
  const headerPrefix = '#'.repeat(Math.min(level, 6)) + ' ';

  if (data === null || data === undefined) {
    return `${headerPrefix}${formatTitle(rootElement)}\n*(empty)*\n\n`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${headerPrefix}${formatTitle(rootElement)}\n*(none)*\n\n`;
    }

    let result = `${headerPrefix}${formatTitle(rootElement)}\n\n`;

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
    return result;
  }

  if (isObject(data)) {
    let result = `${headerPrefix}${formatTitle(rootElement)}\n\n`;
    result += formatObjectAsMarkdown(data, level + 1);
    return result;
  }

  // Primitive values
  return `${headerPrefix}${formatTitle(rootElement)}\n${String(data)}\n\n`;
}

function formatObjectAsMarkdown(obj: Record<string, any>, level: number): string {
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
          if (isObject(item)) {
            result += formatObjectAsMarkdown(item, level + 1);
            if (i < value.length - 1) {
              result += '\n';
            }
          } else if (Array.isArray(item)) {
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

function formatTitle(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Convert data to markdown format for AI context
 * @param data - The data to convert
 * @param rootElement - The root element name (default: 'data')
 * @returns Markdown formatted string
 */
export function toMarkdown(data: any, rootElement: string = 'data'): string {
  return convertToMarkdown(data, rootElement, 1).trim();
}
