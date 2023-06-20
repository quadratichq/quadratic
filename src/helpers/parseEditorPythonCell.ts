import { ParseFormulaReturnType } from './formulaNotation';

const CELL = /\(\s*(-?\d+\s*,\s*-?\d+\s*)\)/;
const SIMPLE_CELL = new RegExp(`cell${CELL.source}`, 'g');
const MULTICURSOR_CELL = new RegExp(`cells\\(\\s*${CELL.source}\\s*,\\s*${CELL.source}\\s*\\)`, 'g');

export function parsePython(modelContent: string) {
  let matches: RegExpExecArray | null;

  let parsedEditorContent: ParseFormulaReturnType = {
    // could be improved to check for errors within the editor content
    parse_error_msg: undefined,
    parse_error_span: undefined,
    cell_refs: [],
  };

  while ((matches = SIMPLE_CELL.exec(modelContent)) !== null) {
    const match = matches[0];
    const group = matches[1];
    const [x, y] = group.split(',');
    const startIndex = matches.index;
    const matchLength = match.length;

    parsedEditorContent.cell_refs.push({
      cell_ref: { Cell: { x: { Relative: parseInt(x) }, y: { Relative: parseInt(y) } } },
      span: { start: startIndex, end: startIndex + matchLength },
    });
  }

  while ((matches = MULTICURSOR_CELL.exec(modelContent)) !== null) {
    const match = matches[0];
    const startCell = matches[1];
    const endCell = matches[2];
    const [startX, startY] = startCell.split(',');
    const [endX, endY] = endCell.split(',');
    const startIndex = matches.index;
    const matchLength = match.length;

    parsedEditorContent.cell_refs.push({
      cell_ref: {
        CellRange: [
          { x: { Relative: parseInt(startX) }, y: { Relative: parseInt(startY) } },
          { x: { Relative: parseInt(endX) }, y: { Relative: parseInt(endY) } },
        ],
      },
      span: { start: startIndex, end: startIndex + matchLength },
    });
  }
  return parsedEditorContent;
}
