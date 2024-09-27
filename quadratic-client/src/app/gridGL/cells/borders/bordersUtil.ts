import { BorderStyleCell, JsBorderHorizontal, JsBorderVertical } from '@/app/quadratic-core-types';

// Breaks up a sheet-based line removing the parts that overlap. See tests for
// examples.
export function divideLine(
  lines: [number, number][],
  current: number | undefined,
  start: number,
  end: number,
  overlap: number,
  overlapSize: number
): number | undefined {
  // handle the case where the current line is already covered by a previous
  // line (this can happen b/c of perpendicular lines)
  if (current && overlap < current) {
    return current;
  }
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

// Checks whether perpendicular lines intersect with a sheet-based line.
export function findPerpendicularHorizontalLines(
  start: number,
  end: number,
  entries: Record<string, BorderStyleCell> | null
): JsBorderHorizontal[] {
  const lines: JsBorderHorizontal[] = [];
  if (entries === null) return lines;

  for (let i = start; i <= end; i++) {
    // finds perpendicular intersecting lines using top/left
    const current = entries[i.toString()];
    if (current) {
      if (current.top) {
        lines.push({ color: current.top.color, line: current.top.line, x: BigInt(i), y: 0n, width: 1n });
      }
    } else {
      // finds perpendicular intersecting lines using the previous bottom/right
      const next = entries[(i - 1).toString()];
      if (next) {
        if (next.bottom) {
          lines.push({ color: next.bottom.color, line: next.bottom.line, x: BigInt(i - 1), y: 0n, width: 1n });
        }
      }
    }
  }
  return lines;
}

// Checks whether perpendicular lines intersect with a sheet-based line.
export function findPerpendicularVerticalLines(
  start: number,
  end: number,
  entries: Record<string, BorderStyleCell> | null
): JsBorderVertical[] {
  const lines: JsBorderVertical[] = [];
  if (entries === null) return lines;

  for (let i = start; i <= end; i++) {
    // finds perpendicular intersecting lines using left/top
    const current = entries[i.toString()];
    if (current) {
      if (current.left) {
        lines.push({ color: current.left.color, line: current.left.line, x: 0n, y: BigInt(i), height: 1n });
      }
    } else {
      // finds perpendicular intersecting lines using the previous right/bottom
      const next = entries[(i - 1).toString()];
      if (next) {
        if (next.right) {
          lines.push({ color: next.right.color, line: next.right.line, x: 0n, y: BigInt(i - 1), height: 1n });
        }
      }
    }
  }
  return lines;
}
