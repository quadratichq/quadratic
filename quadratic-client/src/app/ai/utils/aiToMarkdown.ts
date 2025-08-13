import type { JsCellValueCode, JsCellValueDescription, JsGetAICellResult } from '@/app/quadratic-core-types';
import BigNumber from 'bignumber.js';

const convertJsCellValue = (cell: JsCellValueCode, showLanguage: boolean): string => {
  if (showLanguage && cell.language && typeof cell.language !== 'object') {
    return `{"language": "${cell.language}", result: ${convertJsCellValue(cell, false)}}`;
  }
  if (cell.kind === 'Number') {
    return new BigNumber(cell.value).toString();
  } else if (cell.kind === 'Text') {
    return `"${cell.value}"`;
  } else if (cell.kind === 'Logical') {
    return cell.value ? 'true' : 'false';
  } else if (cell.kind === 'DateTime') {
    return `"${cell.value}"`;
  } else if (cell.kind === 'Date') {
    return `"${cell.value}"`;
  } else if (cell.kind === 'Time') {
    return `"${cell.value}"`;
  } else if (cell.kind === 'Duration') {
    return `"${cell.value}"`;
  } else if (cell.kind === 'Error') {
    return `"This cell contains an error"`;
  } else if (cell.kind === 'Html') {
    return `"This cell contains html"`;
  } else if (cell.kind === 'Code') {
    return `"This cell contains code"`;
  } else if (cell.kind === 'Image') {
    return `"This cell contains an image"`;
  } else if (cell.kind === 'Import') {
    return `"This cell contains an import"`;
  } else {
    if (cell.kind !== 'Blank') {
      console.warn(`Unknown cell value kind: ${cell.kind}`);
    }
    return `""`;
  }
};

/// Converts a jsGetAICellResult to markdown
export const AICellsToMarkdown = (description: JsCellValueDescription, showLanguage: boolean): string => {
  return `
\`\`\`json
{
  "total_range": "${description.total_range}",
  "shown_range": "${description.range}",
  "values": [
${description.values.map((row) => `      [${row.map((cell) => convertJsCellValue(cell, showLanguage)).join(', ')}]`).join(',\n')}
  ]
}
\`\`\`
`;
};

export const AICellResultToMarkdown = (result: JsGetAICellResult): string => {
  if (result.values.length === 0) {
    return `The selection ${result.selection} has no content.`;
  } else {
    let output = '';
    if (result.page !== result.total_pages) {
      output += `
IMPORTANT: There are ${result.total_pages} pages in this result. Use this tool again with page = ${result.page + 1} for the next page. After performing an operation on this data, you MUST use this tool again to get additional pages of data.\n\n`;
    } else if (result.page !== 0 || result.total_pages !== 0) {
      output += `
The selection ${result.selection} for page = ${result.page + 1} (out of ${result.total_pages + 1}) has: `;
    }
    output += result.values.map((value) => AICellsToMarkdown(value, true)).join('\n\n');
    return output;
  }
};
