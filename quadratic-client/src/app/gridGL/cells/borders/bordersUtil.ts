// Breaks up a line removing the parts that overlap. Note, the line is defined
// as its index. So [1, 1] is a single cell.
export function divideLine(
  lines: [number, number][],
  current: number | undefined,
  start: number,
  end: number,
  overlap: number,
  overlapSize: number
): number | undefined {
  // If the overlaps is at the current or starting position of the line, then
  // nothing needs to be done. Just move current to the next position.
  if (overlap === current || overlap === start) {
    return overlap + overlapSize;
  }

  // If the overlap goes beyond the end of the line, then nothing needs to be
  // added to lines.
  if (overlap + overlapSize === end) {
    return undefined;
  }

  // Otherwise we add the line to lines and return the next position.
  lines.push([current ?? start, overlap]);
  return overlap + overlapSize;
}
