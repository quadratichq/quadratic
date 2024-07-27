import type { Coordinate } from '@/app/gridGL/types/size';

/**
 * Takes user input and returns an array of coordinate(s) (the second set of
 * coordinates being optional). The key here is: given any string, this should
 * always return valid cell or range coordinates.
 *
 * Defaults to (0, 0) for zero to two sequences of digits:
 *   e.g. `[{ x: 0, y: 0 }]`
 * Returns a 2nd set of coordinates when input is three sequences of digits or more:
 *   e.g. `[{ x: 0, y: 0 }], [{ x: 2, y: 3 }]`
 */
export function getCoordinatesFromUserInput(str: string): [Coordinate] | [Coordinate, Coordinate] {
  let coor1: Coordinate = { x: 0, y: 0 };

  const matches = str.match(/-?\d+/g);

  // 0 matches? Return defaults
  if (!matches) {
    return [coor1];
  }

  // 1+ matches? Pick them out
  const [x1, y1, x2, y2] = matches.map((str) => Number(str));

  // 1 match
  coor1.x = x1;

  // 2 matches
  if (y1) {
    coor1.y = y1;
  }

  // No more matches? Return
  if (!Number.isInteger(x2)) {
    return [coor1];
  }

  // 3-4 matches
  const coor2: Coordinate = { x: x2, y: y2 === undefined ? y1 : y2 };

  // If (1,2) is the same as (3,4), just return a single coordinate.
  if (coor1.x === coor2.x && coor1.y === coor2.y) {
    return [coor1];
  }

  // Otherwise return both sets of coordinates
  return [coor1, coor2];
}
