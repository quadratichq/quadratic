/**
 * Turns a positive column number into A1 notation
 * based on https://www.labnol.org/convert-column-a1-notation-210601
 * @param column
 * @returns a string
 */
export function getColumnA1Notation(column: number): string {
  // adjust for 1-indexing (ie, A1 starts at 1 instead of 0)
  column -= 1;

  const a1Notation: string[] = [];
  const totalAlphabets = 'Z'.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  let block = column;
  while (block >= 0) {
    a1Notation.unshift(String.fromCharCode((block % totalAlphabets) + 'A'.charCodeAt(0)));
    block = Math.floor(block / totalAlphabets) - 1;
  }
  return a1Notation.join('');
}

export function getRowA1Notation(row: number): string {
  return row.toString();
}

export function getA1Notation(column: number, row: number): string {
  return `${getColumnA1Notation(column)}${getRowA1Notation(row)}`;
}
