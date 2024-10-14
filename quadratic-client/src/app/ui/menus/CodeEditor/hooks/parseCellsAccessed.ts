import { sheets } from '@/app/grid/controller/Sheets';
import { A1RangeType, SheetRect } from '@/app/quadratic-core-types';
import { ParseFormulaReturnType } from '../../../../helpers/formulaNotation';

export function parseCellsAccessed(cellsAccessed?: A1RangeType[] | null): ParseFormulaReturnType {
  let parsedEditorContent: ParseFormulaReturnType = {
    // could be improved to check for errors within the editor content
    parse_error_msg: undefined,
    parse_error_span: undefined,
    cell_refs: [],
  };

  cellsAccessed?.forEach((range: A1RangeType) => {
    const sheet = sheets.getById(range.sheet_id.id)?.name;
    parsedEditorContent.cell_refs.push({
      cell_ref: {
        type: 'CellRange',
        start: {
          x: { type: 'Absolute', coord: Number(sheetRect.min.x) },
          y: { type: 'Absolute', coord: Number(sheetRect.min.y) },
          sheet,
        },
        end: {
          x: { type: 'Absolute', coord: Number(sheetRect.max.x) },
          y: { type: 'Absolute', coord: Number(sheetRect.max.y) },
          sheet,
        },
        sheet: sheetRect.sheet_id.id,
      },
      span: { start: 0, end: 0 },
    });
  });
  return parsedEditorContent;
}
