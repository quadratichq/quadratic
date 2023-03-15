/**
 * Turns a positive column number into A1 notation
 * based on https://www.labnol.org/convert-column-a1-notation-210601
 * @param column
 * @returns
 */
function translateNumberToA1Notation(column: number): string {
  const a1Notation: string[] = [];
  const totalAlphabets = 'Z'.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  let block = column;
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
  if (column < 0) return `n${translateNumberToA1Notation(-column - 1)}`;
  return translateNumberToA1Notation(column);
}

export function getRowA1Notation(row: number): string {
  if (row > 0) return row.toString();
  if (row === 0) return '0';
  return `n${-row}`;
}
