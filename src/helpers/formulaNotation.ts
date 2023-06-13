import { GridOffsets } from '../grid/sheet/GridOffsets';

export function getColumnFromFormulaNotation(formulaNotation: string) {
  const { formulaNotation: parsedFormulaNotation, isNegative } = parseNegative(formulaNotation);
  let letterPosition = 0;
  let columnNumber = 0;
  for (const letter of parsedFormulaNotation) {
    const letterValue = letter.charCodeAt(0) - 65;
    columnNumber = letterPosition * 26 + letterValue;
    letterPosition++;
  }
  return columnNumber * (isNegative ? -1 : 1) + (isNegative ? -1 : 0);
}

export function getCellFromFormulaNotation(formulaNotation: string, gridOffsets: GridOffsets) {
  const match = formulaNotation.match(/\$?(n?[A-Z]+)\$?(n?\d+)/);
  if (!match) return false;
  const columnNumber = getColumnFromFormulaNotation(match[1]);
  const { formulaNotation: rowFormulaNotation, isNegative } = parseNegative(match[2]);
  const rowNumber = parseInt(rowFormulaNotation) * (isNegative ? -1 : 1);

  return gridOffsets.getCell(columnNumber, rowNumber);
}

export function parseMulticursorFormulaNotation(multicursorFormulaNotation: string, gridOffsets: GridOffsets) {
  const [startCellLetter, endCellLetter] = multicursorFormulaNotation.split(':');
  const startCell = getCellFromFormulaNotation(startCellLetter, gridOffsets);
  const endCell = getCellFromFormulaNotation(endCellLetter, gridOffsets);

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
