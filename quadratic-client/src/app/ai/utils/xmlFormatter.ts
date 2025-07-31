/**
 * Utility function to convert JavaScript objects to XML format for AI context messages
 */

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function convertToXml(data: any, rootElement: string = 'data', indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);

  if (data === null || data === undefined) {
    return `${indent}<${rootElement} />\n`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${indent}<${rootElement} />\n`;
    }

    let xml = `${indent}<${rootElement}>\n`;
    data.forEach((item, index) => {
      const itemElement = getSingularName(rootElement);
      xml += convertToXml(item, itemElement, indentLevel + 1);
    });
    xml += `${indent}</${rootElement}>\n`;
    return xml;
  }

  if (isObject(data)) {
    let xml = `${indent}<${rootElement}>\n`;
    for (const [key, value] of Object.entries(data)) {
      xml += convertToXml(value, key, indentLevel + 1);
    }
    xml += `${indent}</${rootElement}>\n`;
    return xml;
  }

  // Primitive values
  const stringValue = String(data);
  if (stringValue.includes('\n') || stringValue.length > 100) {
    // Multi-line or long content - use CDATA
    return `${indent}<${rootElement}><![CDATA[${stringValue}]]></${rootElement}>\n`;
  } else {
    // Short content - escape and inline
    return `${indent}<${rootElement}>${escapeXml(stringValue)}</${rootElement}>\n`;
  }
}

function getSingularName(pluralName: string): string {
  // Simple pluralization rules
  if (pluralName.endsWith('ies')) {
    return pluralName.slice(0, -3) + 'y';
  }
  if (pluralName.endsWith('es')) {
    return pluralName.slice(0, -2);
  }
  if (pluralName.endsWith('s') && !pluralName.endsWith('ss')) {
    return pluralName.slice(0, -1);
  }
  return pluralName + '_item';
}

/**
 * Convert data to XML format for AI context
 * @param data - The data to convert
 * @param rootElement - The root element name (default: 'data')
 * @returns XML formatted string
 */
export function toXml(data: any, rootElement: string = 'data'): string {
  return convertToXml(data, rootElement, 0).trim();
}
