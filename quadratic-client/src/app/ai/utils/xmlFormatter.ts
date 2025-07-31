/**
 * Utility function to convert JavaScript objects to a hybrid XML/text format for AI context messages
 * Uses XML tags for structure but plain text for content to minimize bloat
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function convertToHybridFormat(data: any, rootElement: string = 'data', indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);

  if (data === null || data === undefined) {
    return `${indent}<${rootElement} />\n`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${indent}<${rootElement} />\n`;
    }

    let result = `${indent}<${rootElement}>\n`;
    data.forEach((item, index) => {
      if (isObject(item)) {
        // For objects in arrays, use plain text format with separators
        const itemText = formatObjectAsText(item, indentLevel + 1);
        result += itemText;
        if (index < data.length - 1) {
          result += '\n'; // Add separator between items
        }
      } else {
        result += `${indent}  ${String(item)}\n`;
      }
    });
    result += `${indent}</${rootElement}>\n`;
    return result;
  }

  if (isObject(data)) {
    let result = `${indent}<${rootElement}>\n`;
    result += formatObjectAsText(data, indentLevel + 1);
    result += `${indent}</${rootElement}>\n`;
    return result;
  }

  // Primitive values - just return as text
  return `${indent}<${rootElement}>${String(data)}</${rootElement}>\n`;
}

function formatObjectAsText(obj: Record<string, any>, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel);
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    if (Array.isArray(value)) {
      if (value.length === 0) {
        result += `${indent}${label}: (none)\n`;
      } else if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
        // Simple array - format as comma-separated
        result += `${indent}${label}: ${value.join(', ')}\n`;
      } else {
        // Complex array - format as nested items
        result += `${indent}${label}:\n`;
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (isObject(item)) {
            result += formatObjectAsText(item, indentLevel + 1);
            if (i < value.length - 1) {
              result += `${indent}  ---\n`; // Separator between complex items
            }
          } else {
            result += `${indent}  - ${String(item)}\n`;
          }
        }
      }
    } else if (isObject(value)) {
      result += `${indent}${label}:\n`;
      result += formatObjectAsText(value, indentLevel + 1);
    } else {
      result += `${indent}${label}: ${String(value)}\n`;
    }
  }

  return result;
}

/**
 * Convert data to hybrid XML/text format for AI context
 * @param data - The data to convert
 * @param rootElement - The root element name (default: 'data')
 * @returns Hybrid formatted string with XML structure but text content
 */
export function toXml(data: any, rootElement: string = 'data'): string {
  return convertToHybridFormat(data, rootElement, 0).trim();
}
