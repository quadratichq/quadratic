import { Coordinate } from '../types/size';
import { QUADRANT_COLUMNS, QUADRANT_ROWS } from './quadrantConstants';

export function getQuadrantCoordinate(column: number, row: number): Coordinate {
  return {
    x: Math.floor(column / QUADRANT_COLUMNS),
    y: Math.floor(row / QUADRANT_ROWS),
  };
}

export function getQuadrantKey(column: number, row: number): string {
  return `${Math.floor(column / QUADRANT_COLUMNS)},${Math.floor(row / QUADRANT_ROWS)}`;
}