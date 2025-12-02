import type { FormatUpdate } from '@/app/quadratic-core-types';
import { FONT_SIZE_DISPLAY_ADJUSTMENT } from '@/shared/constants/gridConstants';

export const defaultFormatUpdate = (): FormatUpdate => {
  return {
    bold: null,
    italic: null,
    underline: null,
    strike_through: null,
    align: null,
    vertical_align: null,
    wrap: null,
    numeric_format: null,
    numeric_decimals: null,
    numeric_commas: null,
    text_color: null,
    fill_color: null,
    render_size: null,
    date_time: null,
    font_size: null,
  };
};

/// Calculates the Levenshtein distance between two strings
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

/// Ensures the value of an enum, and tries to match if it is close to an expected value
export const expectedEnum = <T>(value: string | undefined, expected: string[]): T | null => {
  if (!value) return null;

  // If the value is already in the expected array, return it
  if (expected.includes(value)) {
    return value as T;
  }

  // If the value is close to an expected value, return the expected value
  const index = expected.findIndex((e) => e.toLowerCase() === value.toLowerCase());
  if (index !== -1) {
    return expected[index] as T;
  }

  // Find the closest match using Levenshtein distance
  let minDistance = Infinity;
  let closestMatch = null;

  for (const expectedValue of expected) {
    const distance = levenshteinDistance(value.toLowerCase(), expectedValue.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = expectedValue;
    }
  }

  // If the closest match is reasonably close (e.g., within 2 edits), return it
  return minDistance <= 2 ? (closestMatch as T) : null;
};

export const describeFormatUpdates = (formatUpdates: FormatUpdate, args: any): string => {
  const updates = [];
  if (formatUpdates.bold) updates.push('bold');
  if (formatUpdates.italic) updates.push('italic');
  if (formatUpdates.underline) updates.push('underline');
  if (formatUpdates.strike_through) updates.push('strike through');
  if (formatUpdates.text_color) updates.push(`text color: ${formatUpdates.text_color}`);
  if (formatUpdates.fill_color) updates.push(`fill color: ${formatUpdates.fill_color}`);
  if (formatUpdates.align) updates.push(`align: ${formatUpdates.align}`);
  if (formatUpdates.vertical_align) updates.push(`vertical align: ${formatUpdates.vertical_align}`);
  if (formatUpdates.wrap) updates.push(`wrap: ${formatUpdates.wrap}`);
  if (formatUpdates.numeric_commas) updates.push(`commas: ${formatUpdates.numeric_commas}`);
  if (formatUpdates.numeric_format) updates.push(`numeric format: ${formatUpdates.numeric_format}`);
  if (formatUpdates.numeric_decimals) updates.push(`decimals: ${formatUpdates.numeric_decimals}`);
  if (formatUpdates.font_size) {
    // Convert internal font size back to user-facing value
    const displayFontSize = formatUpdates.font_size + FONT_SIZE_DISPLAY_ADJUSTMENT;
    updates.push(`font size: ${displayFontSize}`);
  }
  if (updates.length === 0) {
    return `couldn't parse: ${JSON.stringify(args)}`;
  }
  return updates.join(', ');
};
