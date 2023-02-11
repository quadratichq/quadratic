/**
 * Turns a positive column number into A1 notation
 * @param column
 * @returns
 */
function translateNumberToA1Notation(column: number): string {
  const a1Notation: string[] = [];
  const totalAlphabets = 'Y'.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  let block = column - 1;
  while (block >= 0) {
    a1Notation.unshift(String.fromCharCode((block % totalAlphabets) + 'A'.charCodeAt(0)));
    block = Math.floor(block / totalAlphabets) - 1;
  }
  return a1Notation.join('');
}

/**
 * Turns a quadratic numbered column into A1 notation
 * @param column
 * @returns
 */
export function getColumnA1Notation(column: number): string {
  if (column === 0) return 'Z';
  if (column < 0) return `Z${translateNumberToA1Notation(-column)}`;
  return translateNumberToA1Notation(column);
};

export function getRowA1Notation(row: number): string {
  if (row > 0) return row.toString();
  if (row === 0) return 'N';
  return `N${-row}`;
}