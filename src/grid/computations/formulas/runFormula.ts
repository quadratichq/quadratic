import { eval_formula, CellRefNotation, ParseConfig, Pos } from 'quadratic-core';
import { GetCellsDB } from '../../sheet/Cells/GetCellsDB';
import { Coordinate } from '../../../gridGL/types/size';

export interface runFormulaReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  error_span: [number, number] | null;
  error_msg: string | null;
  output_value: string | null;
  array_output: string[][] | null;
}

export async function runFormula(formula_code: string, pos: Coordinate): Promise<runFormulaReturnType> {
  const cfg = new ParseConfig(new Pos(pos.x, pos.y), CellRefNotation.A1);
  const output = await eval_formula(formula_code, GetCellsDB, cfg);

  return output as runFormulaReturnType;
}
