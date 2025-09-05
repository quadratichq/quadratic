/**
 * Utilities for parsing and highlighting cell ranges mentioned in AI chat messages
 */

export interface ParsedRange {
  text: string;
  range: string;
  sheetName?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Regular expressions for different cell range formats
 */
const RANGE_PATTERNS = [
  // Standard A1 notation: A1, B2:C10, $A$1:$B$10
  /\b\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?\b/g,

  // Sheet references: Sheet1!A1:B10, 'My Sheet'!A1:B10
  /(?:'[^']*'|[A-Za-z0-9_]+)!\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?/g,
];

/**
 * Parse a text message to find all cell range references
 */
export function parseRangesFromText(text: string): ParsedRange[] {
  const ranges: ParsedRange[] = [];
  const processedRanges = new Set<string>(); // Avoid duplicates

  for (const pattern of RANGE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchText.length;

      // Extract the actual range from descriptive text
      const range = extractRangeFromMatch(matchText);
      if (range && !processedRanges.has(range)) {
        processedRanges.add(range);

        // Extract sheet name if present
        const sheetMatch = range.match(/^(?:'([^']*)'|([A-Za-z0-9_]+))!/);
        const sheetName = sheetMatch ? sheetMatch[1] || sheetMatch[2] : undefined;
        const rangeWithoutSheet = sheetName ? range.split('!')[1] : range;

        ranges.push({
          text: matchText,
          range: rangeWithoutSheet,
          sheetName,
          startIndex,
          endIndex,
        });
      }
    }
  }

  // Sort by position in text
  return ranges.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Extract the actual cell range from a matched text
 */
function extractRangeFromMatch(matchText: string): string | null {
  // Only handle standard A1 notation (including sheet references)
  const cleaned = matchText.trim();

  // Handle standard A1 notation: A1, A1:B2, Sheet1!A1:B2, 'My Sheet'!A1:B2
  if (/^(?:'[^']*'|[A-Za-z0-9_]+!)?\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?$/i.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Convert a range string to a standardized format for processing
 */
export function normalizeRange(range: string): string {
  // Remove sheet reference for internal processing
  const rangeWithoutSheet = range.includes('!') ? range.split('!')[1] : range;

  // Remove $ signs
  const normalized = rangeWithoutSheet.replace(/\$/g, '');

  // Handle single cell -> make it a range
  if (/^[A-Z]{1,3}\d{1,7}$/i.test(normalized)) {
    return `${normalized}:${normalized}`;
  }

  return normalized;
}

/**
 * Check if a range string is valid
 */
export function isValidRange(range: string): boolean {
  try {
    const normalized = normalizeRange(range);

    // Check for valid A1 notation range
    const rangePattern = /^[A-Z]{1,3}\d{1,7}:[A-Z]{1,3}\d{1,7}$/i;
    if (rangePattern.test(normalized)) return true;

    // Check for column ranges
    const colPattern = /^[A-Z]{1,3}:[A-Z]{1,3}$/i;
    if (colPattern.test(normalized)) return true;

    // Check for row ranges
    const rowPattern = /^\d{1,7}:\d{1,7}$/;
    if (rowPattern.test(normalized)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Parse range into coordinates for drawing
 */
export interface RangeCoordinates {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  isFullColumn: boolean;
  isFullRow: boolean;
}

export function parseRangeCoordinates(range: string): RangeCoordinates | null {
  const normalized = normalizeRange(range);

  // Handle column ranges (A:A, A:C)
  if (/^[A-Z]{1,3}:[A-Z]{1,3}$/i.test(normalized)) {
    const [startCol, endCol] = normalized.split(':');
    return {
      startCol: columnLettersToNumber(startCol),
      startRow: 1,
      endCol: columnLettersToNumber(endCol),
      endRow: Infinity,
      isFullColumn: true,
      isFullRow: false,
    };
  }

  // Handle row ranges (1:1, 5:10)
  if (/^\d{1,7}:\d{1,7}$/.test(normalized)) {
    const [startRow, endRow] = normalized.split(':').map(Number);
    return {
      startCol: 1,
      startRow,
      endCol: Infinity,
      endRow,
      isFullColumn: false,
      isFullRow: true,
    };
  }

  // Handle cell ranges (A1:C5)
  const cellRangeMatch = normalized.match(/^([A-Z]{1,3})(\d{1,7}):([A-Z]{1,3})(\d{1,7})$/i);
  if (cellRangeMatch) {
    const [, startColStr, startRowStr, endColStr, endRowStr] = cellRangeMatch;
    return {
      startCol: columnLettersToNumber(startColStr),
      startRow: parseInt(startRowStr),
      endCol: columnLettersToNumber(endColStr),
      endRow: parseInt(endRowStr),
      isFullColumn: false,
      isFullRow: false,
    };
  }

  return null;
}

/**
 * Convert column letters to numbers (A=1, B=2, ..., AA=27, etc.)
 */
function columnLettersToNumber(letters: string): number {
  let result = 0;
  const upperLetters = letters.toUpperCase();

  for (let i = 0; i < upperLetters.length; i++) {
    result = result * 26 + (upperLetters.charCodeAt(i) - 64);
  }

  return result;
}
