import { GridOffsets } from '../grid/sheet/GridOffsets';
import { Coordinate } from '../gridGL/types/size';

export function getColumnFromFormulaNotation(formulaNotation: string) {
  const { formulaNotation: parsedFormulaNotation, isNegative } = parseNegative(formulaNotation);
  let columnNumber = 0;

  for (let i = 0; i < parsedFormulaNotation.length; i++) {
    columnNumber = parsedFormulaNotation[i].charCodeAt(0) - 64 + columnNumber * 26;
  }
  columnNumber--;
  return columnNumber * (isNegative ? -1 : 1) + (isNegative ? -1 : 0);
}

export function getCellFromFormulaNotation(
  formulaNotation: string,
  gridOffsets: GridOffsets,
  editorCursorPosition: Coordinate
) {
  const match = formulaNotation.match(/\$?(n?[A-Z]+)\$?(n?\d+)/);
  if (!match) return false;
  const columnNumber = getColumnFromFormulaNotation(match[1]);
  const { formulaNotation: rowFormulaNotation, isNegative } = parseNegative(match[2]);
  const rowNumber = parseInt(rowFormulaNotation) * (isNegative ? -1 : 1);

  // getCell is slow with more than 9 digits, so limit if column or row is > editorCursorPosition + an offset
  // If it's a single cell to be highlighted, it won't be visible anyway, and if it's a range
  // It will highlight beyond the what's visible in the viewport
  return gridOffsets.getCell(
    Math.min(columnNumber, editorCursorPosition.x + 20000),
    Math.min(rowNumber, editorCursorPosition.y + 20000)
  );
}

export function parseMulticursorFormulaNotation(
  multicursorFormulaNotation: string,
  gridOffsets: GridOffsets,
  editorCursorPosition: Coordinate
) {
  const [startCellLetter, endCellLetter] = multicursorFormulaNotation.split(':');
  const startCell = getCellFromFormulaNotation(startCellLetter, gridOffsets, editorCursorPosition);
  const endCell = getCellFromFormulaNotation(endCellLetter, gridOffsets, editorCursorPosition);

  if (!startCell || !endCell) return false;
  return {
    startCell,
    endCell,
  };
}

function parseNegative(formulaNotation: string) {
  const isNegative = formulaNotation[0] === 'n';
  formulaNotation = isNegative ? formulaNotation.substring(1) : formulaNotation;
  return {
    isNegative,
    formulaNotation,
  };
}
